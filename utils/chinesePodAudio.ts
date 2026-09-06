/**
 * ChinesePod local MP3 matching.
 *
 * Filenames look like: chinesepod_C2458dg.mp3
 * Study folders store the lesson number as folderPath, e.g. "2458" or "Chinês/2458".
 */

export type ChinesePodSuffix = 'dg' | 'pr' | 'rv';

export const CHINESEPOD_SUFFIXES: readonly ChinesePodSuffix[] = ['dg', 'pr', 'rv'];

export const SUFFIX_LABELS: Record<ChinesePodSuffix, string> = {
    dg: 'Digestivo',
    pr: 'Podcast',
    rv: 'Revisão',
};

/** Default match for a text folder: the short dialogue ("digestivo"). */
export const DEFAULT_PREFERRED_SUFFIX: ChinesePodSuffix = 'dg';

/** Files larger than this are skipped unless the user opts into large copies. */
export const LARGE_FILE_BYTES = 2 * 1024 * 1024;

const AUDIO_EXT = /\.(mp3|m4a|wav|aac)$/i;
const FILE_RE = /chinesepod[_-]?c(\d{3,6})(dg|pr|rv)?(?:\.[^.]+)?$/i;
const C_ID_RE = /(?:^|[^a-z0-9])c(\d{3,6})(?:[^0-9]|$)/i;
const SEGMENT_ID_RE = /^\d{3,6}$/;
const EMBEDDED_ID_RE = /(?:^|[^\d])(\d{4,6})(?:[^\d]|$)/g;

export interface ParsedChinesePodFile {
    lessonId: string;
    suffix: ChinesePodSuffix | null;
    fileName: string;
}

export function isChinesePodSuffix(value: string): value is ChinesePodSuffix {
    return value === 'dg' || value === 'pr' || value === 'rv';
}

export function parseChinesePodFilename(fileName: string): ParsedChinesePodFile | null {
    if (!fileName) return null;
    const base = fileName.split(/[/\\]/).pop() || fileName;
    if (!AUDIO_EXT.test(base)) return null;

    const stem = base.replace(AUDIO_EXT, '');
    const match = stem.match(FILE_RE);
    if (!match) return null;

    const suffixRaw = match[2]?.toLowerCase() || null;
    const suffix = suffixRaw && isChinesePodSuffix(suffixRaw) ? suffixRaw : null;

    return {
        lessonId: match[1],
        suffix,
        fileName: base,
    };
}

export function extractLessonIdsFromFolderPath(folderPath?: string | null): string[] {
    if (!folderPath) return [];
    const ids = new Set<string>();
    const segments = folderPath.split(/[/\\]/).map(s => s.trim()).filter(Boolean);

    for (const segment of segments) {
        if (SEGMENT_ID_RE.test(segment)) {
            ids.add(segment);
        }

        const cMatch = segment.match(C_ID_RE);
        if (cMatch) ids.add(cMatch[1]);

        EMBEDDED_ID_RE.lastIndex = 0;
        let embedded: RegExpExecArray | null;
        while ((embedded = EMBEDDED_ID_RE.exec(segment)) !== null) {
            ids.add(embedded[1]);
        }
    }

    return Array.from(ids);
}

/**
 * Resolve a single lesson id for the current reading view.
 * Prefers the active folder filter; falls back to ids shared by visible items.
 */
export function resolveLessonIdForView(
    folderFilters: string[],
    itemFolderPaths: Array<string | null | undefined>
): string | null {
    const fromFilters = folderFilters
        .filter(path => path && path !== '__uncategorized__')
        .flatMap(path => extractLessonIdsFromFolderPath(path));

    const uniqueFilters = unique(fromFilters);
    if (uniqueFilters.length === 1) return uniqueFilters[0];
    if (uniqueFilters.length > 1) return null;

    const fromItems = itemFolderPaths.flatMap(path => extractLessonIdsFromFolderPath(path));
    const uniqueItems = unique(fromItems);
    return uniqueItems.length === 1 ? uniqueItems[0] : null;
}

export function suffixPriority(preferred: ChinesePodSuffix): ChinesePodSuffix[] {
    const rest = CHINESEPOD_SUFFIXES.filter(s => s !== preferred);
    return [preferred, ...rest];
}

export type NativeImportMode = 'dg-only' | 'include-other';

export interface ImportCandidate<T> {
    file: T;
    parsed: ParsedChinesePodFile;
}

export interface ImportSelection<T> {
    selected: ImportCandidate<T>[];
    skippedUnknown: number;
    skippedOtherSuffix: number;
    lessonIds: string[];
}

/**
 * Default import path: keep only digestivo (dg). Mixed Baixados folders
 * also contain pr/rv/PDF — those are ignored unless the user opts in.
 */
export function selectImportCandidates<T>(
    entries: ImportCandidate<T>[],
    mode: NativeImportMode = 'dg-only'
): ImportSelection<T> {
    const selected: ImportCandidate<T>[] = [];
    let skippedOtherSuffix = 0;
    const lessons = new Set<string>();

    for (const entry of entries) {
        if (mode === 'dg-only') {
            if (entry.parsed.suffix === 'dg') {
                selected.push(entry);
                lessons.add(entry.parsed.lessonId);
            } else {
                skippedOtherSuffix += 1;
            }
            continue;
        }
        selected.push(entry);
        lessons.add(entry.parsed.lessonId);
    }

    return {
        selected,
        skippedUnknown: 0,
        skippedOtherSuffix,
        lessonIds: Array.from(lessons).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    };
}

export function pickPreferredRecord<T extends { lessonId: string; suffix: ChinesePodSuffix | null }>(
    records: T[],
    lessonId: string,
    preferred: ChinesePodSuffix = DEFAULT_PREFERRED_SUFFIX
): T | undefined {
    const forLesson = records.filter(r => r.lessonId === lessonId);
    if (forLesson.length === 0) return undefined;

    for (const suffix of suffixPriority(preferred)) {
        const hit = forLesson.find(r => r.suffix === suffix);
        if (hit) return hit;
    }

    return forLesson.find(r => r.suffix == null) || forLesson[0];
}

export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatClock(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values));
}
