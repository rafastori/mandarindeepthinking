/**
 * Local-only ChinesePod audio library.
 *
 * Lives in a dedicated IndexedDB so MP3 blobs never enter localDB.exportAll(),
 * cloud backup, or Firebase. StudyItem stays unchanged.
 */

import {
    ChinesePodSuffix,
    DEFAULT_PREFERRED_SUFFIX,
    LARGE_FILE_BYTES,
    NativeImportMode,
    ParsedChinesePodFile,
    parseChinesePodFilename,
    pickPreferredRecord,
    selectImportCandidates,
    suffixPriority,
} from '../utils/chinesePodAudio';
import { DEFAULT_INTRO_SKIP_SECONDS, LessonAlignment } from '../utils/audioAlignment';

const DB_NAME = 'MemorizaTudoNativeAudioDB';
const DB_VERSION = 2;
const FILES_STORE = 'files';
const META_STORE = 'meta';
const ALIGN_STORE = 'alignments';
const META_KEY = 'library';
export const NATIVE_LIBRARY_CHANGE_EVENT = 'nativelibrarychange';
export const NATIVE_ALIGNMENT_CHANGE_EVENT = 'nativealignmentchange';

export interface NativeAudioFileMeta {
    id: string;
    lessonId: string;
    suffix: ChinesePodSuffix | null;
    fileName: string;
    mimeType: string;
    size: number;
    importedAt: string;
}

export interface NativeAudioFileRecord extends NativeAudioFileMeta {
    blob: Blob;
}

export interface NativeAudioLibraryMeta {
    key: typeof META_KEY;
    preferredSuffix: ChinesePodSuffix;
    keepLargeFiles: boolean;
    importMode: NativeImportMode;
    introSkipSeconds?: number;
    sourceLabel?: string;
    updatedAt?: string;
    directoryHandle?: FileSystemDirectoryHandle;
}

export interface NativeAudioLibrarySummary {
    preferredSuffix: ChinesePodSuffix;
    keepLargeFiles: boolean;
    importMode: NativeImportMode;
    introSkipSeconds: number;
    sourceLabel?: string;
    updatedAt?: string;
    fileCount: number;
    lessonCount: number;
    dgCount: number;
    totalBytes: number;
    hasDirectoryHandle: boolean;
    files: NativeAudioFileMeta[];
}

export interface ImportAudioResult {
    imported: number;
    lessons: number;
    lessonIds: string[];
    skippedUnknown: number;
    skippedOtherSuffix: number;
    skippedLarge: number;
    skippedNoBlob: number;
    importMode: NativeImportMode;
}

const defaultMeta: NativeAudioLibraryMeta = {
    key: META_KEY,
    preferredSuffix: DEFAULT_PREFERRED_SUFFIX,
    keepLargeFiles: false,
    importMode: 'dg-only',
    introSkipSeconds: DEFAULT_INTRO_SKIP_SECONDS,
};

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbInstance && dbInstance.version < DB_VERSION) {
        dbInstance.close();
        dbInstance = null;
    }
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(FILES_STORE)) {
                const files = db.createObjectStore(FILES_STORE, { keyPath: 'id' });
                files.createIndex('lessonId', 'lessonId', { unique: false });
            }
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(ALIGN_STORE)) {
                db.createObjectStore(ALIGN_STORE, { keyPath: 'lessonId' });
            }
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            dbInstance.onclose = () => { dbInstance = null; };
            resolve(dbInstance);
        };

        request.onerror = () => reject(request.error);
    });
}

function withStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
    return openDB().then(db => new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const request = callback(tx.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    }));
}

function notifyLibraryChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(NATIVE_LIBRARY_CHANGE_EVENT));
    }
}

function notifyAlignmentChange() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(NATIVE_ALIGNMENT_CHANGE_EVENT));
    }
}

function fileId(lessonId: string, suffix: ChinesePodSuffix | null): string {
    return `${lessonId}:${suffix || 'unknown'}`;
}

function stripBlob(record: NativeAudioFileRecord): NativeAudioFileMeta {
    const { blob: _blob, ...meta } = record;
    return meta;
}

async function collectDirectoryFiles(
    dir: FileSystemDirectoryHandle,
    depth = 0
): Promise<File[]> {
    const files: File[] = [];
    if (depth > 3) return files;

    // FileSystemDirectoryHandle.entries() is not in every TS DOM lib.
    const entries = (dir as FileSystemDirectoryHandle & {
        entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>;
        values?: () => AsyncIterableIterator<FileSystemHandle>;
    });

    if (typeof entries.entries === 'function') {
        for await (const [name, handle] of entries.entries()) {
            if (name.startsWith('.')) continue;
            if (handle.kind === 'file') {
                const file = await (handle as FileSystemFileHandle).getFile();
                files.push(file);
            } else if (handle.kind === 'directory') {
                const nested = await collectDirectoryFiles(handle as FileSystemDirectoryHandle, depth + 1);
                files.push(...nested);
            }
        }
        return files;
    }

    return files;
}

export const nativeAudioLibrary = {
    async getMeta(): Promise<NativeAudioLibraryMeta> {
        const stored = await withStore<NativeAudioLibraryMeta | undefined>(
            META_STORE, 'readonly', store => store.get(META_KEY)
        );
        return stored ? { ...defaultMeta, ...stored } : { ...defaultMeta };
    },

    async saveMeta(partial: Partial<NativeAudioLibraryMeta>): Promise<NativeAudioLibraryMeta> {
        const current = await this.getMeta();
        const next: NativeAudioLibraryMeta = {
            ...current,
            ...partial,
            key: META_KEY,
            updatedAt: new Date().toISOString(),
        };
        await withStore(META_STORE, 'readwrite', store => store.put(next));
        return next;
    },

    async listFiles(): Promise<NativeAudioFileMeta[]> {
        const all = await withStore<NativeAudioFileRecord[]>(
            FILES_STORE, 'readonly', store => store.getAll()
        );
        return (all || []).map(stripBlob).sort((a, b) => a.lessonId.localeCompare(b.lessonId));
    },

    async getFile(id: string): Promise<NativeAudioFileRecord | null> {
        const record = await withStore<NativeAudioFileRecord | undefined>(
            FILES_STORE, 'readonly', store => store.get(id)
        );
        return record || null;
    },

    /** Grava um MP3/WAV genérico associado a uma pasta (não precisa do nome ChinesePod). */
    async putGenericFile(lessonId: string, file: Blob, fileName: string): Promise<NativeAudioFileMeta> {
        const id = fileId(lessonId, 'dg');
        const record: NativeAudioFileRecord = {
            id,
            lessonId,
            suffix: 'dg',
            fileName: fileName || `${lessonId}.mp3`,
            mimeType: (file as File).type || file.type || 'audio/mpeg',
            size: file.size,
            importedAt: new Date().toISOString(),
            blob: file,
        };
        await withStore(FILES_STORE, 'readwrite', store => store.put(record));
        notifyLibraryChange();
        return stripBlob(record);
    },

    async getSummary(): Promise<NativeAudioLibrarySummary> {
        const [meta, files] = await Promise.all([this.getMeta(), this.listFiles()]);
        const lessons = new Set(files.map(f => f.lessonId));
        return {
            preferredSuffix: meta.preferredSuffix,
            keepLargeFiles: meta.keepLargeFiles,
            importMode: meta.importMode || 'dg-only',
            introSkipSeconds: meta.introSkipSeconds ?? DEFAULT_INTRO_SKIP_SECONDS,
            sourceLabel: meta.sourceLabel,
            updatedAt: meta.updatedAt,
            fileCount: files.length,
            lessonCount: lessons.size,
            dgCount: files.filter(f => f.suffix === 'dg').length,
            totalBytes: files.reduce((sum, f) => sum + (f.size || 0), 0),
            hasDirectoryHandle: !!meta.directoryHandle,
            files,
        };
    },

    async findForLesson(lessonId: string, preferred?: ChinesePodSuffix): Promise<NativeAudioFileMeta | null> {
        const [meta, files] = await Promise.all([this.getMeta(), this.listFiles()]);
        return pickPreferredRecord<NativeAudioFileMeta>(files, lessonId, preferred || meta.preferredSuffix) || null;
    },

    async importFiles(
        files: File[],
        options?: {
            sourceLabel?: string;
            keepLargeFiles?: boolean;
            importMode?: NativeImportMode;
            directoryHandle?: FileSystemDirectoryHandle;
        }
    ): Promise<ImportAudioResult> {
        const meta = await this.getMeta();
        const keepLargeFiles = options?.keepLargeFiles ?? meta.keepLargeFiles;
        const importMode: NativeImportMode = options?.importMode ?? meta.importMode ?? 'dg-only';
        const preferred = meta.preferredSuffix;
        const now = new Date().toISOString();

        const parsedFiles: Array<{ file: File; parsed: ParsedChinesePodFile }> = [];
        let skippedUnknown = 0;

        for (const file of files) {
            const parsed = parseChinesePodFilename(file.name);
            if (!parsed) {
                skippedUnknown += 1;
                continue;
            }
            parsedFiles.push({ file, parsed });
        }

        const filtered = selectImportCandidates(parsedFiles, importMode);
        const selected = new Map<string, { file: File; parsed: ParsedChinesePodFile }>();

        if (importMode === 'dg-only') {
            for (const entry of filtered.selected) {
                selected.set(fileId(entry.parsed.lessonId, entry.parsed.suffix), entry);
            }
        } else {
            const byLesson = new Map<string, Array<{ file: File; parsed: ParsedChinesePodFile }>>();
            for (const entry of filtered.selected) {
                const list = byLesson.get(entry.parsed.lessonId) || [];
                list.push(entry);
                byLesson.set(entry.parsed.lessonId, list);
            }
            for (const entries of byLesson.values()) {
                if (keepLargeFiles) {
                    for (const entry of entries) selected.set(fileId(entry.parsed.lessonId, entry.parsed.suffix), entry);
                    continue;
                }
                const ranked = suffixPriority(preferred)
                    .map(suffix => entries.find(e => e.parsed.suffix === suffix))
                    .filter(Boolean) as Array<{ file: File; parsed: ParsedChinesePodFile }>;
                const fallback = entries.find(e => e.parsed.suffix == null);
                const chosen = ranked[0] || fallback;
                if (chosen) selected.set(fileId(chosen.parsed.lessonId, chosen.parsed.suffix), chosen);
                for (const entry of entries) {
                    if (entry.file.size <= LARGE_FILE_BYTES) {
                        selected.set(fileId(entry.parsed.lessonId, entry.parsed.suffix), entry);
                    }
                }
            }
        }

        let imported = 0;
        let skippedLarge = 0;
        let skippedNoBlob = 0;
        for (const entry of parsedFiles) {
            const id = fileId(entry.parsed.lessonId, entry.parsed.suffix);
            if (!selected.has(id) && entry.file.size > LARGE_FILE_BYTES) skippedLarge += 1;
        }
        const db = await openDB();

        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(FILES_STORE, 'readwrite');
            const store = tx.objectStore(FILES_STORE);

            for (const { file, parsed } of selected.values()) {
                if (!(file instanceof Blob) || file.size === 0) {
                    skippedNoBlob += 1;
                    continue;
                }
                const record: NativeAudioFileRecord = {
                    id: fileId(parsed.lessonId, parsed.suffix),
                    lessonId: parsed.lessonId,
                    suffix: parsed.suffix,
                    fileName: parsed.fileName,
                    mimeType: file.type || 'audio/mpeg',
                    size: file.size,
                    importedAt: now,
                    blob: file,
                };
                store.put(record);
                imported += 1;
            }

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        const lessonIds = Array.from(new Set(Array.from(selected.values()).map(e => e.parsed.lessonId)))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        await this.saveMeta({
            keepLargeFiles,
            importMode,
            sourceLabel: options?.sourceLabel || meta.sourceLabel || `${imported} digestivo(s)`,
            directoryHandle: options?.directoryHandle ?? meta.directoryHandle,
        });
        notifyLibraryChange();

        return {
            imported,
            lessons: lessonIds.length,
            lessonIds,
            skippedUnknown,
            skippedOtherSuffix: filtered.skippedOtherSuffix,
            skippedLarge,
            skippedNoBlob,
            importMode,
        };
    },

    async importDirectory(dir: FileSystemDirectoryHandle, options?: { keepLargeFiles?: boolean; importMode?: NativeImportMode }): Promise<ImportAudioResult> {
        const files = await collectDirectoryFiles(dir);
        return this.importFiles(files, {
            sourceLabel: dir.name || 'Pasta local',
            keepLargeFiles: options?.keepLargeFiles,
            importMode: options?.importMode,
            directoryHandle: dir,
        });
    },

    async setImportMode(importMode: NativeImportMode): Promise<void> {
        await this.saveMeta({ importMode });
        notifyLibraryChange();
    },

    async setIntroSkipSeconds(introSkipSeconds: number): Promise<void> {
        await this.saveMeta({ introSkipSeconds });
        notifyLibraryChange();
    },

    async setPreferredSuffix(suffix: ChinesePodSuffix): Promise<void> {
        await this.saveMeta({ preferredSuffix: suffix });
        notifyLibraryChange();
    },

    async setKeepLargeFiles(keepLargeFiles: boolean): Promise<void> {
        await this.saveMeta({ keepLargeFiles });
        notifyLibraryChange();
    },

    async queryDirectoryPermission(): Promise<PermissionState | 'unsupported'> {
        const meta = await this.getMeta();
        const handle = meta.directoryHandle;
        if (!handle) return 'unsupported';
        const query = (handle as FileSystemDirectoryHandle & {
            queryPermission?: (opts: { mode: 'read' }) => Promise<PermissionState>;
        }).queryPermission;
        if (typeof query !== 'function') return 'unsupported';
        try {
            return await query.call(handle, { mode: 'read' });
        } catch {
            return 'denied';
        }
    },

    async reconnectDirectory(): Promise<ImportAudioResult | null> {
        const meta = await this.getMeta();
        const handle = meta.directoryHandle;
        if (!handle) return null;

        const request = (handle as FileSystemDirectoryHandle & {
            requestPermission?: (opts: { mode: 'read' }) => Promise<PermissionState>;
        }).requestPermission;

        if (typeof request === 'function') {
            const state = await request.call(handle, { mode: 'read' });
            if (state !== 'granted') return null;
        }

        return this.importDirectory(handle, { keepLargeFiles: meta.keepLargeFiles, importMode: meta.importMode });
    },

    async getAlignment(lessonId: string): Promise<LessonAlignment | null> {
        try {
            const record = await withStore<LessonAlignment | undefined>(
                ALIGN_STORE, 'readonly', store => store.get(lessonId)
            );
            return record || null;
        } catch {
            return null;
        }
    },

    async listAlignments(): Promise<LessonAlignment[]> {
        try {
            const all = await withStore<LessonAlignment[]>(
                ALIGN_STORE, 'readonly', store => store.getAll()
            );
            return all || [];
        } catch {
            return [];
        }
    },

    async saveAlignment(alignment: LessonAlignment): Promise<void> {
        await withStore(ALIGN_STORE, 'readwrite', store => store.put({
            ...alignment,
            updatedAt: new Date().toISOString(),
        }));
        notifyAlignmentChange();
    },

    async deleteAlignment(lessonId: string): Promise<void> {
        await withStore(ALIGN_STORE, 'readwrite', store => store.delete(lessonId));
        notifyAlignmentChange();
    },

    supportsDirectoryPicker(): boolean {
        return typeof window !== 'undefined' && typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
    },

    async pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
        const picker = (window as Window & {
            showDirectoryPicker?: (opts?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandle>;
        }).showDirectoryPicker;
        if (typeof picker !== 'function') return null;
        try {
            return await picker({ mode: 'read' });
        } catch (error: any) {
            if (error?.name === 'AbortError') return null;
            throw error;
        }
    },

    async clear(): Promise<void> {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction([FILES_STORE, META_STORE], 'readwrite');
            tx.objectStore(FILES_STORE).clear();
            tx.objectStore(META_STORE).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        notifyLibraryChange();
    },
};

export default nativeAudioLibrary;
