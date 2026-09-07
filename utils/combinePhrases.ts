import { StudyItem, SupportedLanguage } from '../types';

export interface PhrasePair {
    id: string;
    sentence: string;
    translation: string;
    language?: SupportedLanguage;
}

export interface CombineBoard {
    l2: PhrasePair[];
    l1: PhrasePair[];
}

export function itemMatchesFolderFilters(item: StudyItem, filters: string[]): boolean {
    if (!filters.length) return true;
    if (filters.includes('__uncategorized__') && !item.folderPath) return true;
    return filters.some(filterPath => {
        if (filterPath === '__uncategorized__') return false;
        return item.folderPath === filterPath || !!item.folderPath?.startsWith(filterPath + '/');
    });
}

/** Unique sentence+translation pairs for Combinar frases (skip word cards and empty L1). */
export function collectPhrasePairs(items: StudyItem[], folderFilters: string[] = []): PhrasePair[] {
    const seen = new Set<string>();
    const out: PhrasePair[] = [];
    for (const item of items) {
        if (item.type === 'word') continue;
        if (!itemMatchesFolderFilters(item, folderFilters)) continue;
        const sentence = (item.chinese || '').trim();
        const translation = (item.translation || '').trim();
        if (!sentence || !translation) continue;
        const key = sentence.normalize('NFKC');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
            id: item.id.toString(),
            sentence,
            translation,
            language: item.language,
        });
    }
    return out;
}

export function shuffleInPlace<T>(arr: T[], random: () => number = Math.random): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function shuffled<T>(arr: T[], random: () => number = Math.random): T[] {
    return shuffleInPlace([...arr], random);
}

/**
 * 4 cards when phrases are short; 3 when long so they stay readable.
 * Never larger than the remaining pool.
 */
export function decideBoardSize(phrases: PhrasePair[]): number {
    if (phrases.length <= 1) return phrases.length;
    if (phrases.length === 2) return 2;
    const avgL2 = phrases.reduce((s, p) => s + p.sentence.length, 0) / phrases.length;
    const maxL2 = Math.max(...phrases.map(p => p.sentence.length));
    const maxL1 = Math.max(...phrases.map(p => p.translation.length));
    const long = avgL2 >= 16 || maxL2 >= 24 || maxL1 >= 52;
    return Math.min(long ? 3 : 4, phrases.length);
}

/**
 * Build a board with `size` L2 cards and `size` L1 cards.
 * Guarantees ≥1 true pair. Extra L1s prefer unmatched remaining items (distractors).
 */
export function buildCombineBoard(
    remaining: PhrasePair[],
    size: number,
    random: () => number = Math.random
): CombineBoard | null {
    if (!remaining.length) return null;
    const n = Math.max(1, Math.min(size, remaining.length));
    const pool = shuffled(remaining, random);
    const l2 = pool.slice(0, n);
    const l2Ids = new Set(l2.map(p => p.id));
    const outside = pool.filter(p => !l2Ids.has(p.id));

    const l1: PhrasePair[] = [l2[0]];
    for (const extra of outside) {
        if (l1.length >= n) break;
        l1.push(extra);
    }
    for (const extra of l2.slice(1)) {
        if (l1.length >= n) break;
        l1.push(extra);
    }

    return {
        l2: shuffled(l2, random),
        l1: shuffled(l1, random),
    };
}

export function boardHasTruePair(board: CombineBoard): boolean {
    const l1Ids = new Set(board.l1.map(p => p.id));
    return board.l2.some(p => l1Ids.has(p.id));
}

export function truePairCount(board: CombineBoard): number {
    const l1Ids = new Set(board.l1.map(p => p.id));
    return board.l2.filter(p => l1Ids.has(p.id)).length;
}
