/**
 * Divide diálogos longos em blocos de ~1 minuto (a média das aulas do repositório).
 * Não chama IA — só parte o texto para depois processar pasta a pasta.
 */

export const DEFAULT_TURNS_PER_FOLDER = 12;
export const LARGE_TEXT_TURNS = 16;
export const LARGE_TEXT_CHARS = 1200;

const SPEAKER_LINE = /^(?:[\p{L}\p{N}]{1,24})\s*[:：]\s+/u;

export function extractDialogueTurns(text: string): string[] {
    const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const lines = normalized.split('\n');
    const speakerHits = lines.filter(line => SPEAKER_LINE.test(line.trim())).length;
    const hasSpeakers = speakerHits >= 2;

    if (hasSpeakers) {
        const turns: string[] = [];
        let buf = '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (SPEAKER_LINE.test(trimmed) && buf) {
                turns.push(buf);
                buf = trimmed;
            } else {
                buf = buf ? `${buf}\n${trimmed}` : trimmed;
            }
        }
        if (buf) turns.push(buf);
        return turns;
    }

    const paragraphs = normalized.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length >= 2) return paragraphs;

    const sentences = normalized.split(/(?<=[.!?。！？])\s+/).map(s => s.trim()).filter(Boolean);
    return sentences.length ? sentences : [normalized];
}

export function estimateDurationMs(text: string): number {
    const raw = String(text || '');
    const isCJK = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(raw);
    if (isCJK) {
        const chars = raw.replace(/\s/g, '').length;
        return (chars / 280) * 60_000;
    }
    const words = raw.trim().split(/\s+/).filter(Boolean).length;
    return (words / 140) * 60_000;
}

export function isLargeImportText(text: string): boolean {
    const turns = extractDialogueTurns(text);
    if (turns.length >= LARGE_TEXT_TURNS) return true;
    if (text.trim().length >= LARGE_TEXT_CHARS) return true;
    return estimateDurationMs(text) >= 90_000;
}

export function packTurns(turns: string[], turnsPerFolder: number): string[][] {
    const size = Math.max(1, Math.floor(turnsPerFolder) || DEFAULT_TURNS_PER_FOLDER);
    const folders: string[][] = [];
    for (let i = 0; i < turns.length; i += size) {
        folders.push(turns.slice(i, i + size));
    }
    return folders.length ? folders : [];
}

export function folderPrefix(parentPath: string): string {
    const last = String(parentPath || '').split('/').pop()?.trim() || 'Aula';
    const cleaned = last.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '');
    return cleaned || 'Aula';
}

/** IDs de áudio manual: a própria pasta, depois a pasta-mãe (ex.: NLM01 e NLM). */
export function manualAudioLessonCandidates(folderPath?: string | null): string[] {
    const path = String(folderPath || '').trim().replace(/\/+$/, '');
    if (!path || path === '__uncategorized__') return [];
    const last = folderPrefix(path);
    const parts = path.split('/').filter(Boolean);
    const ids = [last];
    if (parts.length > 1) {
        const parent = folderPrefix(parts.slice(0, -1).join('/'));
        if (parent && parent !== last) ids.push(parent);
    }
    return ids;
}

export function makeSubfolderName(parentPath: string, index: number, total: number): string {
    const width = Math.max(2, String(Math.max(total, 1)).length);
    return `${folderPrefix(parentPath)}${String(index + 1).padStart(width, '0')}`;
}

export interface SplitPreviewChunk {
    index: number;
    folderName: string;
    folderPath: string;
    text: string;
    turnCount: number;
    estimatedMs: number;
    charCount: number;
}

export function buildSplitPreview(
    text: string,
    parentFolder: string,
    turnsPerFolder: number = DEFAULT_TURNS_PER_FOLDER
): SplitPreviewChunk[] {
    const parent = parentFolder.trim().replace(/\/+$/, '');
    const turns = extractDialogueTurns(text);
    const packed = packTurns(turns, turnsPerFolder);
    return packed.map((group, index) => {
        const folderName = makeSubfolderName(parent, index, packed.length);
        const chunkText = group.join('\n');
        return {
            index,
            folderName,
            folderPath: `${parent}/${folderName}`,
            text: chunkText,
            turnCount: group.length,
            estimatedMs: estimateDurationMs(chunkText),
            charCount: chunkText.length,
        };
    });
}

/** Desloca timestamps relativos do chunk para o áudio completo da pasta-mãe. */
export function applyChunkAudioOffset<T extends { audioStart?: number; audioEnd?: number }>(
    items: T[],
    chunkStart: number,
    chunkEnd?: number
): T[] {
    const start = Number(chunkStart) || 0;
    return items.map((item) => {
        const hasTimes = item.audioStart != null || item.audioEnd != null;
        if (!hasTimes) {
            return {
                ...item,
                audioStart: start,
                audioEnd: chunkEnd != null ? chunkEnd : start,
            };
        }
        return {
            ...item,
            audioStart: (Number(item.audioStart) || 0) + start,
            audioEnd: (Number(item.audioEnd) || 0) + start,
        };
    });
}

export function allocateAudioRanges<T extends { charCount: number }>(
    chunks: T[],
    durationSec: number
): Array<T & { audioStart: number; audioEnd: number }> {
    const duration = Math.max(0, durationSec);
    const weights = chunks.map(c => Math.max(1, c.charCount || 0));
    const total = weights.reduce((sum, w) => sum + w, 0) || 1;
    let cursor = 0;
    return chunks.map((chunk, i) => {
        const span = duration * (weights[i] / total);
        const audioStart = cursor;
        cursor = i === chunks.length - 1 ? duration : cursor + span;
        return { ...chunk, audioStart, audioEnd: cursor };
    });
}

export function formatMinutes(ms: number): string {
    const minutes = ms / 60_000;
    if (minutes < 0.1) return '< 0,1 min';
    return `${minutes.toFixed(1).replace('.', ',')} min`;
}

export function getAudioDuration(blob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio();
        audio.preload = 'metadata';
        const cleanup = () => URL.revokeObjectURL(url);
        audio.onloadedmetadata = () => {
            const duration = audio.duration;
            cleanup();
            resolve(Number.isFinite(duration) ? duration : 0);
        };
        audio.onerror = () => {
            cleanup();
            reject(new Error('Não foi possível ler a duração do áudio'));
        };
        audio.src = url;
    });
}
