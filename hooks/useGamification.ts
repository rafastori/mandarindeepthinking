import { useState, useEffect, useRef, useCallback } from 'react';
import { Stats, SessionStats, InventoryItem, Achievement } from '../types';

// Define all available achievements
const ALL_ACHIEVEMENTS: Omit<Achievement, 'unlockedAt' | 'progress'>[] = [
    { id: 'first_correct', name: 'Primeira Vitória', description: 'Acerte 1 palavra', icon: 'star', target: 1 },
    { id: 'streak_3', name: 'Fogo!', description: '3 dias seguidos', icon: 'flame', target: 3 },
    { id: 'streak_7', name: 'Imparável', description: '7 dias seguidos', icon: 'zap', target: 7 },
    { id: 'streak_30', name: 'Máquina', description: '30 dias seguidos', icon: 'trophy', target: 30 },
    { id: 'correct_10', name: 'Aprendiz', description: 'Acerte 10 palavras', icon: 'book-open', target: 10 },
    { id: 'correct_50', name: 'Estudante', description: 'Acerte 50 palavras', icon: 'graduation-cap', target: 50 },
    { id: 'correct_100', name: 'Mestre', description: 'Acerte 100 palavras', icon: 'brain', target: 100 },
    { id: 'time_60', name: 'Dedicado', description: '1 hora de estudo', icon: 'clock', target: 3600 },
    { id: 'time_300', name: 'Maratonista', description: '5 horas de estudo', icon: 'timer', target: 18000 },
];

// Define rewards for weekly streaks
const WEEKLY_REWARDS: InventoryItem[] = [
    { id: 'avatar_dragon', name: 'Dragão de Fogo', icon: '🐉', unlockedAt: '', type: 'avatar' },
    { id: 'avatar_panda', name: 'Panda Sábio', icon: '🐼', unlockedAt: '', type: 'avatar' },
    { id: 'badge_gold', name: 'Medalha de Ouro', icon: '🥇', unlockedAt: '', type: 'badge' },
    { id: 'avatar_phoenix', name: 'Fênix Renascida', icon: '🔥', unlockedAt: '', type: 'avatar' },
    { id: 'badge_diamond', name: 'Diamante', icon: '💎', unlockedAt: '', type: 'badge' },
];

const getLocalISODate = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export type BonusType = 'streak10' | 'streak30' | null;

export interface PendingBonus {
    type: BonusType;
    points: number;
}

export interface UseGamificationResult {
    sessionStats: SessionStats;
    streak: number;
    points: number;
    totalCorrect: number; // Total correct answers from Firebase
    totalTime: number; // Total time from Firebase
    achievements: Achievement[];
    inventory: InventoryItem[];
    currentAvatar: InventoryItem | null;
    startSession: () => void;
    endSession: () => SessionStats;
    recordCorrect: () => void;
    recordWrong: () => void;
    setActiveTab: (tab: string) => void;
    checkAndUpdateStreak: (stats: Stats) => Stats;
    getUpdatedStats: () => Partial<Stats>;
    newAchievements: Achievement[];
    newInventoryItem: InventoryItem | null;
    pendingBonus: PendingBonus | null;
    clearPendingBonus: () => void;
}

export function useGamification(
    persistedStats: Stats, // Stats from Firebase - this is the source of truth
    onStatsUpdate: (stats: Stats) => void
): UseGamificationResult {
    // Session-only stats (reset each session)
    const [sessionStats, setSessionStats] = useState<SessionStats>({
        startTime: Date.now(),
        wordsReviewed: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        tabTime: {},
        pointsEarned: 0,
    });

    // Baseline stats (snapshot at start of session) to avoid double counting
    const baselineStatsRef = useRef<Stats>(persistedStats);

    // On mount (or when user changes), update baseline if it's the first load
    // IMPORTANT: Never update baseline during an active session to avoid double-counting
    useEffect(() => {
        if (!isSessionActiveRef.current && persistedStats.lastLoginDate !== baselineStatsRef.current.lastLoginDate) {
            baselineStatsRef.current = persistedStats;
        }
    }, [persistedStats.lastLoginDate]);

    // These are derived from baseline + session changes
    const [sessionPoints, setSessionPoints] = useState(0);
    const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
    const [newInventoryItem, setNewInventoryItem] = useState<InventoryItem | null>(null);
    const [sessionInventory, setSessionInventory] = useState<InventoryItem[]>([]);
    const [pendingBonus, setPendingBonus] = useState<PendingBonus | null>(null);

    const activeTabRef = useRef<string>('leitura');
    const lastTickRef = useRef<number>(Date.now());
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isSessionActiveRef = useRef<boolean>(false);
    const consecutiveCorrectRef = useRef<number>(0); // Track consecutive correct answers for bonuses

    // Read values from BASELINE + Session Delta
    // We do NOT use persistedStats for accumulating fields because persistedStats 
    // updates to include our partial session data, leading to double counting.
    const streak = persistedStats.streak || 0; // Streak is handled via specific logic, so we can use persisted
    const points = (baselineStatsRef.current.points || 0) + sessionPoints;
    const totalCorrect = (baselineStatsRef.current.correct || 0) + sessionStats.correctAnswers;
    const totalTime = (baselineStatsRef.current.totalTime || 0) + Object.values(sessionStats.tabTime).reduce((a, b) => a + b, 0); // Recalculate total time from baseline + current session

    const achievements = persistedStats.achievements || [];
    const inventory = [...(persistedStats.inventory || []), ...sessionInventory];

    // Timer to track active time (only when session is active)
    useEffect(() => {
        timerRef.current = setInterval(() => {
            if (!isSessionActiveRef.current) return;

            const now = Date.now();
            // Only add 1 second per tick
            setSessionStats(prev => ({
                ...prev,
                tabTime: {
                    ...prev.tabTime,
                    [activeTabRef.current]: (prev.tabTime[activeTabRef.current] || 0) + 1
                }
            }));
            lastTickRef.current = now;
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const setActiveTab = useCallback((tab: string) => {
        activeTabRef.current = tab;
    }, []);

    const checkAchievements = useCallback((stats: Stats): Achievement[] => {
        const unlocked: Achievement[] = [];
        const today = getLocalISODate();
        const existingAchievements = stats.achievements || [];

        ALL_ACHIEVEMENTS.forEach(ach => {
            const existing = existingAchievements.find(a => a.id === ach.id);
            if (existing?.unlockedAt) return; // Already unlocked

            let isUnlocked = false;

            switch (ach.id) {
                case 'first_correct':
                    isUnlocked = stats.correct >= 1;
                    break;
                case 'streak_3':
                case 'streak_7':
                case 'streak_30':
                    isUnlocked = (stats.streak || 0) >= ach.target!;
                    break;
                case 'correct_10':
                case 'correct_50':
                case 'correct_100':
                    isUnlocked = stats.correct >= ach.target!;
                    break;
                case 'time_60':
                case 'time_300':
                    isUnlocked = (stats.totalTime || 0) >= ach.target!;
                    break;
            }

            if (isUnlocked) {
                unlocked.push({ ...ach, unlockedAt: today, progress: ach.target });
            }
        });

        return unlocked;
    }, []);

    const checkAndUpdateStreak = useCallback((stats: Stats): Stats => {
        const today = getLocalISODate();
        const lastLogin = stats.lastLoginDate;

        if (!lastLogin) {
            return { ...stats, streak: 1, lastLoginDate: today };
        }

        if (lastLogin === today) {
            return stats;
        }

        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = getLocalISODate(yesterdayDate);

        if (lastLogin === yesterday) {
            const newStreak = (stats.streak || 0) + 1;

            // Check for weekly reward (every 7 days)
            if (newStreak > 0 && newStreak % 7 === 0) {
                const rewardIndex = Math.floor(newStreak / 7) - 1;
                const reward = WEEKLY_REWARDS[rewardIndex % WEEKLY_REWARDS.length];
                const existingInventory = stats.inventory || [];
                if (reward && !existingInventory.find(i => i.id === reward.id)) {
                    const newItem = { ...reward, unlockedAt: today };
                    setSessionInventory(prev => [...prev, newItem]);
                    setNewInventoryItem(newItem);
                }
            }

            return { ...stats, streak: newStreak, lastLoginDate: today };
        }

        // Streak broken
        return { ...stats, streak: 1, lastLoginDate: today };
    }, []);

    // Check streak on mount/update — only trigger on login date or streak changes
    useEffect(() => {
        const updated = checkAndUpdateStreak(persistedStats);

        // If streak or login date changed, trigger update
        if (updated.streak !== persistedStats.streak || updated.lastLoginDate !== persistedStats.lastLoginDate) {
            baselineStatsRef.current = updated;
            onStatsUpdate(updated);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checkAndUpdateStreak, persistedStats.lastLoginDate, persistedStats.streak, onStatsUpdate]);

    const recordCorrect = useCallback(() => {
        consecutiveCorrectRef.current += 1;
        const consecutive = consecutiveCorrectRef.current;

        // Base points
        let pointsGained = 10;
        let bonusType: BonusType = null;
        let bonusPoints = 0;

        // Bonus: +100 for every 30 consecutive (checked first since 30 is also divisible by 10)
        if (consecutive > 0 && consecutive % 30 === 0) {
            bonusPoints = 100;
            pointsGained += bonusPoints;
            bonusType = 'streak30';
        }
        // Bonus: +30 for every 10 consecutive (but not if already got the 30 bonus)
        else if (consecutive > 0 && consecutive % 10 === 0) {
            bonusPoints = 30;
            pointsGained += bonusPoints;
            bonusType = 'streak10';
        }

        // Trigger celebration if bonus earned
        if (bonusType) {
            setPendingBonus({ type: bonusType, points: bonusPoints });
        }

        setSessionStats(prev => ({
            ...prev,
            wordsReviewed: prev.wordsReviewed + 1,
            correctAnswers: prev.correctAnswers + 1,
            pointsEarned: prev.pointsEarned + pointsGained,
        }));
        setSessionPoints(prev => prev + pointsGained);
    }, []);

    const recordWrong = useCallback(() => {
        consecutiveCorrectRef.current = 0; // Reset consecutive streak on wrong answer
        setSessionStats(prev => ({
            ...prev,
            wordsReviewed: prev.wordsReviewed + 1,
            wrongAnswers: prev.wrongAnswers + 1,
        }));
    }, []);

    const startSession = useCallback(() => {
        // Update baseline to current persisted stats when starting a new session
        baselineStatsRef.current = persistedStats;

        setSessionStats({
            startTime: Date.now(),
            wordsReviewed: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            tabTime: {},
            pointsEarned: 0,
        });
        setSessionPoints(0);
        setNewAchievements([]);
        setNewInventoryItem(null);
        setSessionInventory([]);
        consecutiveCorrectRef.current = 0;
        lastTickRef.current = Date.now();
        isSessionActiveRef.current = true;
    }, [persistedStats]);

    const endSession = useCallback((): SessionStats => {
        isSessionActiveRef.current = false;

        const finalStats: SessionStats = {
            ...sessionStats,
            endTime: Date.now(),
        };

        // Calculate total session time
        const totalSessionTime = Object.values(sessionStats.tabTime).reduce((a, b) => a + b, 0);

        // Build updated stats to persist using BASELINE + DELTA
        const updatedStats: Stats = {
            ...persistedStats, // Keep other fields like favoriteConfigs and ignoredReviewWords
            correct: (baselineStatsRef.current.correct || 0) + sessionStats.correctAnswers,
            wrong: (baselineStatsRef.current.wrong || 0) + sessionStats.wrongAnswers,
            history: persistedStats.history || [],
            wordCounts: persistedStats.wordCounts || {},
            totalTime: (baselineStatsRef.current.totalTime || 0) + totalSessionTime,
            tabTime: Object.entries(sessionStats.tabTime).reduce((acc, [tab, time]) => {
                acc[tab] = (baselineStatsRef.current.tabTime?.[tab] || 0) + time;
                return acc;
            }, {} as Record<string, number>),
            points: (baselineStatsRef.current.points || 0) + sessionPoints,
            streak: persistedStats.streak || 0,
            lastLoginDate: persistedStats.lastLoginDate,
            inventory: [...(persistedStats.inventory || []), ...sessionInventory],
            achievements: persistedStats.achievements || [],
        };

        // Check for new achievements
        const newAchs = checkAchievements(updatedStats);
        if (newAchs.length > 0) {
            setNewAchievements(newAchs);
            updatedStats.achievements = [...(updatedStats.achievements || []), ...newAchs];
        }

        onStatsUpdate(updatedStats);

        return finalStats;
    }, [sessionStats, persistedStats, sessionPoints, sessionInventory, checkAchievements, onStatsUpdate]);

    const getUpdatedStats = useCallback((): Partial<Stats> => {
        const totalSessionTime = Object.values(sessionStats.tabTime).reduce((a, b) => a + b, 0);
        return {
            points: (baselineStatsRef.current.points || 0) + sessionPoints,
            streak: persistedStats.streak || 0,
            totalTime: (baselineStatsRef.current.totalTime || 0) + totalSessionTime,
            tabTime: Object.entries(sessionStats.tabTime).reduce((acc, [tab, time]) => {
                acc[tab] = (baselineStatsRef.current.tabTime?.[tab] || 0) + time;
                return acc;
            }, {} as Record<string, number>),
            inventory: [...(persistedStats.inventory || []), ...sessionInventory],
            achievements: persistedStats.achievements || [],
        };
    }, [sessionStats, persistedStats, sessionPoints, sessionInventory]);

    const clearPendingBonus = useCallback(() => {
        setPendingBonus(null);
    }, []);

    const currentAvatar = inventory.find(i => i.type === 'avatar') || null;

    return {
        sessionStats,
        streak,
        points,
        totalCorrect,
        totalTime,
        achievements,
        inventory,
        currentAvatar,
        startSession,
        endSession,
        recordCorrect,
        recordWrong,
        setActiveTab,
        checkAndUpdateStreak,
        getUpdatedStats,
        newAchievements,
        newInventoryItem,
        pendingBonus,
        clearPendingBonus,
    };
}
