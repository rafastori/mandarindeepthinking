import { useState, useEffect, useCallback } from 'react';
import { localDB, LocalProfile } from '../services/localDB';
import { Stats } from '../types';

const defaultStats: Stats = { correct: 0, wrong: 0, history: [], wordCounts: {}, studyMoreIds: [], favoriteConfigs: {} };

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

                    let loadedStats = profile.stats || defaultStats;

                    // --- MIGRATION: studyMoreIds -> favoriteConfigs ---
                    if (loadedStats.studyMoreIds && loadedStats.studyMoreIds.length > 0) {
                        const migratedConfigs = { ...(loadedStats.favoriteConfigs || {}) };
                        let hasMigration = false;

                        loadedStats.studyMoreIds.forEach(id => {
                            if (!migratedConfigs[id]) {
                                migratedConfigs[id] = {
                                    id,
                                    mode: 'relative',
                                    relativeMultiplier: 2
                                };
                                hasMigration = true;
                            }
                        });

                        if (hasMigration) {
                            loadedStats = {
                                ...loadedStats,
                                favoriteConfigs: migratedConfigs,
                                studyMoreIds: [] // Limpa o antigo para não migrar de novo
                            };

                            // Salva a migração silenciosamente
                            localDB.updateProfile({ stats: loadedStats });
                        }
                    }

                    setStats(loadedStats);
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

    // Atualiza stats de forma segura contra closures desatualizados
    const updateStats = useCallback(async (newStats: Stats) => {
        if (!userId) return;
        try {
            // Busca a última versão em disco antes de injetar novidades
            const currentProfile = await localDB.getProfile();
            const currentStats = (currentProfile.stats || {}) as Partial<Stats>;

            // Note: newStats já carrega campos atualizados pelas UI.
            // Para não sobrescrever favoritos com oldState da UI, a UI de fato
            // já deve usar a versão segura local. A junção abaixo garante que
            // chaves ignoradas na UI pela desatualização sejam preservadas se existirem no disco.
            const mergedStats = { ...currentStats, ...newStats } as Stats;

            // Protege configuração de favoritos caso a UI tenha enviado sem (minigames desatualizados)
            if (!newStats.favoriteConfigs && currentStats.favoriteConfigs) {
                mergedStats.favoriteConfigs = currentStats.favoriteConfigs;
            }

            setStats(mergedStats);
            const newTotalScore = mergedStats.points || 0;
            setTotalScore(newTotalScore);
            await localDB.updateProfile({ stats: mergedStats, totalScore: newTotalScore });
        } catch (err) {
            console.error('Erro ao fundir stats seguros:', err);
        }
    }, [userId]);

    // Atualiza filtros de pasta
    const updateFolderFilters = useCallback(async (newFilters: string[]) => {
        if (!userId) return;
        setActiveFolderFilters(newFilters);
        await localDB.updateProfile({ activeFolderFilters: newFilters });
    }, [userId]);

    // Atualiza configurações de favoritos
    const updateFavoriteConfig = useCallback(async (configOrConfigs: any) => {
        if (!userId) return;

        try {
            const currentProfile = await localDB.getProfile();
            const currentStats = (currentProfile.stats || {}) as Partial<Stats>;

            let newFavoriteConfigs = { ...(currentStats.favoriteConfigs || {}) };

            if (Array.isArray(configOrConfigs)) {
                configOrConfigs.forEach((config: import('../types').FavoriteConfig) => {
                    if (config.id) {
                        if ('remove' in config && config.remove) {
                            delete newFavoriteConfigs[config.id];
                        } else {
                            newFavoriteConfigs[config.id] = config;
                        }
                    }
                });
            } else if (configOrConfigs && typeof configOrConfigs === 'object') {
                const config = configOrConfigs as import('../types').FavoriteConfig;
                if (config.id) {
                    if ('remove' in config && config.remove) {
                        delete newFavoriteConfigs[config.id];
                    } else {
                        newFavoriteConfigs[config.id] = config;
                    }
                }
            }

            const newStats: Stats = { ...currentStats, favoriteConfigs: newFavoriteConfigs } as Stats;
            setStats(newStats);
            await localDB.updateProfile({ stats: newStats });
        } catch (err) {
            console.error('Erro ao atualizar favoritos:', err);
        }
    }, [userId]);

    return { savedIds, stats, totalScore, activeFolderFilters, profileLoaded, updateFavorites, updateStats, updateFolderFilters, updateFavoriteConfig };
};
