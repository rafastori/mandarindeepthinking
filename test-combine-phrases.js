/**
 * Combinar frases board — run: node test-combine-phrases.js
 */

function itemMatchesFolderFilters(item, filters) {
    if (!filters.length) return true;
    if (filters.includes('__uncategorized__') && !item.folderPath) return true;
    return filters.some(filterPath => {
        if (filterPath === '__uncategorized__') return false;
        return item.folderPath === filterPath || !!item.folderPath?.startsWith(filterPath + '/');
    });
}

function collectPhrasePairs(items, folderFilters = []) {
    const seen = new Set();
    const out = [];
    for (const item of items) {
        if (item.type === 'word') continue;
        if (!itemMatchesFolderFilters(item, folderFilters)) continue;
        const sentence = (item.chinese || '').trim();
        const translation = (item.translation || '').trim();
        if (!sentence || !translation) continue;
        const key = sentence.normalize('NFKC');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ id: String(item.id), sentence, translation, language: item.language });
    }
    return out;
}

function shuffleInPlace(arr, random) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function shuffled(arr, random) {
    return shuffleInPlace([...arr], random);
}

function decideBoardSize(phrases) {
    if (phrases.length <= 1) return phrases.length;
    if (phrases.length === 2) return 2;
    const avgL2 = phrases.reduce((s, p) => s + p.sentence.length, 0) / phrases.length;
    const maxL2 = Math.max(...phrases.map(p => p.sentence.length));
    const maxL1 = Math.max(...phrases.map(p => p.translation.length));
    const long = avgL2 >= 16 || maxL2 >= 24 || maxL1 >= 52;
    return Math.min(long ? 3 : 4, phrases.length);
}

function buildCombineBoard(remaining, size, random) {
    if (!remaining.length) return null;
    const n = Math.max(1, Math.min(size, remaining.length));
    const pool = shuffled(remaining, random);
    const l2 = pool.slice(0, n);
    const l2Ids = new Set(l2.map(p => p.id));
    const outside = pool.filter(p => !l2Ids.has(p.id));
    const l1 = [l2[0]];
    for (const extra of outside) {
        if (l1.length >= n) break;
        l1.push(extra);
    }
    for (const extra of l2.slice(1)) {
        if (l1.length >= n) break;
        l1.push(extra);
    }
    return { l2: shuffled(l2, random), l1: shuffled(l1, random) };
}

function boardHasTruePair(board) {
    const l1Ids = new Set(board.l1.map(p => p.id));
    return board.l2.some(p => l1Ids.has(p.id));
}

function truePairCount(board) {
    const l1Ids = new Set(board.l1.map(p => p.id));
    return board.l2.filter(p => l1Ids.has(p.id)).length;
}

let rngI = 0;
const seq = [0.1, 0.7, 0.3, 0.9, 0.05, 0.55, 0.2, 0.8, 0.4, 0.65, 0.15, 0.95, 0.45, 0.25, 0.85];
function rng() {
    const v = seq[rngI % seq.length];
    rngI += 1;
    return v;
}

let failed = 0;
function assert(cond, label) {
    if (!cond) {
        failed += 1;
        console.error('FAIL', label);
    } else console.log('ok  ', label);
}

const items = [
    { id: 'w1', type: 'word', chinese: '你好', translation: 'oi' },
    { id: '1', type: 'text', chinese: '我自学的', translation: 'Eu aprendi sozinho.', folderPath: '2458' },
    { id: '2', type: 'text', chinese: '她说泰语吗', translation: 'Ela fala tailandês?', folderPath: '2458' },
    { id: '3', type: 'text', chinese: '这是一门简单的语言', translation: 'Esta é uma língua simples.', folderPath: '2458' },
    { id: '4', type: 'text', chinese: '我在学校里学的', translation: 'Eu aprendi na escola.', folderPath: '2458' },
    { id: '5', type: 'text', chinese: '你好吗？', translation: '', folderPath: '2458' },
    { id: '6', type: 'text', chinese: '我自学的', translation: 'duplicata', folderPath: '2458' },
    { id: '7', type: 'text', chinese: 'Guten Tag', translation: 'Bom dia.', folderPath: 'de/1' },
];

const all = collectPhrasePairs(items, []);
assert(all.length === 5, 'skip word, empty translation, duplicate sentence');
assert(!all.some(p => p.id === 'w1' || p.id === '5' || p.id === '6'), 'excluded ids stay out');

const folder = collectPhrasePairs(items, ['2458']);
assert(folder.length === 4, 'folder filter keeps lesson 2458 sentences');
assert(!folder.some(p => p.id === '7'), 'other folder excluded');

assert(decideBoardSize([]) === 0, 'empty size 0');
assert(decideBoardSize(all.slice(0, 1)) === 1, 'single pair → 1');
assert(decideBoardSize(all.slice(0, 2)) === 2, 'two pairs → 2');

const shorts = Array.from({ length: 6 }, (_, i) => ({
    id: 's' + i, sentence: '你好', translation: 'Oi.',
}));
assert(decideBoardSize(shorts) === 4, 'short phrases prefer 4');

const longs = Array.from({ length: 6 }, (_, i) => ({
    id: 'L' + i,
    sentence: '这是一门非常简单但是有一点长的语言句子',
    translation: 'Esta é uma frase propositalmente longa para forçar o tabuleiro menor.',
}));
assert(decideBoardSize(longs) === 3, 'long phrases prefer 3');

const pool10 = Array.from({ length: 10 }, (_, i) => ({
    id: String(i), sentence: 's' + i, translation: 't' + i,
}));
rngI = 0;
const board = buildCombineBoard(pool10, 4, rng);
assert(!!board && board.l2.length === 4 && board.l1.length === 4, 'board 4×4');
assert(boardHasTruePair(board), '≥1 true pair');
assert(truePairCount(board) >= 1, 'pair count ≥1');
const l2Ids = new Set(board.l2.map(p => p.id));
const distractors = board.l1.filter(p => !l2Ids.has(p.id));
assert(distractors.length >= 1, 'when pool > size, some L1 are distractors');

const tiny = [pool10[0]];
const b1 = buildCombineBoard(tiny, 4, rng);
assert(b1.l2.length === 1 && b1.l1[0].id === b1.l2[0].id, 'last remaining is a single pair');

let remaining = [...pool10];
const matched = [];
while (remaining.length) {
    const size = decideBoardSize(remaining);
    const next = buildCombineBoard(remaining, size, rng);
    assert(next && boardHasTruePair(next), 'refill still has a true pair');
    const l1set = new Set(next.l1.map(p => p.id));
    const hit = next.l2.find(p => l1set.has(p.id));
    assert(!!hit, 'can match one pair');
    assert(!matched.includes(hit.id), 'matched pair does not reappear');
    matched.push(hit.id);
    remaining = remaining.filter(p => p.id !== hit.id);
    const laterBoard = remaining.length ? buildCombineBoard(remaining, decideBoardSize(remaining), rng) : null;
    if (laterBoard) {
        assert(!laterBoard.l2.some(p => p.id === hit.id), 'L2 of completed pair stays out');
        assert(!laterBoard.l1.some(p => p.id === hit.id), 'L1 of completed pair stays out');
    }
}
assert(matched.length === 10, 'session drains the whole pool');

if (failed) {
    console.error(failed, 'failed');
    process.exit(1);
}
console.log('\nall combine-phrases checks passed');
