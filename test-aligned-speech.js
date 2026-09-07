/**
 * Native cue lookup for Practice / Pronúncia — run: node test-aligned-speech.js
 */

function normalizeAlignText(text) {
    return (text || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}0-9]/gu, '');
}

const NON_ITEM_ID = /^(practice-word-|practice-sentence-|swipe-)/;

function cueItemIdFromSpeakId(speakId) {
    if (!speakId) return null;
    if (NON_ITEM_ID.test(speakId)) return null;
    if (speakId.startsWith('reading-')) return speakId.slice('reading-'.length);
    return speakId;
}

function findAlignedCue({ alignment, items, speakId, sentenceItemId, text }) {
    const cues = alignment?.cues || [];
    if (!cues.length) return null;
    const byId = (id) => (id ? cues.find(c => c.itemId === id) || null : null);
    const fromSentence = byId(sentenceItemId);
    if (fromSentence) return fromSentence;
    const fromSpeak = byId(cueItemIdFromSpeakId(speakId));
    if (fromSpeak) return fromSpeak;
    const needle = normalizeAlignText(text || '');
    if (needle.length < 2) return null;
    for (const item of items) {
        if (item.type === 'word') continue;
        if (normalizeAlignText(item.chinese || '') === needle) {
            const cue = byId(item.id.toString());
            if (cue) return cue;
        }
    }
    return null;
}

let failed = 0;
function assert(cond, label) {
    if (!cond) {
        failed += 1;
        console.error('FAIL', label);
    } else console.log('ok  ', label);
}

const alignment = {
    cues: [
        { itemId: '2458-1', start: 6, end: 9 },
        { itemId: '2458-2', start: 9, end: 12 },
    ],
};
const items = [
    { id: '2458-1', type: 'text', chinese: '你好吗？' },
    { id: '2458-2', type: 'text', chinese: '我很好。' },
    { id: 'w1', type: 'word', chinese: '你好' },
];

assert(findAlignedCue({ alignment, items, sentenceItemId: '2458-1' })?.start === 6, 'lookup by sentenceItemId');
assert(findAlignedCue({ alignment, items, speakId: '2458-2' })?.start === 9, 'lookup by study item id');
assert(findAlignedCue({ alignment, items, speakId: 'reading-2458-1' })?.itemId === '2458-1', 'reading- prefix');
assert(!findAlignedCue({ alignment, items, speakId: 'practice-sentence-0' }), 'practice sentence index is not an item id');
assert(!findAlignedCue({ alignment, items, speakId: 'practice-word-0', text: '你好' }), 'short word stays unmatched');
assert(findAlignedCue({ alignment, items, speakId: 'practice-sentence-0', text: '你好吗' })?.itemId === '2458-1', 'sentence text maps to cue');
assert(!findAlignedCue({ alignment: { cues: [] }, items, text: '你好吗？' }), 'no cues → no native match');
assert(cueItemIdFromSpeakId('practice-word-3') === null, 'word play id ignored');

if (failed) {
    console.error(failed, 'failed');
    process.exit(1);
}
console.log('\nall aligned-speech checks passed');
