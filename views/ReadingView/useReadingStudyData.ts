import { useMemo } from 'react';
import { StudyItem, Keyword } from '../../types';
import { extractFolderPaths } from '../../services/folderService';
import { HIGHLIGHT_COLORS } from './shared';
import { analyzeSentenceWords, DifficultyLevel, SentenceWordAnalysis } from './newWordsUtils';

export function useReadingStudyData(opts: {
    data: StudyItem[];
    savedIds: string[];
    activeFolderFilters: string[];
    reorderMode: boolean;
    localReorderData: StudyItem[];
    difficultyFilter: DifficultyLevel | 'all';
    selectionMode: boolean;
}) {
    const wordColorMap = useMemo(() => {
        const map = new Map<string, number>();
        let colorIndex = 0;
        const consider = (rawWord: string) => {
            const key = (rawWord || '').toLowerCase().trim();
            if (key && !map.has(key)) {
                map.set(key, colorIndex % HIGHLIGHT_COLORS.length);
                colorIndex++;
            }
        };
        for (let idx = opts.data.length - 1; idx >= 0; idx--) {
            const item = opts.data[idx];
            item.keywords?.forEach(k => {
                if (opts.savedIds.includes(k.id)) consider(k.word);
            });
            const tokenCount = item.tokens?.length || 0;
            const isWordCard = item.type === 'word' || (tokenCount === 1 && opts.savedIds.includes(item.id.toString()));
            if (isWordCard) consider(item.chinese);
        }
        return map;
    }, [opts.data, opts.savedIds]);

    const existingFolders = useMemo(() => extractFolderPaths(opts.data), [opts.data]);
    const filteredData = useMemo(() => {
        let result = opts.data.filter(item => item.type !== 'word');
        if (opts.activeFolderFilters.length > 0) {
            result = result.filter(item => {
                if (opts.activeFolderFilters.includes('__uncategorized__')) {
                    if (!item.folderPath) return true;
                }
                return opts.activeFolderFilters.includes(item.folderPath || '');
            });
        }
        return result;
    }, [opts.data, opts.activeFolderFilters]);

    const savedWordsMap = useMemo(() => {
        const map = new Map<string, Keyword>();
        opts.data.forEach(item => {
            item.keywords?.forEach(k => {
                if (opts.savedIds.includes(k.id) && k.word) map.set(k.word.toLowerCase().trim(), k);
            });
            const isWordCard = item.type === 'word' || ((item.tokens?.length || 0) === 1 && opts.savedIds.includes(item.id.toString()));
            if (isWordCard && item.chinese) {
                map.set(item.chinese.toLowerCase().trim(), {
                    id: item.id.toString(),
                    word: item.chinese,
                    pinyin: item.pinyin,
                    meaning: item.translation,
                    language: item.language,
                });
            }
        });
        return map;
    }, [opts.data, opts.savedIds]);

    const meaningPool = useMemo(() => {
        const meanings: string[] = [];
        savedWordsMap.forEach(kw => { if (kw.meaning?.trim()) meanings.push(kw.meaning.trim()); });
        opts.data.forEach(item => {
            item.keywords?.forEach(k => { if (k.meaning?.trim()) meanings.push(k.meaning.trim()); });
        });
        return Array.from(new Set(meanings));
    }, [opts.data, savedWordsMap]);

    const sentenceAnalysisMap = useMemo(() => {
        const map = new Map<string, SentenceWordAnalysis>();
        filteredData.forEach(item => {
            map.set(item.id.toString(), analyzeSentenceWords(item, savedWordsMap));
        });
        return map;
    }, [filteredData, savedWordsMap]);

    const difficultyCounts = useMemo(() => {
        const counts = { easy: 0, medium: 0, hard: 0 };
        sentenceAnalysisMap.forEach(a => { counts[a.difficulty] += 1; });
        return counts;
    }, [sentenceAnalysisMap]);

    const studyList = useMemo(() => {
        const base = opts.reorderMode ? opts.localReorderData : filteredData;
        if (opts.difficultyFilter === 'all' || opts.reorderMode || opts.selectionMode) return base;
        return base.filter(item => sentenceAnalysisMap.get(item.id.toString())?.difficulty === opts.difficultyFilter);
    }, [opts.reorderMode, opts.localReorderData, filteredData, opts.difficultyFilter, opts.selectionMode, sentenceAnalysisMap]);

    return {
        wordColorMap,
        existingFolders,
        filteredData,
        savedWordsMap,
        meaningPool,
        sentenceAnalysisMap,
        difficultyCounts,
        studyList,
    };
}
