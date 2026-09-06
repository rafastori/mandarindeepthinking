/**
 * BackupService — formato único para exportação de arquivo e backup na nuvem.
 *
 * Garante que o JSON exportado contenha tudo o que a importação precisa
 * (itens completos, perfil, comentários, sessões, gravações de voz) e que
 * a nuvem persista o mesmo payload sem estourar o limite de 1 MiB do Firestore.
 */

import type { StudyItem, SessionRecord } from '../types';
import type { LocalProfile, UserComment, VoiceRecording } from './localDB';
import { normalizeCreatedAt } from '../utils/dateUtils';

export const BACKUP_VERSION = '2.3.0';

/** Folga abaixo do limite de 1 MiB do Firestore (índices + metadata). */
export const FIRESTORE_SAFE_BYTES = 800_000;

export interface SerializedVoiceRecording {
    wordId: string;
    mimeType: string;
    createdAt: string;
    updatedAt: string;
    audioBase64: string;
}

export interface BackupPayload {
    version: string;
    exportedAt: string;
    userId?: string;
    itemCount: number;
    data: StudyItem[];
    profile: LocalProfile | null;
    comments: UserComment[];
    sessions: SessionRecord[];
    voiceRecordings?: SerializedVoiceRecording[];
}

export interface NormalizedItemResult {
    item: StudyItem;
    remappedFrom?: string;
}

const defaultProfile: LocalProfile = {
    savedIds: [],
    stats: { correct: 0, wrong: 0, history: [], wordCounts: {}, studyMoreIds: [] },
    totalScore: 0,
    activeFolderFilters: [],
    colorCorrections: {},
    readingMode: 'study',
    readingPrefs: { showTranslation: true, fontSize: 'md' },
};

/** Extrai o array de itens de qualquer formato conhecido. */
export function extractItems(raw: unknown): any[] {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== 'object') return [];
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.items)) return obj.items;
    return [];
}

export function hasBackupExtras(raw: unknown): boolean {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const obj = raw as Record<string, unknown>;
    if (obj.profile && typeof obj.profile === 'object') return true;
    if (Array.isArray(obj.comments) && obj.comments.length > 0) return true;
    if (Array.isArray(obj.sessions) && obj.sessions.length > 0) return true;
    if (Array.isArray(obj.voiceRecordings) && obj.voiceRecordings.length > 0) return true;
    return false;
}

/** IDs numéricos (legado) viram `legacy_<id>` — mesma regra da migração de startup. */
export function normalizeStudyItemId(id: unknown): string {
    if (typeof id === 'number' && Number.isFinite(id)) return `legacy_${id}`;
    if (typeof id === 'string') {
        const trimmed = id.trim();
        if (!trimmed) return '';
        if (/^\d+$/.test(trimmed)) return `legacy_${trimmed}`;
        return trimmed;
    }
    return '';
}

export function normalizeImportedItem(raw: any): NormalizedItemResult | null {
    if (!raw || typeof raw !== 'object') return null;
    if (!raw.chinese || !raw.translation) return null;

    const originalId = raw.id;
    let id = normalizeStudyItemId(originalId);
    if (!id) {
        id = `imported_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    const remappedFrom =
        originalId != null && String(originalId) !== id ? String(originalId) : undefined;

    const item: StudyItem = {
        ...raw,
        id,
        chinese: String(raw.chinese),
        pinyin: raw.pinyin ?? '',
        translation: String(raw.translation),
        language: raw.language || 'zh',
        tokens: Array.isArray(raw.tokens) ? raw.tokens : [],
        keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
        originalSentence: raw.originalSentence ?? null,
        type: raw.type || 'text',
        folderPath: raw.folderPath ?? null,
        createdAt: normalizeCreatedAt(raw.createdAt),
    };

    return { item, remappedFrom };
}

/** Normaliza itens + remapeia perfil/comentários/voz para os novos IDs. */
export function normalizeBackupGraph(input: {
    items: any[];
    profile: LocalProfile | null;
    comments?: UserComment[];
    voiceRecordings?: SerializedVoiceRecording[];
}): {
    items: StudyItem[];
    profile: LocalProfile | null;
    comments: UserComment[];
    voiceRecordings: SerializedVoiceRecording[];
    remap: Map<string, string>;
} {
    const remap = new Map<string, string>();
    const items: StudyItem[] = [];
    for (const raw of input.items) {
        const normalized = normalizeImportedItem(raw);
        if (!normalized) continue;
        if (normalized.remappedFrom) {
            remap.set(normalized.remappedFrom, String(normalized.item.id));
        }
        items.push(normalized.item);
    }
    return {
        items,
        profile: input.profile ? applyIdRemapToProfile(input.profile, remap) : null,
        comments: applyIdRemapToComments(input.comments || [], remap),
        voiceRecordings: applyIdRemapToVoice(input.voiceRecordings || [], remap),
        remap,
    };
}

export function remapRecordKeys<T>(
    record: Record<string, T> | undefined | null,
    remap: Map<string, string>
): Record<string, T> {
    if (!record) return {};
    const out: Record<string, T> = {};
    for (const [key, value] of Object.entries(record)) {
        out[remap.get(key) || key] = value;
    }
    return out;
}

export function applyIdRemapToProfile(profile: LocalProfile, remap: Map<string, string>): LocalProfile {
    if (remap.size === 0) return profile;
    const savedIds = (profile.savedIds || []).map(id => remap.get(String(id)) || id);
    const colorCorrections = remapRecordKeys(profile.colorCorrections, remap);
    const favoriteConfigs = remapRecordKeys(profile.stats?.favoriteConfigs, remap);
    const studyMoreIds = (profile.stats?.studyMoreIds || []).map(id => remap.get(String(id)) || id);
    return {
        ...profile,
        savedIds,
        colorCorrections,
        stats: profile.stats
            ? { ...profile.stats, favoriteConfigs, studyMoreIds }
            : profile.stats,
    };
}

export function applyIdRemapToComments(comments: UserComment[], remap: Map<string, string>): UserComment[] {
    if (remap.size === 0) return comments;
    return comments.map(c => {
        if (c.targetType === 'sentence' && remap.has(c.targetKey)) {
            return { ...c, targetKey: remap.get(c.targetKey)! };
        }
        return c;
    });
}

export function applyIdRemapToVoice(
    recordings: SerializedVoiceRecording[],
    remap: Map<string, string>
): SerializedVoiceRecording[] {
    if (remap.size === 0) return recordings;
    return recordings.map(r => ({
        ...r,
        wordId: remap.get(r.wordId) || r.wordId,
    }));
}

/**
 * merge: une favoritos/cores e preserva progresso local (XP, streak, stats).
 * replace: o backup vira a fonte da verdade.
 */
export function mergeProfiles(
    current: LocalProfile,
    incoming: LocalProfile | null,
    mode: 'merge' | 'replace'
): LocalProfile {
    if (mode === 'replace') {
        return incoming ? { ...defaultProfile, ...incoming } : { ...defaultProfile };
    }
    if (!incoming) return current;
    return {
        ...current,
        savedIds: [...new Set([...(current.savedIds || []), ...(incoming.savedIds || [])])],
        colorCorrections: {
            ...(current.colorCorrections || {}),
            ...(incoming.colorCorrections || {}),
        },
        readingMode: current.readingMode ?? incoming.readingMode,
        readingPrefs: current.readingPrefs ?? incoming.readingPrefs,
        stats: current.stats ?? incoming.stats,
        totalScore: current.totalScore ?? incoming.totalScore,
        activeFolderFilters: current.activeFolderFilters?.length
            ? current.activeFolderFilters
            : (incoming.activeFolderFilters || []),
    };
}

export function byteSize(value: unknown): number {
    return new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length;
}

/** Parte uma string UTF-8 em pedaços que cabem em um documento Firestore. */
export function splitUtf8(text: string, maxBytes: number = FIRESTORE_SAFE_BYTES): string[] {
    if (maxBytes < 4) throw new Error('maxBytes too small for UTF-8');
    const encoder = new TextEncoder();
    const chunks: string[] = [];
    let current = '';
    let currentBytes = 0;
    for (const char of text) {
        const charBytes = encoder.encode(char).length;
        if (current.length > 0 && currentBytes + charBytes > maxBytes) {
            chunks.push(current);
            current = '';
            currentBytes = 0;
        }
        current += char;
        currentBytes += charBytes;
    }
    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [''];
}

export function assembleChunks(chunks: Array<{ i: number; t: string }>): string {
    return [...chunks]
        .sort((a, b) => a.i - b.i)
        .map(c => c.t)
        .join('');
}

/** Remove `undefined` (Firestore rejeita) via round-trip JSON. */
export function sanitizeForJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export function parseBackupPayload(raw: unknown): BackupPayload {
    const obj = (!raw || typeof raw !== 'object' || Array.isArray(raw))
        ? { data: extractItems(raw) }
        : raw as Record<string, unknown>;

    const items = extractItems(obj);
    const profile = (obj.profile && typeof obj.profile === 'object')
        ? obj.profile as LocalProfile
        : null;
    const comments = Array.isArray(obj.comments) ? obj.comments as UserComment[] : [];
    const sessions = Array.isArray(obj.sessions) ? obj.sessions as SessionRecord[] : [];
    const voiceRecordings = Array.isArray(obj.voiceRecordings)
        ? obj.voiceRecordings as SerializedVoiceRecording[]
        : undefined;

    return {
        version: typeof obj.version === 'string' ? obj.version : BACKUP_VERSION,
        exportedAt: typeof obj.exportedAt === 'string'
            ? obj.exportedAt
            : (typeof obj.backedUpAt === 'string' ? obj.backedUpAt : new Date().toISOString()),
        userId: typeof obj.userId === 'string' ? obj.userId : undefined,
        itemCount: items.length,
        data: items,
        profile,
        comments,
        sessions,
        voiceRecordings,
    };
}

export function buildBackupPayload(input: {
    items: StudyItem[];
    profile: LocalProfile;
    comments: UserComment[];
    sessions: SessionRecord[];
    voiceRecordings?: SerializedVoiceRecording[];
    userId?: string;
}): BackupPayload {
    const items = input.items.map(item => ({
        ...item,
        createdAt: normalizeCreatedAt(item.createdAt),
    }));

    return sanitizeForJson({
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        userId: input.userId,
        itemCount: items.length,
        data: items,
        profile: input.profile,
        comments: input.comments,
        sessions: input.sessions,
        ...(input.voiceRecordings !== undefined
            ? { voiceRecordings: input.voiceRecordings }
            : {}),
    });
}

export function payloadHasContent(payload: BackupPayload): boolean {
    if (payload.data.length > 0) return true;
    if ((payload.profile?.savedIds?.length ?? 0) > 0) return true;
    if ((payload.comments?.length ?? 0) > 0) return true;
    if ((payload.sessions?.length ?? 0) > 0) return true;
    if ((payload.voiceRecordings?.length ?? 0) > 0) return true;
    const stats = payload.profile?.stats;
    if ((stats?.correct || 0) > 0 || (stats?.wrong || 0) > 0 || (stats?.points || 0) > 0) return true;
    if ((payload.profile?.totalScore || 0) > 0) return true;
    return false;
}

export async function blobToBase64(blob: Blob): Promise<string> {
    if (typeof FileReader !== 'undefined') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = String(reader.result || '');
                const comma = result.indexOf(',');
                resolve(comma >= 0 ? result.slice(comma + 1) : result);
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }
    const buf = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return btoa(binary);
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

export async function serializeVoiceRecordings(
    recordings: VoiceRecording[]
): Promise<SerializedVoiceRecording[]> {
    const out: SerializedVoiceRecording[] = [];
    for (const rec of recordings) {
        if (!rec?.wordId || !rec.audioBlob) continue;
        try {
            const audioBase64 = await blobToBase64(rec.audioBlob);
            if (!audioBase64) continue;
            out.push({
                wordId: rec.wordId,
                mimeType: rec.mimeType || 'audio/webm',
                createdAt: rec.createdAt,
                updatedAt: rec.updatedAt,
                audioBase64,
            });
        } catch (err) {
            console.warn('[backup] falha ao serializar gravação', rec.wordId, err);
        }
    }
    return out;
}

export function deserializeVoiceRecordings(
    serialized: SerializedVoiceRecording[] | undefined
): VoiceRecording[] {
    if (!serialized || serialized.length === 0) return [];
    const out: VoiceRecording[] = [];
    for (const rec of serialized) {
        if (!rec?.wordId || !rec.audioBase64) continue;
        try {
            out.push({
                wordId: rec.wordId,
                mimeType: rec.mimeType || 'audio/webm',
                createdAt: rec.createdAt || new Date().toISOString(),
                updatedAt: rec.updatedAt || new Date().toISOString(),
                audioBlob: base64ToBlob(rec.audioBase64, rec.mimeType || 'audio/webm'),
            });
        } catch (err) {
            console.warn('[backup] falha ao restaurar gravação', rec.wordId, err);
        }
    }
    return out;
}

export function downloadJsonFile(payload: unknown, fileName: string): void {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function formatBackupError(error: unknown): string {
    const err = error as { code?: string; message?: string };
    const code = err?.code || '';
    const message = err?.message || String(error);

    if (code === 'permission-denied') {
        return 'Sem permissão para gravar na nuvem. Verifique o login e tente de novo.';
    }
    if (code === 'unavailable' || /offline|network/i.test(message)) {
        return 'Sem conexão. Verifique a internet e tente de novo.';
    }
    if (/exceeds|too large|size/i.test(message)) {
        return 'Backup grande demais para a nuvem. Exporte o JSON pelo menu Dados.';
    }
    if (/undefined/i.test(message) && /invalid data|unsupported field/i.test(message)) {
        return 'Há dados inválidos no backup. Tente exportar o JSON e importar de novo.';
    }
    return message || 'Erro desconhecido ao sincronizar o backup.';
}
