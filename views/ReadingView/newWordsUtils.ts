import { Keyword, StudyItem } from '../../types';
import { cleanPunctuation } from './shared';

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

/**
 * Builds a one-tap meaning quiz for a sentence.
 * Prefers a new word that already has a meaning (keywords);
 * falls back to a known saved word.
 */
export const buildMicroQuiz = (
    analysis: SentenceWordAnalysis,
    meaningPool: string[]
): MicroQuizQuestion | null => {
    const withMeaningNew = analysis.newWords.filter(w => w.meaning && w.meaning.trim().length > 0);
    const withMeaningKnown = analysis.knownWords.filter(w => w.meaning && w.meaning.trim().length > 0);
    const target = withMeaningNew[0] || withMeaningKnown[0];
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
