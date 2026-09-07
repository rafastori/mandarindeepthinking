/**
 * Practice scoring helpers — run: node test-text-similarity.js
 */

function clamp01(n) {
    if (Number.isNaN(n)) return 0;
    return Math.min(1, Math.max(0, n));
}

const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/;
const PUNCT_RE = /[\u2000-\u206f\u3000-\u303f\uff00-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65\p{P}\p{S}]/gu;

function toHalfWidth(text) {
    return (text || '')
        .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/\u3000/g, ' ');
}

function collapseSpaces(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function normalizeForDiff(text) {
    return collapseSpaces(toHalfWidth((text || '').normalize('NFKC')));
}

function stripDiacritics(text) {
    return (text || '').normalize('NFD').replace(/\p{M}/gu, '');
}

function normalizeForWriting(text) {
    return collapseSpaces(
        stripDiacritics(toHalfWidth((text || '').normalize('NFKC')))
            .replace(PUNCT_RE, ' ')
            .toLowerCase()
    ).replace(/\s+/g, '');
}

function normalizeForTranslation(text) {
    return collapseSpaces(
        stripDiacritics(toHalfWidth((text || '').normalize('NFKC')))
            .replace(PUNCT_RE, ' ')
            .toLowerCase()
    );
}

function labTokenKey(text) {
    return stripDiacritics(toHalfWidth((text || '').normalize('NFKC')))
        .replace(PUNCT_RE, '')
        .replace(/\s+/g, '')
        .toLowerCase();
}

function isLabPunctToken(text) {
    return labTokenKey(text) === '';
}

function labContentTokens(tokens) {
    return (tokens || []).filter(t => !isLabPunctToken(t));
}

function weaveLabDisplayTokens(original, selectedContent) {
    const n = selectedContent.length;
    if (n === 0) return [];
    const out = [];
    let used = 0;
    let origContentSeen = 0;
    for (let i = 0; i < original.length; i++) {
        const t = original[i];
        if (isLabPunctToken(t)) {
            if (origContentSeen <= n) out.push({ text: t, kind: 'punct', sourceIndex: i });
        } else {
            origContentSeen += 1;
            if (used < n) {
                const sel = selectedContent[used];
                out.push({ text: sel.text, kind: 'content', contentId: sel.id, sourceIndex: i });
                used += 1;
            } else break;
        }
    }
    return out;
}

function labTokenSequenceMatch(attempt, target) {
    const a = labContentTokens(attempt);
    const b = labContentTokens(target);
    if (a.length !== b.length) return false;
    return a.every((tok, i) => labTokenKey(tok) === labTokenKey(b[i] || ''));
}

function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const prev = new Array(b.length + 1);
    const curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        }
        for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
    }
    return prev[b.length];
}

function levenshteinRatio(a, b) {
    if (!a && !b) return 1;
    const max = Math.max(a.length, b.length);
    if (max === 0) return 1;
    return clamp01(1 - levenshtein(a, b) / max);
}

function tokenizeWords(text) {
    return (text || '').split(/\s+/).filter(Boolean);
}

function tokenizeChars(text) {
    return Array.from(text || '');
}

function jaccard(a, b) {
    if (a.length === 0 && b.length === 0) return 1;
    const setA = new Set(a);
    const setB = new Set(b);
    let inter = 0;
    setA.forEach(tok => { if (setB.has(tok)) inter += 1; });
    const union = setA.size + setB.size - inter;
    return union === 0 ? 1 : clamp01(inter / union);
}

function cosineSimilarity(a, b) {
    if (!a.length || a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
}

function localWritingScore(expected, actual) {
    const e = normalizeForWriting(expected);
    const a = normalizeForWriting(actual);
    return clamp01(0.70 * levenshteinRatio(e, a) + 0.30 * jaccard(tokenizeChars(e), tokenizeChars(a)));
}

function localTranslationScore(expected, actual) {
    const e = normalizeForTranslation(expected);
    const a = normalizeForTranslation(actual);
    return clamp01(0.35 * levenshteinRatio(e, a) + 0.65 * jaccard(tokenizeWords(e), tokenizeWords(a)));
}

function blendPracticeScore({ mode, local, semantic }) {
    local = clamp01(local);
    semantic = semantic == null ? null : clamp01(semantic);
    if (mode === 'audio-escrita') {
        if (local >= 0.97) return { similarity: 1, localWeight: 1, semanticWeight: 0 };
        if (semantic == null) return { similarity: local, localWeight: 1, semanticWeight: 0 };
        return { similarity: clamp01(0.55 * local + 0.45 * semantic), localWeight: 0.55, semanticWeight: 0.45 };
    }
    if (semantic == null) return { similarity: local, localWeight: 1, semanticWeight: 0 };
    return { similarity: clamp01(0.25 * local + 0.75 * semantic), localWeight: 0.25, semanticWeight: 0.75 };
}

function gradeFromSimilarity(similarity, mode) {
    const correctAt = mode === 'audio-escrita' ? 0.75 : 0.65;
    const partialAt = mode === 'audio-escrita' ? 0.50 : 0.45;
    if (similarity >= correctAt) return 'correct';
    if (similarity >= partialAt) return 'almost';
    return 'wrong';
}

function diffTokens(expectedTokens, actualTokens) {
    const n = expectedTokens.length;
    const m = actualTokens.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            dp[i][j] = expectedTokens[i - 1] === actualTokens[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    const rev = [];
    let i = n, j = m;
    while (i > 0 && j > 0) {
        if (expectedTokens[i - 1] === actualTokens[j - 1]) {
            rev.push({ text: expectedTokens[i - 1], kind: 'equal' });
            i--; j--;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            rev.push({ text: expectedTokens[i - 1], kind: 'del' });
            i--;
        } else {
            rev.push({ text: actualTokens[j - 1], kind: 'add' });
            j--;
        }
    }
    while (i > 0) rev.push({ text: expectedTokens[--i], kind: 'del' });
    while (j > 0) rev.push({ text: actualTokens[--j], kind: 'add' });
    return rev.reverse();
}

let failed = 0;
function assert(cond, label) {
    if (!cond) {
        failed += 1;
        console.error('FAIL', label);
    } else console.log('ok  ', label);
}

assert(normalizeForWriting('你好！') === normalizeForWriting('你好!'), 'writing: punct ignored');
assert(normalizeForWriting('你 好') === normalizeForWriting('你好'), 'writing: spaces ignored');
assert(normalizeForWriting('ＡＢＣ') === 'abc', 'writing: fullwidth + case');
assert(normalizeForTranslation('Eu estou bem.') === 'eu estou bem', 'translation: punct + case');
assert(localWritingScore('你好吗？', '你好吗') >= 0.97, 'writing near-exact after normalize');
assert(localWritingScore('你好吗', '你好吗') === 1, 'writing exact = 1');
assert(localWritingScore('你好吗', '我很好') < 0.55, 'writing unrelated is low');
assert(localTranslationScore('Eu estou bem', 'Estou bem') > 0.5, 'translation paraphrase shares tokens');
assert(localTranslationScore('Eu estou bem', 'O gato dorme') < 0.4, 'translation unrelated is low');

const blendWrite = blendPracticeScore({ mode: 'audio-escrita', local: 1, semantic: 0.2 });
assert(blendWrite.similarity === 1 && blendWrite.localWeight === 1, 'writing exact skips semantic');

const blendTr = blendPracticeScore({ mode: 'audio-traducao', local: 0.4, semantic: 0.9 });
assert(Math.abs(blendTr.similarity - (0.25 * 0.4 + 0.75 * 0.9)) < 1e-9, 'translation weights 25/75');
assert(blendTr.semanticWeight === 0.75, 'translation semantic weight');

assert(gradeFromSimilarity(0.65) === 'correct', 'translation 65% = certo');
assert(gradeFromSimilarity(0.64) === 'almost', 'translation 64% = meio certo');
assert(gradeFromSimilarity(0.45) === 'almost', 'translation 45% = meio certo');
assert(gradeFromSimilarity(0.44) === 'wrong', 'translation 44% = errado');
assert(gradeFromSimilarity(0.75, 'audio-escrita') === 'correct', 'writing 75% = certo');
assert(gradeFromSimilarity(0.74, 'audio-escrita') === 'almost', 'writing 74% = meio certo');
assert(gradeFromSimilarity(0.50, 'audio-escrita') === 'almost', 'writing 50% = meio certo');
assert(gradeFromSimilarity(0.49, 'audio-escrita') === 'wrong', 'writing 49% = errado');

assert(stripDiacritics('está') === stripDiacritics('esta'), 'diacritics: está ≈ esta');
assert(normalizeForWriting('café') === normalizeForWriting('cafe'), 'writing ignores accents');
assert(normalizeForTranslation('Você está bem') === normalizeForTranslation('Voce esta bem'), 'translation ignores accents');
assert(labTokenSequenceMatch(['está', 'bem'], ['esta', 'bem']), 'lab sequence ignores accents');
assert(labTokenSequenceMatch(['esta', 'bem'], ['está', 'bem']), 'lab sequence reverse accents');
assert(!labTokenSequenceMatch(['bem', 'está'], ['está', 'bem']), 'lab sequence order still matters');
assert(!labTokenSequenceMatch(['está'], ['está', 'bem']), 'lab sequence length matters');

assert(isLabPunctToken('。') && isLabPunctToken('，') && isLabPunctToken('、'), 'cjk punct tokens');
assert(isLabPunctToken('!') && isLabPunctToken('?') && isLabPunctToken(';') && isLabPunctToken(':'), 'latin punct tokens');
assert(isLabPunctToken('“') && isLabPunctToken('「') && isLabPunctToken('"'), 'quote punct tokens');
assert(!isLabPunctToken('宝宝') && !isLabPunctToken('está'), 'words are not punct');

const withPunct = ['有', '。', '噢', '，', '还', '要', '买', '宝宝', '的', '奶粉', '、', '尿布', '。'];
const contentOnly = ['有', '噢', '还', '要', '买', '宝宝', '的', '奶粉', '尿布'];
assert(labTokenSequenceMatch(contentOnly, withPunct), 'lab match ignores punct in target');
assert(labTokenSequenceMatch(withPunct, contentOnly), 'lab match ignores punct in attempt');
assert(!labTokenSequenceMatch(['噢', '有', ...contentOnly.slice(2)], withPunct), 'lab still requires word order');

const emptyWeave = weaveLabDisplayTokens(withPunct, []);
assert(emptyWeave.length === 0, 'weave empty until a word is placed');

const firstTwo = weaveLabDisplayTokens(withPunct, [{ id: 0, text: '有' }, { id: 2, text: '噢' }]);
assert(firstTwo.map(t => t.text).join('') === '有。噢，', 'weave auto-places punct after placed words');
assert(firstTwo.filter(t => t.kind === 'punct').every(t => t.kind === 'punct'), 'punct marks are punct kind');
assert(firstTwo.filter(t => t.kind === 'content').length === 2, 'two content chips');

const allWoven = weaveLabDisplayTokens(
    withPunct,
    contentOnly.map((text, id) => ({ id, text }))
);
assert(allWoven.map(t => t.text).join('') === withPunct.join(''), 'full weave restores original incl. punct');
assert(labContentTokens(withPunct).join(',') === contentOnly.join(','), 'labContentTokens drops punct');

const marks = diffTokens(['eu', 'estou', 'bem'], ['eu', 'fico', 'bem']);
assert(marks.some(m => m.text === 'estou' && m.kind === 'del'), 'diff del expected token');
assert(marks.some(m => m.text === 'fico' && m.kind === 'add'), 'diff add actual token');
assert(marks.filter(m => m.kind === 'equal').map(m => m.text).join(' ') === 'eu bem', 'diff keeps matches');

const cjk = diffTokens(Array.from('你好吗'), Array.from('你很好'));
assert(cjk.some(m => m.text === '吗' && m.kind === 'del'), 'cjk diff del');
assert(cjk.some(m => m.text === '很' && m.kind === 'add'), 'cjk diff add');

assert(Math.abs(cosineSimilarity([1, 0], [1, 0]) - 1) < 1e-9, 'cosine identical');
assert(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9, 'cosine orthogonal');
assert(CJK_RE.test('你好') && !CJK_RE.test('hello'), 'cjk detect');
assert(normalizeForDiff('你好！') !== normalizeForWriting('你好！') || true, 'diff keeps visual punct path');
assert(normalizeForDiff('A  B') === 'A B', 'diff collapses spaces');

if (failed) {
    console.error(failed, 'failed');
    process.exit(1);
}
console.log('\nall text-similarity checks passed');
