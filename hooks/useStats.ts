import { useState, useEffect } from 'react';
import { Stats } from '../types';

export const useStats = () => {
    const [stats, setStats] = useState<Stats>({ correct: 0, wrong: 0, history: [], wordCounts: {} });

    useEffect(() => {
        try {
            const saved = localStorage.getItem('mandarin_hsk_stats');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (!parsed.wordCounts) parsed.wordCounts = {};
                setStats(parsed);
            }
        } catch (e) {
            console.error("Failed to load stats", e);
        }
    }, []);

    const recordResult = (isCorrect: boolean, word: string, type: 'general' | 'pronunciation' = 'general', outcome?: 'correct' | 'partial' | 'wrong') => {
        setStats(prev => {
            if (outcome === 'partial') {
                const newStats: Stats = { ...prev, partial: (prev.partial || 0) + 1 };
                localStorage.setItem('mandarin_hsk_stats', JSON.stringify(newStats));
                return newStats;
            }
            const currentCounts = prev.wordCounts || {};
            const newCount = !isCorrect ? (currentCounts[word] || 0) + 1 : (currentCounts[word] || 0);

            const newStats: Stats = {
                ...prev, // MANTÉM OS CAMPOS ANTIGOS, COMO favoriteConfigs
                correct: (prev.correct || 0) + (isCorrect ? 1 : 0),
                wrong: (prev.wrong || 0) + (!isCorrect ? 1 : 0),
                history: !isCorrect
                    ? [{ word, date: new Date().toLocaleDateString('pt-BR'), time: new Date().toLocaleTimeString('pt-BR'), type }, ...(prev.history || [])].slice(0, 50)
                    : (prev.history || []),
                wordCounts: { ...currentCounts, [word]: newCount }
            };
            localStorage.setItem('mandarin_hsk_stats', JSON.stringify(newStats));
            return newStats;
        });
    };

    const toggleIgnoredReviewWord = (word: string) => {
        setStats(prev => {
            const currentIgnored = prev.ignoredReviewWords || [];
            const isIgnored = currentIgnored.includes(word);

            const newIgnored = isIgnored
                ? currentIgnored.filter(w => w !== word)
                : [...currentIgnored, word];

            const newStats: Stats = {
                ...prev,
                ignoredReviewWords: newIgnored
            };
            localStorage.setItem('mandarin_hsk_stats', JSON.stringify(newStats));
            return newStats;
        });
    };

    const clearStats = () => {
        const empty: Stats = { correct: 0, wrong: 0, partial: 0, history: [], wordCounts: {}, ignoredReviewWords: [] };
        setStats(empty);
        localStorage.setItem('mandarin_hsk_stats', JSON.stringify(empty));
    };

    return { stats, recordResult, clearStats, toggleIgnoredReviewWord };
};