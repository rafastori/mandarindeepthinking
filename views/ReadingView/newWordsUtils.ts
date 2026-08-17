import { Keyword, StudyItem } from '../../types';
import { cleanPunctuation, formatTokensToText } from './shared';

const PUNCTUATION_RE = /^[.,!?;:。，！？；：、…·〜～「」『』（）()\[\]{}""''""''‹›«»\-–—_/\\]+$/;

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface TokenWordInfo {
    token: string;
    clean: string;
    cleanLower: string;
    isPunctuation: boolean;
    isSaved: boolean;
    meaning?: string;
    pinyin?: string;
}

export interface SentenceWordAnalysis {
    sentenceId: string;
    contentWords: TokenWordInfo[];
    newWords: TokenWordInfo[];
    knownWords: TokenWordInfo[];
    newCount: number;
    difficulty: DifficultyLevel;
}

export const isPunctuationToken = (token: string): boolean => {
    const clean = cleanPunctuation(token);
    return !clean || PUNCTUATION_RE.test(token.trim());
};

export const getDifficulty = (newCount: number): DifficultyLevel => {
    if (newCount <= 2) return 'easy';
    if (newCount <= 4) return 'medium';
    return 'hard';
};

export const DIFFICULTY_META: Record<DifficultyLevel, {
    label: string;
    short: string;
    className: string;
    hint: string;
}> = {
    easy: {
        label: 'Leve',
        short: '1–2 novas',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        hint: 'Poucas palavras novas — ritmo ideal',
    },
    medium: {
        label: 'Médio',
        short: '3–4 novas',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        hint: 'Um pouco carregado — foque nas novas',
    },
    hard: {
        label: 'Pesado',
        short: '5+ novas',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
        hint: 'Muitas novas — vale dividir ou só olhar 1–2',
    },
};

/** Resolve meaning for a token from saved map or item keywords. */
export const resolveTokenMeaning = (
    cleanLower: string,
    item: StudyItem,
    savedWordsMap: Map<string, Keyword>
): { meaning?: string; pinyin?: string } => {
    const saved = savedWordsMap.get(cleanLower);
    if (saved?.meaning) {
        return { meaning: saved.meaning, pinyin: saved.pinyin };
    }
    const kw = item.keywords?.find(k => cleanPunctuation(k.word).toLowerCase() === cleanLower);
    if (kw?.meaning) {
        return { meaning: kw.meaning, pinyin: kw.pinyin };
    }
    return {};
};

export const analyzeSentenceWords = (
    item: StudyItem,
    savedWordsMap: Map<string, Keyword>
): SentenceWordAnalysis => {
    const seen = new Set<string>();
    const contentWords: TokenWordInfo[] = [];

    for (const token of item.tokens || []) {
        if (isPunctuationToken(token)) continue;
        const clean = cleanPunctuation(token);
        const cleanLower = clean.toLowerCase();
        if (!cleanLower || seen.has(cleanLower)) continue;
        seen.add(cleanLower);

        const isSaved = savedWordsMap.has(cleanLower);
        const resolved = resolveTokenMeaning(cleanLower, item, savedWordsMap);

        contentWords.push({
            token,
            clean,
            cleanLower,
            isPunctuation: false,
            isSaved,
            meaning: resolved.meaning,
            pinyin: resolved.pinyin,
        });
    }

    const newWords = contentWords.filter(w => !w.isSaved);
    const knownWords = contentWords.filter(w => w.isSaved);
    const newCount = newWords.length;

    return {
        sentenceId: item.id.toString(),
        contentWords,
        newWords,
        knownWords,
        newCount,
        difficulty: getDifficulty(newCount),
    };
};

export interface MicroQuizQuestion {
    word: string;
    pinyin?: string;
    correctMeaning: string;
    options: string[];
    isNewWord: boolean;
}

const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const pickRandomWord = (
    pool: TokenWordInfo[],
    excludeWord?: string
): TokenWordInfo | undefined => {
    if (pool.length === 0) return undefined;
    const exclude = excludeWord?.toLowerCase();
    const choices = exclude
        ? pool.filter(w => w.cleanLower !== exclude && w.clean.toLowerCase() !== exclude)
        : pool;
    if (choices.length === 0) return undefined;
    return choices[Math.floor(Math.random() * choices.length)];
};

/**
 * Builds a one-tap meaning quiz for a sentence.
 * Sorteia entre palavras novas que já têm significado (keywords/cards);
 * se não houver, sorteia entre as já salvas da mesma frase.
 */
export const buildMicroQuiz = (
    analysis: SentenceWordAnalysis,
    meaningPool: string[],
    excludeWord?: string
): MicroQuizQuestion | null => {
    const withMeaningNew = analysis.newWords.filter(w => w.meaning && w.meaning.trim().length > 0);
    const withMeaningKnown = analysis.knownWords.filter(w => w.meaning && w.meaning.trim().length > 0);
    const target = pickRandomWord(withMeaningNew, excludeWord)
        || pickRandomWord(withMeaningKnown, excludeWord)
        || pickRandomWord(withMeaningNew)
        || pickRandomWord(withMeaningKnown);
    if (!target?.meaning) return null;

    const correct = target.meaning.trim();
    const distractors = meaningPool
        .map(m => m.trim())
        .filter(m => m.length > 0 && m.toLowerCase() !== correct.toLowerCase());

    const uniqueDistractors = Array.from(new Set(distractors));
    const picked = shuffle(uniqueDistractors).slice(0, 2);

    // Need at least 1 distractor to be a real choice; invent soft fallbacks if pool is tiny
    while (picked.length < 2) {
        const fallbacks = ['(outra ideia)', 'não sei ainda', 'parece familiar'];
        const next = fallbacks[picked.length];
        if (!picked.includes(next) && next.toLowerCase() !== correct.toLowerCase()) {
            picked.push(next);
        } else {
            break;
        }
    }

    if (picked.length === 0) return null;

    return {
        word: target.clean,
        pinyin: target.pinyin,
        correctMeaning: correct,
        options: shuffle([correct, ...picked]),
        isNewWord: !target.isSaved,
    };
};

/** Max new words per chunk after split — keeps pieces in the "leve" band. */
export const SPLIT_TARGET_NEW_WORDS = 2;

const STRONG_BREAK_RE = /^[。！？!?；;]$/;
const SOFT_BREAK_RE = /^[，,、]$/;

const countNewInTokens = (
    tokens: string[],
    savedWordsMap: Map<string, Keyword>
): number => {
    const seen = new Set<string>();
    let n = 0;
    for (const token of tokens) {
        if (isPunctuationToken(token)) continue;
        const cleanLower = cleanPunctuation(token).toLowerCase();
        if (!cleanLower || seen.has(cleanLower)) continue;
        seen.add(cleanLower);
        if (!savedWordsMap.has(cleanLower)) n += 1;
    }
    return n;
};

/** Split token list after strong (and optionally soft) punctuation. */
export const splitTokenSegments = (
    tokens: string[],
    allowSoftBreaks: boolean
): string[][] => {
    const segments: string[][] = [];
    let current: string[] = [];
    for (const token of tokens) {
        current.push(token);
        const trimmed = token.trim();
        const isBreak = STRONG_BREAK_RE.test(trimmed) || (allowSoftBreaks && SOFT_BREAK_RE.test(trimmed));
        if (isBreak && current.length > 0) {
            segments.push(current);
            current = [];
        }
    }
    if (current.length > 0) segments.push(current);
    return segments.filter(seg => seg.some(t => !isPunctuationToken(t)));
};

/**
 * Pack tokens so each chunk has at most `maxNew` unique unsaved words.
 * Keeps trailing punctuation with the preceding content.
 */
export const packTokensByNewWordBudget = (
    tokens: string[],
    savedWordsMap: Map<string, Keyword>,
    maxNew: number = SPLIT_TARGET_NEW_WORDS
): string[][] => {
    const chunks: string[][] = [];
    let current: string[] = [];
    const seenInChunk = new Set<string>();
    let newInChunk = 0;

    const flush = () => {
        if (current.length === 0) return;
        chunks.push(current);
        current = [];
        seenInChunk.clear();
        newInChunk = 0;
    };

    for (const token of tokens) {
        if (isPunctuationToken(token)) {
            if (current.length === 0 && chunks.length > 0) {
                chunks[chunks.length - 1].push(token);
            } else {
                current.push(token);
            }
            continue;
        }

        const cleanLower = cleanPunctuation(token).toLowerCase();
        const isNew = cleanLower && !savedWordsMap.has(cleanLower) && !seenInChunk.has(cleanLower);
        if (isNew && newInChunk >= maxNew && current.some(t => !isPunctuationToken(t))) {
            flush();
        }

        current.push(token);
        if (cleanLower && !seenInChunk.has(cleanLower)) {
            seenInChunk.add(cleanLower);
            if (!savedWordsMap.has(cleanLower)) newInChunk += 1;
        }
    }
    flush();
    return chunks.filter(c => c.some(t => !isPunctuationToken(t)));
};

const splitTranslationAcross = (translation: string, partCount: number): string[] => {
    const text = (translation || '').trim();
    if (partCount <= 1) return [text];
    if (!text) return Array.from({ length: partCount }, () => '');

    const clauseParts = text.split(/(?<=[.!?。！？;；])\s+/).map(s => s.trim()).filter(Boolean);
    if (clauseParts.length === partCount) return clauseParts;

    // Proportional by character length
    const total = text.length;
    const out: string[] = [];
    let cursor = 0;
    for (let i = 0; i < partCount; i++) {
        if (i === partCount - 1) {
            out.push(text.slice(cursor).trim());
            break;
        }
        const ideal = Math.round((total * (i + 1)) / partCount);
        let cut = ideal;
        // Prefer breaking on spaces near the ideal point
        const windowStart = Math.max(cursor + 1, ideal - 18);
        const windowEnd = Math.min(text.length - 1, ideal + 18);
        let best = -1;
        for (let j = windowStart; j <= windowEnd; j++) {
            if (/\s/.test(text[j])) {
                if (best === -1 || Math.abs(j - ideal) < Math.abs(best - ideal)) best = j;
            }
        }
        if (best !== -1) cut = best + 1;
        out.push(text.slice(cursor, cut).trim());
        cursor = cut;
    }
    return out;
};

const buildPinyinForTokens = (tokens: string[], item: StudyItem): string => {
    const parts: string[] = [];
    for (const token of tokens) {
        if (isPunctuationToken(token)) continue;
        const cleanLower = cleanPunctuation(token).toLowerCase();
        const kw = item.keywords?.find(k => cleanPunctuation(k.word).toLowerCase() === cleanLower);
        if (kw?.pinyin) parts.push(kw.pinyin);
    }
    return parts.join(' ');
};

const keywordsForTokens = (tokens: string[], item: StudyItem): Keyword[] => {
    if (!item.keywords?.length) return [];
    const present = new Set(
        tokens
            .filter(t => !isPunctuationToken(t))
            .map(t => cleanPunctuation(t).toLowerCase())
            .filter(Boolean)
    );
    return item.keywords.filter(k => present.has(cleanPunctuation(k.word).toLowerCase()));
};

export interface SplitProposal {
    chunks: Array<Omit<StudyItem, 'id'>>;
    strategy: 'punctuation' | 'budget';
}

/**
 * Propose splitting a heavy sentence into lighter pieces (≤2 new words each when possible).
 * Returns null if the sentence is not hard or cannot be usefully split.
 */
export const proposeSentenceSplit = (
    item: StudyItem,
    savedWordsMap: Map<string, Keyword>,
    maxNew: number = SPLIT_TARGET_NEW_WORDS
): SplitProposal | null => {
    const analysis = analyzeSentenceWords(item, savedWordsMap);
    if (analysis.difficulty !== 'hard') return null;
    if ((item.tokens?.length || 0) < 4) return null;

    let strategy: SplitProposal['strategy'] = 'budget';
    let segments = splitTokenSegments(item.tokens, false);

    const segmentsOk = (segs: string[][]) =>
        segs.length >= 2 && segs.every(seg => countNewInTokens(seg, savedWordsMap) <= Math.max(maxNew, 3));

    if (segmentsOk(segments)) {
        strategy = 'punctuation';
    } else {
        segments = splitTokenSegments(item.tokens, true);
        if (segmentsOk(segments)) {
            strategy = 'punctuation';
        } else {
            segments = packTokensByNewWordBudget(item.tokens, savedWordsMap, maxNew);
            strategy = 'budget';
        }
    }

    if (segments.length < 2) return null;

    // Avoid tiny leftover crumbs: merge last segment if it has 0 content words alone... already filtered
    // Merge if a segment has 0 new and only 1 content word into previous? Optional — skip for clarity.

    const translations = splitTranslationAcross(item.translation || '', segments.length);
    const chunks: Array<Omit<StudyItem, 'id'>> = segments.map((tokens, i) => {
        const chinese = formatTokensToText(tokens);
        return {
            chinese,
            pinyin: buildPinyinForTokens(tokens, item),
            translation: translations[i] || '',
            tokens,
            keywords: keywordsForTokens(tokens, item),
            language: item.language,
            type: 'text' as const,
            folderPath: item.folderPath,
            originalSentence: item.chinese,
        };
    });

    return { chunks, strategy };
};

