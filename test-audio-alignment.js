/**
 * Alignment helpers — run: node test-audio-alignment.js
 * Mirrors the core of utils/audioAlignment.ts
 */

function normalizeAlignText(text) {
    return (text || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}0-9]/gu, '');
}

function hashLessonContent(items) {
    const payload = items.map(item => `${item.id}\t${normalizeAlignText(item.text)}`).join('\n');
    let h = 2166136261;
    for (let i = 0; i < payload.length; i++) {
        h ^= payload.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
}

function proportionalAlign(sentences, duration) {
    const weights = sentences.map(s => Math.max(normalizeAlignText(s.text).length, 4));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let cursor = 0;
    return sentences.map((sentence, index) => {
        const span = (weights[index] / total) * duration;
        const start = cursor;
        const end = index === sentences.length - 1 ? duration : cursor + span;
        cursor = end;
        return { itemId: sentence.id, start, end, source: 'proportional' };
    });
}

function shiftCues(cues, delta, duration) {
    return cues.map(c => ({
        ...c,
        start: Math.min(Math.max(c.start + delta, 0), duration),
        end: Math.min(Math.max(c.end + delta, 0), duration),
    }));
}

function overlapScore(a, b) {
    if (!a || !b) return 0;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    if (long.includes(short) && short.length >= 2) return short.length / long.length;
    return 0;
}

function alignExact(sentences, chunks, duration) {
    const chars = chunks.map(c => normalizeAlignText(c.text)).join('');
    if (!chars) return { method: 'proportional', cues: proportionalAlign(sentences, duration) };
    let cursor = 0;
    const cues = [];
    let hits = 0;
    for (const s of sentences) {
        const needle = normalizeAlignText(s.text);
        const idx = chars.slice(cursor).indexOf(needle);
        if (idx >= 0 && needle.length >= 2) {
            hits += 1;
            cursor += idx + needle.length;
        }
        cues.push({ itemId: s.id, start: 0, end: duration, source: 'auto' });
    }
    return { method: hits / sentences.length >= 0.28 ? 'whisper' : 'proportional', hits };
}

let failed = 0;
function assert(cond, label) {
    if (!cond) {
        failed += 1;
        console.error('FAIL', label);
    } else console.log('ok  ', label);
}

const sents = [
    { id: '1', text: '你好吗？' },
    { id: '2', text: '我很好。' },
];
const prop = proportionalAlign(sents, 10);
assert(prop.length === 2, 'two cues');
assert(prop[0].start === 0, 'first starts at 0');
assert(Math.abs(prop[1].end - 10) < 1e-9, 'last ends at duration');
assert(prop[0].end <= prop[1].start + 1e-9, 'monotonic');

const shifted = shiftCues(prop, 0.25, 10);
assert(shifted[0].start === 0.25, 'shift +0.25');

const h1 = hashLessonContent(sents);
const h2 = hashLessonContent([{ id: '1', text: '你好吗' }, { id: '2', text: '我很好' }]);
assert(h1 === h2, 'hash ignores punctuation');
assert(hashLessonContent([{ id: '1', text: '别的' }, { id: '2', text: '我很好。' }]) !== h1, 'hash changes with text');

const aligned = alignExact(sents, [
    { start: 0, end: 2, text: '你好吗' },
    { start: 2, end: 4, text: '我很好' },
], 4);
assert(aligned.method === 'whisper', 'exact chinese match uses whisper');
assert(aligned.hits === 2, 'both sentences matched');

const miss = alignExact(sents, [{ start: 0, end: 4, text: 'totally different' }], 4);
assert(miss.method === 'proportional', 'mismatch falls back to proportional');

if (failed) {
    console.error(failed, 'failed');
    process.exit(1);
}
console.log('\nall alignment checks passed');
