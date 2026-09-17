import { useEffect, useRef, useState } from 'react';
import { StudyItem, Keyword, SupportedLanguage } from '../../types';
import { localDB, ColorCorrectionToken } from '../../services/localDB';
import {
    applyColorCorrectionPatch,
    COLOR_CORRECTIONS_CHANGE_EVENT,
    isColorJobRunning,
    startColorCorrectionJob,
} from '../../services/colorCorrectionJob';
import { useColorCorrectionJob } from '../../hooks/useColorCorrectionJob';

type SavedWord = { word: string; meaning: string; colorIndex: number };

export function useReadingColorJob(opts: {
    filteredData: StudyItem[];
    savedWordsMap: Map<string, Keyword>;
    wordColorMap: Map<string, number>;
    isColorHighlightEnabled: boolean;
    setIsColorHighlightEnabled: (enabled: boolean) => void;
    cleanPunctuation: (text: string) => string;
}) {
    const { isRunning: isCorrectingColors } = useColorCorrectionJob();
    const [colorCorrections, setColorCorrections] = useState<Map<string, ColorCorrectionToken[]>>(new Map());

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const profile = await localDB.getProfile();
                const stored = profile.colorCorrections;
                if (!cancelled && stored && Object.keys(stored).length > 0) {
                    setColorCorrections(prev => {
                        const next = new Map(Object.entries(stored));
                        prev.forEach((tokens, id) => next.set(id, tokens));
                        return next;
                    });
                }
                const legacy = localStorage.getItem('colorCorrections');
                if (legacy) {
                    try {
                        const parsed: [string, ColorCorrectionToken[]][] = JSON.parse(legacy);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            const merged: Record<string, ColorCorrectionToken[]> = { ...(stored || {}) };
                            for (const [k, v] of parsed) merged[k] = v;
                            await localDB.updateProfile({ colorCorrections: merged });
                            if (!cancelled) setColorCorrections(new Map(Object.entries(merged)));
                        }
                    } catch (e) {
                        console.warn('Falha ao migrar colorCorrections legados:', e);
                    }
                    localStorage.removeItem('colorCorrections');
                }
            } catch (e) {
                console.error('Erro ao hidratar colorCorrections do localDB:', e);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const onChange = (event: Event) => {
            const detail = (event as CustomEvent<Record<string, ColorCorrectionToken[]>>).detail;
            if (!detail) return;
            setColorCorrections(new Map(Object.entries(detail)));
        };
        window.addEventListener(COLOR_CORRECTIONS_CHANGE_EVENT, onChange);
        return () => window.removeEventListener(COLOR_CORRECTIONS_CHANGE_EVENT, onChange);
    }, []);

    const handleCorrectColors = async (sentenceIdsSubset?: string[]) => {
        if (isColorJobRunning() || isCorrectingColors) return;
        const subsetSet = sentenceIdsSubset ? new Set(sentenceIdsSubset) : null;
        const sentencesForAI = opts.filteredData
            .filter(item => item.translation)
            .filter(item => !subsetSet || subsetSet.has(item.id.toString()))
            .map(item => {
                const savedWords: SavedWord[] = [];
                item.tokens.forEach(token => {
                    const clean = opts.cleanPunctuation(token).toLowerCase();
                    const kw = opts.savedWordsMap.get(clean);
                    const colorIdx = opts.wordColorMap.get(clean);
                    if (kw && colorIdx !== undefined && kw.meaning) {
                        if (!savedWords.some(sw => sw.word === kw.word)) {
                            savedWords.push({ word: kw.word, meaning: kw.meaning, colorIndex: colorIdx });
                        }
                    }
                });
                return {
                    sentenceId: item.id.toString(),
                    originalText: item.chinese,
                    translation: item.translation || '',
                    savedWords,
                };
            })
            .filter(s => s.savedWords.length > 0);
        if (sentencesForAI.length === 0) {
            alert('Nenhuma palavra salva encontrada nos textos filtrados.');
            return;
        }
        const counts: Record<string, number> = {};
        opts.filteredData.forEach(item => {
            const lang = item.language || 'zh';
            counts[lang] = (counts[lang] || 0) + 1;
        });
        const predominantLang = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as SupportedLanguage) || 'zh';
        if (!opts.isColorHighlightEnabled) opts.setIsColorHighlightEnabled(true);
        startColorCorrectionJob(sentencesForAI, predominantLang).catch(error => {
            console.error('[ColorCorrection] Erro:', error);
        });
    };

    return { isCorrectingColors, colorCorrections, handleCorrectColors, applyColorCorrectionPatch };
}
