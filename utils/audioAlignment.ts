/**
 * Sentence ↔ audio alignment helpers (no I/O).
 * Used to map StudyItem sentences onto a ChinesePod DG track.
 */

export type AlignmentSource = 'auto' | 'manual' | 'mixed' | 'proportional';

export interface TimedChunk {
    start: number;
    end: number;
    text: string;
}

export interface SentenceAlignment {
    itemId: string;
    start: number;
    end: number;
    score?: number;
    source: AlignmentSource;
}

export interface LessonAlignment {
    lessonId: string;
    audioFileId: string;
    contentHash: string;
    duration: number;
    cues: SentenceAlignment[];
    whisperChunks?: TimedChunk[];
    method?: 'whisper' | 'proportional' | 'manual';
    averageScore?: number;
    /** Segundos ignorados no começo (intro em inglês do ChinesePod). */
    introSkipSeconds?: number;
    updatedAt: string;
}

/** Intro em inglês no início dos DG ChinesePod — típico ~6s. */
export const DEFAULT_INTRO_SKIP_SECONDS = 6;
export const INTRO_SKIP_PRESETS = [0, 5, 6, 6.5, 7, 8] as const;

const CJK_RE = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

export interface AlignSentenceInput {
    id: string;
    text: string;
}

export const MIN_SEG = 0.18;

export function normalizeAlignText(text: string): string {
    return (text || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\s\p{P}\p{S}0-9]/gu, '');
}

export function hashLessonContent(items: Array<{ id: string | number; text: string }>): string {
    const payload = items.map(item => `${item.id}\t${normalizeAlignText(item.text)}`).join('\n');
    let h = 2166136261;
    for (let i = 0; i < payload.length; i++) {
        h ^= payload.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
}

export function formatClockPrecise(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0';
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    const whole = Math.floor(s);
    const tenth = Math.floor((s - whole) * 10);
    return `${m}:${whole.toString().padStart(2, '0')}.${tenth}`;
}

/** Aceita `16.6`, `0:16.6`, `1:02.35` ou vírgula decimal. */
export function parseClockPrecise(input: string): number | null {
    const raw = String(input || '').trim().replace(',', '.');
    if (!raw) return null;
    if (/^\d+(\.\d+)?$/.test(raw)) {
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    }
    const match = raw.match(/^(\d+):([0-5]?\d)(?:\.(\d{1,3}))?$/);
    if (!match) return null;
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    const frac = match[3] ? Number(`0.${match[3]}`) : 0;
    const total = minutes * 60 + seconds + frac;
    return Number.isFinite(total) ? total : null;
}

export function clampTime(value: number, duration: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(Math.max(value, 0), Math.max(duration, 0));
}

export function clampCues(
    cues: SentenceAlignment[],
    duration: number,
    minStart = 0
): SentenceAlignment[] {
    const floor = Math.max(0, minStart);
    const next = cues.map(cue => {
        let start = Math.max(clampTime(cue.start, duration), Math.min(floor, duration));
        let end = clampTime(cue.end, duration);
        if (end < start + MIN_SEG) end = Math.min(duration, start + MIN_SEG);
        if (end <= start) end = Math.min(duration, start + MIN_SEG);
        return { ...cue, start, end };
    });

    for (let i = 1; i < next.length; i++) {
        if (next[i].start < next[i - 1].end) {
            next[i] = { ...next[i], start: next[i - 1].end };
            if (next[i].end < next[i].start + MIN_SEG) {
                next[i] = { ...next[i], end: Math.min(duration, next[i].start + MIN_SEG) };
            }
        }
    }
    return next;
}

export function shiftCues(
    cues: SentenceAlignment[],
    deltaSeconds: number,
    duration: number,
    minStart = 0
): SentenceAlignment[] {
    return clampCues(
        cues.map(cue => ({
            ...cue,
            start: cue.start + deltaSeconds,
            end: cue.end + deltaSeconds,
            source: cue.source === 'auto' || cue.source === 'proportional' ? 'mixed' : cue.source,
        })),
        duration,
        minStart
    );
}

export function clampIntroSkip(seconds: number | undefined, duration: number): number {
    if (seconds == null || !Number.isFinite(seconds)) return DEFAULT_INTRO_SKIP_SECONDS;
    if (seconds <= 0) return 0;
    const max = Math.max(duration - 1, 0);
    return Math.min(Math.max(seconds, 0), Math.min(max, 30));
}

export function resolveIntroSkip(
    alignment?: { introSkipSeconds?: number } | null,
    globalDefault?: number
): number {
    if (alignment?.introSkipSeconds != null && Number.isFinite(alignment.introSkipSeconds)) {
        return Math.max(0, alignment.introSkipSeconds);
    }
    if (globalDefault != null && Number.isFinite(globalDefault)) {
        return Math.max(0, globalDefault);
    }
    return DEFAULT_INTRO_SKIP_SECONDS;
}

export function offsetChunks(chunks: TimedChunk[], offset: number): TimedChunk[] {
    if (!offset) return chunks;
    return chunks.map(chunk => ({
        ...chunk,
        start: chunk.start + offset,
        end: chunk.end + offset,
    }));
}

export function isLatinHeavy(text: string): boolean {
    const letters = (text || '').replace(/[^a-zA-Z\u00C0-\u024F]/g, '');
    const cjk = (text || '').match(CJK_RE) || [];
    return letters.length >= 6 && cjk.length < 2;
}

export function hasCjk(text: string): boolean {
    return CJK_RE.test(text || '');
}

/** Se o começo ainda for inglês, devolve quantos segundos extras pular (relativo aos chunks). */
export function extraSkipFromLatinIntro(chunks: TimedChunk[], searchUntil = 5): number {
    let extra = 0;
    const ordered = [...chunks].sort((a, b) => a.start - b.start);
    for (const chunk of ordered) {
        if (chunk.start > searchUntil) break;
        if (isLatinHeavy(chunk.text)) extra = Math.max(extra, chunk.end);
        else if (hasCjk(chunk.text)) break;
    }
    return extra;
}

/** Alinhamentos antigos começam em 0 e incluem a intro — deslocar em vez de só cortar. */
export function cuesLookUnshifted(
    cues: SentenceAlignment[] | undefined,
    introSkipSeconds: number
): boolean {
    if (!cues?.length || introSkipSeconds <= 0.2) return false;
    return cues[0].start < introSkipSeconds * 0.5;
}

export function effectiveCueTimes(
    cue: SentenceAlignment | undefined,
    introSkipSeconds: number,
    duration?: number,
    options?: { legacyUnshifted?: boolean }
): { start: number; end: number } | null {
    if (!cue) return null;
    const skip = Math.max(0, introSkipSeconds);
    let start = cue.start;
    let end = cue.end;
    if (options?.legacyUnshifted && cue.start < skip - 0.35) {
        start = cue.start + skip;
        end = cue.end + skip;
    } else {
        start = Math.max(cue.start, skip);
        end = Math.max(cue.end, start + MIN_SEG);
    }
    if (end < start + MIN_SEG) end = start + MIN_SEG;
    if (duration != null && duration > 0) {
        if (start >= duration - 0.05) return null;
        end = Math.min(end, duration);
    }
    return { start, end };
}

export function rebaseCuesForIntroSkip(
    cues: SentenceAlignment[],
    previousSkip: number,
    nextSkip: number,
    duration: number
): SentenceAlignment[] {
    const delta = nextSkip - previousSkip;
    if (Math.abs(delta) < 0.01) return clampCues(cues, duration, nextSkip);
    return shiftCues(cues, delta, duration, nextSkip);
}

export function proportionalAlign(
    sentences: AlignSentenceInput[],
    duration: number,
    startOffset = 0
): SentenceAlignment[] {
    if (sentences.length === 0 || duration <= 0) return [];
    const offset = clampIntroSkip(startOffset === 0 ? 0 : startOffset, duration);
    const usable = Math.max(duration - offset, 0.5);
    const weights = sentences.map(s => Math.max(normalizeAlignText(s.text).length, 4));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let cursor = 0;
    return sentences.map((sentence, index) => {
        const span = (weights[index] / total) * usable;
        const start = offset + cursor;
        const end = index === sentences.length - 1 ? duration : offset + cursor + span;
        cursor = end - offset;
        return {
            itemId: sentence.id,
            start,
            end,
            score: 0,
            source: 'proportional' as const,
        };
    });
}

function overlapScore(a: string, b: string): number {
    if (!a || !b) return 0;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    if (long.includes(short) && short.length >= 2) {
        return short.length / long.length;
    }
    let best = 0;
    const window = short.length;
    if (window === 0) return 0;
    for (let i = 0; i <= long.length - window; i++) {
        let hit = 0;
        for (let j = 0; j < window; j++) {
            if (long[i + j] === short[j]) hit += 1;
        }
        best = Math.max(best, hit / window);
    }
    return best;
}

function buildCharTimeline(chunks: TimedChunk[]): { chars: string; times: number[] } {
    let chars = '';
    const times: number[] = [];
    for (const chunk of chunks) {
        const norm = normalizeAlignText(chunk.text);
        if (!norm) continue;
        const span = Math.max(chunk.end - chunk.start, 0.05);
        for (let i = 0; i < norm.length; i++) {
            chars += norm[i];
            times.push(chunk.start + (i / norm.length) * span);
        }
    }
    return { chars, times };
}

function timeAt(times: number[], index: number, duration: number, end: boolean): number {
    if (times.length === 0) return end ? duration : 0;
    const i = Math.min(Math.max(index, 0), times.length - 1);
    const t = times[i];
    if (!end) return t;
    const next = times[i + 1];
    return next != null ? next : Math.min(duration, t + 0.2);
}

/**
 * Sequential alignment of known sentences onto timestamped ASR chunks.
 * Falls back to proportional split when the transcript does not match the text.
 */
export function alignSentencesToChunks(
    sentences: AlignSentenceInput[],
    chunks: TimedChunk[],
    duration: number,
    startOffset = 0
): { cues: SentenceAlignment[]; averageScore: number; method: 'whisper' | 'proportional' } {
    const offset = clampIntroSkip(startOffset === 0 ? 0 : startOffset, duration);
    const usableChunks = chunks.filter(chunk => chunk.end > offset + 0.05);
    const proportional = proportionalAlign(sentences, duration, offset);
    if (sentences.length === 0) {
        return { cues: [], averageScore: 0, method: 'proportional' };
    }
    if (!usableChunks.length) {
        return { cues: proportional, averageScore: 0, method: 'proportional' };
    }

    const { chars, times } = buildCharTimeline(usableChunks);
    if (chars.length < 4) {
        return { cues: proportional, averageScore: 0, method: 'proportional' };
    }

    const cues: SentenceAlignment[] = [];
    let cursor = 0;
    let scoreSum = 0;

    for (let s = 0; s < sentences.length; s++) {
        const needle = normalizeAlignText(sentences[s].text);
        const remaining = chars.slice(cursor);
        let startIdx = cursor;
        let endIdx = cursor;
        let score = 0;

        if (needle.length >= 2) {
            const exact = remaining.indexOf(needle);
            if (exact >= 0) {
                startIdx = cursor + exact;
                endIdx = startIdx + needle.length - 1;
                score = 1;
            } else {
                const window = Math.max(needle.length, 2);
                let best = 0;
                let bestAt = 0;
                const limit = Math.max(remaining.length - window, 0);
                const scan = Math.min(limit, window * 8);
                for (let i = 0; i <= scan; i++) {
                    const slice = remaining.slice(i, i + window);
                    const local = overlapScore(needle, slice);
                    if (local > best) {
                        best = local;
                        bestAt = i;
                    }
                }
                startIdx = cursor + bestAt;
                endIdx = startIdx + window - 1;
                score = best;
            }
        }

        const start = timeAt(times, startIdx, duration, false);
        const end = s === sentences.length - 1
            ? duration
            : timeAt(times, endIdx, duration, true);

        cues.push({
            itemId: sentences[s].id,
            start,
            end: Math.max(end, start + MIN_SEG),
            score,
            source: 'auto',
        });
        scoreSum += score;
        cursor = Math.max(endIdx + 1, cursor + 1);
    }

    const averageScore = cues.length ? scoreSum / cues.length : 0;
    if (averageScore < 0.28) {
        return { cues: proportional, averageScore, method: 'proportional' };
    }

    const lifted = cues.map(cue => ({
        ...cue,
        start: Math.max(cue.start, offset),
        end: Math.max(cue.end, offset + MIN_SEG),
    }));

    return {
        cues: clampCues(lifted, duration, offset),
        averageScore,
        method: 'whisper',
    };
}

export function realignOneSentence(
    cues: SentenceAlignment[],
    itemId: string,
    sentences: AlignSentenceInput[],
    chunks: TimedChunk[] | undefined,
    duration: number
): SentenceAlignment[] {
    const index = cues.findIndex(c => c.itemId === itemId);
    if (index < 0) return cues;
    const sentence = sentences.find(s => s.id === itemId);
    if (!sentence) return cues;

    const windowStart = index > 0 ? Math.max(0, cues[index - 1].end - 0.15) : Math.max(0, cues[0]?.start ?? 0);
    const windowEnd = index < cues.length - 1
        ? Math.min(duration, cues[index + 1].start + 0.15)
        : duration;
    const windowChunks = (chunks || []).filter(c => c.end >= windowStart && c.start <= windowEnd);
    const local = alignSentencesToChunks([sentence], windowChunks, windowEnd - windowStart);
    const cue = local.cues[0];
    if (!cue) return cues;

    const next = cues.slice();
    next[index] = {
        ...cue,
        start: clampTime(windowStart + cue.start, duration),
        end: clampTime(windowStart + cue.end, duration),
        source: local.method === 'whisper' ? 'auto' : 'proportional',
    };
    return clampCues(next, duration);
}

export function updateCueTimes(
    cues: SentenceAlignment[],
    itemId: string,
    patch: { start?: number; end?: number },
    duration: number
): SentenceAlignment[] {
    const exists = cues.some(cue => cue.itemId === itemId);
    if (!exists) {
        const start = patch.start ?? 0;
        const end = patch.end ?? start + MIN_SEG;
        return clampCues(
            [...cues, { itemId, start, end, source: 'manual' }],
            duration
        );
    }
    return clampCues(
        cues.map(cue => cue.itemId === itemId
            ? {
                ...cue,
                start: patch.start ?? cue.start,
                end: patch.end ?? cue.end,
                source: 'manual',
            }
            : cue),
        duration
    );
}

export function emptyManualAlignment(options: {
    lessonId: string;
    audioFileId: string;
    contentHash: string;
    duration: number;
    introSkipSeconds?: number;
}): LessonAlignment {
    return {
        lessonId: options.lessonId,
        audioFileId: options.audioFileId,
        contentHash: options.contentHash,
        duration: Math.max(options.duration, 0),
        cues: [],
        method: 'manual',
        introSkipSeconds: clampIntroSkip(
            options.introSkipSeconds ?? DEFAULT_INTRO_SKIP_SECONDS,
            options.duration || 999
        ),
        updatedAt: new Date().toISOString(),
    };
}

export function isLiveCueComplete(cue: SentenceAlignment | undefined): boolean {
    if (!cue) return false;
    return cue.end - cue.start > MIN_SEG + 0.02;
}

export function applyLiveStart(
    cues: SentenceAlignment[],
    itemId: string,
    time: number,
    duration: number,
    introSkipSeconds = 0
): { cues: SentenceAlignment[]; start: number; clampedToIntro: boolean } {
    const skip = Math.max(0, introSkipSeconds);
    const start = Math.max(time, skip);
    const existing = cues.find(cue => cue.itemId === itemId);
    const end = existing && existing.end > start + MIN_SEG
        ? existing.end
        : start + MIN_SEG;
    return {
        cues: updateCueTimes(cues, itemId, { start, end }, duration),
        start,
        clampedToIntro: time < skip - 0.05,
    };
}

export type LiveMarkEndError = 'no_start' | 'end_before_start';

export function applyLiveEnd(
    cues: SentenceAlignment[],
    itemId: string,
    nextItemId: string | undefined,
    time: number,
    duration: number
): { ok: true; cues: SentenceAlignment[]; end: number } | { ok: false; reason: LiveMarkEndError } {
    const current = cues.find(cue => cue.itemId === itemId);
    if (!current) return { ok: false, reason: 'no_start' };
    if (time <= current.start + 0.04) return { ok: false, reason: 'end_before_start' };
    const end = Math.max(time, current.start + MIN_SEG);
    let next = updateCueTimes(cues, itemId, { end }, duration);
    if (nextItemId) {
        const following = next.find(cue => cue.itemId === nextItemId);
        const nextEnd = following && following.end > end + MIN_SEG
            ? following.end
            : end + MIN_SEG;
        next = updateCueTimes(next, nextItemId, { start: end, end: nextEnd }, duration);
    }
    return { ok: true, cues: next, end };
}

export function parseWhisperChunks(raw: unknown): TimedChunk[] {
    if (!Array.isArray(raw)) return [];
    const chunks: TimedChunk[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as { text?: string; timestamp?: [number | null, number | null] };
        const ts = rec.timestamp;
        if (!ts || typeof ts[0] !== 'number') continue;
        const start = ts[0];
        const end = typeof ts[1] === 'number' ? ts[1] : start + 0.4;
        chunks.push({
            start,
            end: Math.max(end, start + 0.05),
            text: String(rec.text || ''),
        });
    }
    return chunks;
}
