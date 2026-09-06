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

function proportionalAlign(sentences, duration, startOffset = 0) {
    const usable = Math.max(duration - startOffset, 0.5);
    const weights = sentences.map(s => Math.max(normalizeAlignText(s.text).length, 4));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let cursor = 0;
    return sentences.map((sentence, index) => {
        const span = (weights[index] / total) * usable;
        const start = startOffset + cursor;
        const end = index === sentences.length - 1 ? duration : startOffset + cursor + span;
        cursor = end - startOffset;
        return { itemId: sentence.id, start, end, source: 'proportional' };
    });
}

function isLatinHeavy(text) {
    const letters = (text || '').replace(/[^a-zA-Z\u00C0-\u024F]/g, '');
    const cjk = (text || '').match(/[\u3400-\u9fff]/) || [];
    return letters.length >= 6 && cjk.length < 2;
}

function extraSkipFromLatinIntro(chunks, searchUntil = 5) {
    let extra = 0;
    for (const chunk of [...chunks].sort((a, b) => a.start - b.start)) {
        if (chunk.start > searchUntil) break;
        if (isLatinHeavy(chunk.text)) extra = Math.max(extra, chunk.end);
        else if (/[\u3400-\u9fff]/.test(chunk.text)) break;
    }
    return extra;
}

function shiftCues(cues, delta, duration, minStart = 0) {
    return cues.map(c => ({
        ...c,
        start: Math.min(Math.max(c.start + delta, minStart), duration),
        end: Math.min(Math.max(c.end + delta, minStart), duration),
    }));
}

function effectiveCueTimes(cue, introSkip, duration, legacyUnshifted) {
    if (!cue) return null;
    let start = cue.start;
    let end = cue.end;
    if (legacyUnshifted && cue.start < introSkip - 0.35) {
        start = cue.start + introSkip;
        end = cue.end + introSkip;
    } else {
        start = Math.max(cue.start, introSkip);
        end = Math.max(cue.end, start + 0.18);
    }
    if (duration) end = Math.min(end, duration);
    return { start, end };
}

function cuesLookUnshifted(cues, introSkip) {
    return !!(cues?.length && introSkip > 0.2 && cues[0].start < introSkip * 0.5);
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

const withIntro = proportionalAlign(sents, 16, 6);
assert(Math.abs(withIntro[0].start - 6) < 1e-9, 'proportional starts after 6s intro');
assert(Math.abs(withIntro[1].end - 16) < 1e-9, 'last still ends at duration');

assert(isLatinHeavy('Welcome to ChinesePod'), 'english intro is latin-heavy');
assert(!isLatinHeavy('你好吗'), 'chinese is not latin-heavy');
assert(extraSkipFromLatinIntro([
    { start: 0, end: 1.4, text: 'Welcome back' },
    { start: 1.4, end: 3, text: '你好' },
]) === 1.4, 'extra skip until first CJK');

const afterIntro = shiftCues([{ itemId: '1', start: 6, end: 8 }], -0.5, 20, 6);
assert(afterIntro[0].start === 6, 'shift all does not enter the intro');

const legacy = effectiveCueTimes({ start: 0, end: 4 }, 6, 20, true);
assert(Math.abs(legacy.start - 6) < 1e-9 && Math.abs(legacy.end - 10) < 1e-9, 'legacy cues are shifted by intro skip');

const already = effectiveCueTimes({ start: 6.2, end: 9 }, 6, 20, false);
assert(Math.abs(already.start - 6.2) < 1e-9, 'cues after intro stay put');

assert(cuesLookUnshifted([{ start: 0, end: 3 }], 6), '0-based alignment looks unshifted');
assert(!cuesLookUnshifted([{ start: 6, end: 9 }], 6), 'post-intro alignment is not unshifted');

if (failed) {
    console.error(failed, 'failed');
    process.exit(1);
}
console.log('\nall alignment checks passed');
