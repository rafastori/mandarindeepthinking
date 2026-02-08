import { useState, useEffect, useRef, useCallback } from 'react';
import { Stats, SessionStats, InventoryItem, Achievement } from '../types';
import { normalizeDate, getLocalISODate, getDaysDifference } from '../utils/dateUtils';

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

// Date helpers imported from utils/dateUtils

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
    useEffect(() => {
        if (persistedStats.lastLoginDate !== baselineStatsRef.current.lastLoginDate) {
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
        const lastLoginRaw = stats.lastLoginDate;
        const currentStreak = stats.streak || 0;

        // CRITICAL: Normalize the lastLogin date FIRST
        const lastLogin = normalizeDate(lastLoginRaw);

        // Debug logs
        console.log('[STREAK CALC] today:', today);
        console.log('[STREAK CALC] lastLogin (normalized):', lastLogin);
        console.log('[STREAK CALC] currentStreak:', currentStreak);

        // 1. New User or No Login Data
        if (!lastLogin) {
            console.log('[STREAK CALC] No lastLogin -> Start streak 1');
            return { ...stats, streak: 1, lastLoginDate: today };
        }

        // 2. Already logged in today
        if (lastLogin === today) {
            console.log('[STREAK CALC] Login is today -> Keep streak:', currentStreak);
            return stats;
        }

        // 3. Calculate difference
        const diffDays = getDaysDifference(lastLogin, today);
        console.log('[STREAK CALC] diffDays:', diffDays);

        // 4. Consecutive Day (Yesterday)
        if (diffDays === 1) {
            const newStreak = currentStreak + 1;
            console.log('[STREAK CALC] Consecutive day -> Increment to:', newStreak);

            // Check for weekly reward (logic remains same)
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

        // 5. Broken Streak (Gap > 1 day)
        // PROTECT MANUAL EDITS: If DB has a streak > 1, allow a small gap (2 days) to rescue it
        // ignoring 1-day streaks (new users) to avoid noise
        if (diffDays > 1) {
            if (currentStreak > 1 && diffDays <= 2) {
                console.log('[STREAK CALC] Rescue: Small gap, maintain streak:', currentStreak);
                return { ...stats, streak: currentStreak, lastLoginDate: today }; // Update date, keep streak
            }
            console.log('[STREAK CALC] Gap too large -> Reset to 1');
            return { ...stats, streak: 1, lastLoginDate: today };
        }

        return { ...stats, streak: 1, lastLoginDate: today };
    }, []);

    // STREAK CHECK REMOVED: Managed by App.tsx to ensure single execution and robust loading gates.
    // Previously, this effect caused race conditions by running on defaultStats before Firebase loaded.

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
        const currentBaseline = baselineStatsRef.current;
        const persisted = persistedStats;

        // SINGLE TRUTH: We trust persistedStats logic UNLESS it's clearly stale/empty vs local
        // But for streak, we always want the HIGHEST value to prevent overwrites

        let newBaseline = { ...persisted };

        const persistedStreak = persisted.streak || 0;
        const localStreak = currentBaseline.streak || 0;

        // Validation: If persisted streak is higher or equal, it wins.
        if (persistedStreak >= localStreak) {
            newBaseline.streak = persistedStreak;
            newBaseline.lastLoginDate = persisted.lastLoginDate;
        } else {
            // Local is higher. Why?
            // Maybe we just incremented it locally and it hasn't synced back yet?
            // Trust local ONLY if the date is also newer or same
            const persistedDate = normalizeDate(persisted.lastLoginDate);
            const localDate = normalizeDate(currentBaseline.lastLoginDate);

            if (localDate >= persistedDate) {
                console.log('[SESSION] Trusting local streak (newer/higher):', localStreak);
                newBaseline.streak = localStreak;
                newBaseline.lastLoginDate = currentBaseline.lastLoginDate;
            } else {
                // Local streak is higher but date is older? Weird. Trust persisted to be safe.
                newBaseline.streak = persistedStreak;
            }
        }

        baselineStatsRef.current = newBaseline;

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
            ...persistedStats, // Keep other fields
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
            streak: baselineStatsRef.current.streak || 0,
            lastLoginDate: baselineStatsRef.current.lastLoginDate,
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
            // CRITICAL FIX: Use baselineStatsRef for streak/login to ensure we catch recent updates 
            // that might not have synced to persistedStats yet (avoids race condition)
            streak: baselineStatsRef.current.streak || 0,
            lastLoginDate: baselineStatsRef.current.lastLoginDate,
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
