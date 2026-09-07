/**
 * Similaridade textual para Prática (áudio → tradução / escrita).
 *
 * score local ∈ [0, 1]:
 *   escrita (L2):  0.70 * razão de Levenshtein + 0.30 * Jaccard
 *                  (após NFKC, largura, pontuação e espaços)
 *   tradução (L1): 0.35 * razão de Levenshtein + 0.65 * Jaccard de tokens
 *                  (o sentido importa mais que o wording literal)
 */

export const PRACTICE_SCORE = {
    CORRECT: 0.80,
    ALMOST: 0.55,
} as const;

export type PracticeGrade = 'correct' | 'almost' | 'wrong';
export type DiffKind = 'equal' | 'add' | 'del';
export type DiffMark = { text: string; kind: DiffKind };

const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/;
const PUNCT_RE = /[\u2000-\u206f\u3000-\u303f\uff00-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65\p{P}\p{S}]/gu;

export function clamp01(n: number): number {
    if (Number.isNaN(n)) return 0;
    return Math.min(1, Math.max(0, n));
}

export function hasCjk(text: string): boolean {
    return CJK_RE.test(text || '');
}

/** Fullwidth ASCII (！Ａ etc.) → halfwidth; ideographic space → space. */
export function toHalfWidth(text: string): string {
    return (text || '')
        .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/\u3000/g, ' ');
}

export function collapseSpaces(text: string): string {
    return (text || '').replace(/\s+/g, ' ').trim();
}

/** Visual normalize for diffs: NFKC + width + collapsed spaces. Keeps letters/CJK. */
export function normalizeForDiff(text: string): string {
    return collapseSpaces(toHalfWidth((text || '').normalize('NFKC')));
}

/** Strict normalize for scoring L2 writing: also drop punctuation and case. */
export function normalizeForWriting(text: string): string {
    return collapseSpaces(
        toHalfWidth((text || '').normalize('NFKC'))
            .replace(PUNCT_RE, ' ')
            .toLowerCase()
    ).replace(/\s+/g, '');
}

/** Token normalize for L1 translation: keep words, drop punct, lowercase. */
export function normalizeForTranslation(text: string): string {
    return collapseSpaces(
        toHalfWidth((text || '').normalize('NFKC'))
            .replace(PUNCT_RE, ' ')
            .toLowerCase()
    );
}

export function levenshtein(a: string, b: string): number {
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

/** 1 - dist / max(len). Empty vs empty = 1. */
export function levenshteinRatio(a: string, b: string): number {
    if (!a && !b) return 1;
    const max = Math.max(a.length, b.length);
    if (max === 0) return 1;
    return clamp01(1 - levenshtein(a, b) / max);
}

export function tokenizeWords(text: string): string[] {
    return (text || '').split(/\s+/).filter(Boolean);
}

export function tokenizeChars(text: string): string[] {
    return Array.from(text || '');
}

export function jaccard(a: string[], b: string[]): number {
    if (a.length === 0 && b.length === 0) return 1;
    const setA = new Set(a);
    const setB = new Set(b);
    let inter = 0;
    setA.forEach(tok => {
        if (setB.has(tok)) inter += 1;
    });
    const union = setA.size + setB.size - inter;
    return union === 0 ? 1 : clamp01(inter / union);
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
}

export function localWritingScore(expected: string, actual: string): number {
    const e = normalizeForWriting(expected);
    const a = normalizeForWriting(actual);
    const lev = levenshteinRatio(e, a);
    const jac = jaccard(tokenizeChars(e), tokenizeChars(a));
    return clamp01(0.70 * lev + 0.30 * jac);
}

export function localTranslationScore(expected: string, actual: string): number {
    const e = normalizeForTranslation(expected);
    const a = normalizeForTranslation(actual);
    const lev = levenshteinRatio(e, a);
    const jac = jaccard(tokenizeWords(e), tokenizeWords(a));
    return clamp01(0.35 * lev + 0.65 * jac);
}

export function blendPracticeScore(opts: {
    mode: 'audio-traducao' | 'audio-escrita';
    local: number;
    semantic: number | null;
}): { similarity: number; local: number; semantic: number | null; localWeight: number; semanticWeight: number } {
    const local = clamp01(opts.local);
    const semantic = opts.semantic == null ? null : clamp01(opts.semantic);

    if (opts.mode === 'audio-escrita') {
        if (local >= 0.97) {
            return { similarity: 1, local, semantic, localWeight: 1, semanticWeight: 0 };
        }
        if (semantic == null) {
            return { similarity: local, local, semantic, localWeight: 1, semanticWeight: 0 };
        }
        return {
            similarity: clamp01(0.55 * local + 0.45 * semantic),
            local, semantic, localWeight: 0.55, semanticWeight: 0.45,
        };
    }

    if (semantic == null) {
        return { similarity: local, local, semantic, localWeight: 1, semanticWeight: 0 };
    }
    return {
        similarity: clamp01(0.25 * local + 0.75 * semantic),
        local, semantic, localWeight: 0.25, semanticWeight: 0.75,
    };
}

export function gradeFromSimilarity(similarity: number): PracticeGrade {
    if (similarity >= PRACTICE_SCORE.CORRECT) return 'correct';
    if (similarity >= PRACTICE_SCORE.ALMOST) return 'almost';
    return 'wrong';
}

export function diffTokens(expectedTokens: string[], actualTokens: string[]): DiffMark[] {
    const n = expectedTokens.length;
    const m = actualTokens.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            dp[i][j] = expectedTokens[i - 1] === actualTokens[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    const rev: DiffMark[] = [];
    let i = n;
    let j = m;
    while (i > 0 && j > 0) {
        if (expectedTokens[i - 1] === actualTokens[j - 1]) {
            rev.push({ text: expectedTokens[i - 1], kind: 'equal' });
            i -= 1;
            j -= 1;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            rev.push({ text: expectedTokens[i - 1], kind: 'del' });
            i -= 1;
        } else {
            rev.push({ text: actualTokens[j - 1], kind: 'add' });
            j -= 1;
        }
    }
    while (i > 0) {
        i -= 1;
        rev.push({ text: expectedTokens[i], kind: 'del' });
    }
    while (j > 0) {
        j -= 1;
        rev.push({ text: actualTokens[j], kind: 'add' });
    }
    return rev.reverse();
}

export function diffPracticeTexts(expected: string, actual: string, unit: 'char' | 'word'): {
    expected: DiffMark[];
    actual: DiffMark[];
} {
    const eNorm = normalizeForDiff(expected);
    const aNorm = normalizeForDiff(actual);
    const eTok = unit === 'char' ? tokenizeChars(eNorm) : tokenizeWords(eNorm);
    const aTok = unit === 'char' ? tokenizeChars(aNorm) : tokenizeWords(aNorm);
    const marks = diffTokens(eTok, aTok);
    return {
        expected: marks.filter(m => m.kind !== 'add'),
        actual: marks.filter(m => m.kind !== 'del'),
    };
}

export function joinDiffMarks(marks: DiffMark[], unit: 'char' | 'word'): string {
    return marks.map(m => m.text).join(unit === 'char' ? '' : ' ');
}
