import { useState, useEffect, useCallback } from 'react';
import { localDB, LocalProfile } from '../services/localDB';
import { Stats } from '../types';

const defaultStats: Stats = { correct: 0, wrong: 0, history: [], wordCounts: {}, studyMoreIds: [] };

/**
 * useUserProfile - Hook LOCAL-FIRST para gerenciar perfil do usuário.
 * 
 * Stats, savedIds e filtros são armazenados localmente no IndexedDB.
 * O Firebase é usado SOMENTE para Leaderboard (via useLeaderboard) e backup manual.
 */
export const useUserProfile = (userId: string | null | undefined) => {
    const [savedIds, setSavedIds] = useState<string[]>([]);
    const [stats, setStats] = useState<Stats>(defaultStats);
    const [totalScore, setTotalScore] = useState<number>(0);
    const [activeFolderFilters, setActiveFolderFilters] = useState<string[]>([]);
    const [profileLoaded, setProfileLoaded] = useState(false);

    // Carrega perfil do IndexedDB na inicialização
    useEffect(() => {
        if (!userId) {
            setSavedIds([]);
            setStats(defaultStats);
            setActiveFolderFilters([]);
            setProfileLoaded(false);
            return;
        }

        let cancelled = false;

        const loadProfile = async () => {
            try {
                const profile = await localDB.getProfile();
                if (!cancelled) {
                    setSavedIds(profile.savedIds || []);
                    setStats(profile.stats || defaultStats);
                    setTotalScore(profile.totalScore || 0);
                    setActiveFolderFilters(profile.activeFolderFilters || []);
                    setProfileLoaded(true);
                }
            } catch (error) {
                console.error('Erro ao carregar perfil do IndexedDB:', error);
                if (!cancelled) {
                    setProfileLoaded(true); // Marca como carregado mesmo com erro (usa defaults)
                }
            }
        };

        loadProfile();

        return () => { cancelled = true; };
    }, [userId]);

    // Atualiza favoritos
    const updateFavorites = useCallback(async (newIds: string[]) => {
        if (!userId) return;
        setSavedIds(newIds);
        await localDB.updateProfile({ savedIds: newIds });
    }, [userId]);

    // Atualiza stats
    const updateStats = useCallback(async (newStats: Stats) => {
        if (!userId) return;
        setStats(newStats);
        // Calcula totalScore a partir dos points
        const newTotalScore = newStats.points || 0;
        setTotalScore(newTotalScore);
        await localDB.updateProfile({ stats: newStats, totalScore: newTotalScore });
    }, [userId]);

    // Atualiza filtros de pasta
    const updateFolderFilters = useCallback(async (newFilters: string[]) => {
        if (!userId) return;
        setActiveFolderFilters(newFilters);
        await localDB.updateProfile({ activeFolderFilters: newFilters });
    }, [userId]);

    return { savedIds, stats, totalScore, activeFolderFilters, profileLoaded, updateFavorites, updateStats, updateFolderFilters };
};
