import { useState, useEffect, useCallback } from 'react';
import { localDB } from '../services/localDB';
import { SessionRecord, DayStats } from '../types';

export const useDetailedStats = () => {
    const [sessions, setSessions] = useState<SessionRecord[]>([]);
    const [dayStats, setDayStats] = useState<DayStats[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const allSessions = await localDB.getAllSessions();
            allSessions.sort((a, b) => b.startTime - a.startTime);
            setSessions(allSessions);

            const daysMap = new Map<string, DayStats>();

            allSessions.forEach(session => {
                const date = session.date;
                if (!daysMap.has(date)) {
                    daysMap.set(date, {
                        date,
                        sessions: [],
                        totalTime: 0,
                        totalCorrect: 0,
                        totalWrong: 0,
                        totalWordsReviewed: 0,
                        totalPoints: 0,
                        firstSessionStart: session.startTime,
                        lastSessionEnd: session.endTime || session.startTime,
                    });
                }
                const day = daysMap.get(date)!;
                day.sessions.push(session);
                day.totalTime += (session.endTime - session.startTime) / 1000;
                day.totalCorrect += session.correctAnswers;
                day.totalWrong += session.wrongAnswers;
                day.totalWordsReviewed += session.wordsReviewed;
                day.totalPoints += session.pointsEarned;
                if (session.startTime < day.firstSessionStart) day.firstSessionStart = session.startTime;
                if (session.endTime > day.lastSessionEnd) day.lastSessionEnd = session.endTime;
            });

            const aggregatedDays = Array.from(daysMap.values()).sort((a, b) => b.date.localeCompare(a.date));
            setDayStats(aggregatedDays);
        } catch (error) {
            console.error("Error loading detailed stats:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const saveSession = async (session: SessionRecord) => {
        await localDB.saveSession(session);
        await loadData();
    };

    const getDayStatsStr = (date: string) => dayStats.find(d => d.date === date);

    const getMostDifficultWords = (limit: number = 10) => {
        const errors: Record<string, number> = {};
        sessions.forEach(s => {
            s.errorsLog?.forEach(err => {
                errors[err.word] = (errors[err.word] || 0) + 1;
            });
        });
        return Object.entries(errors)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([word, count]) => ({ word, errorCount: count }));
    };

    const getStudyHeatmap = () => {
        return dayStats.map(d => ({
            date: d.date,
            count: Math.round(d.totalTime / 60) // minutes
        }));
    };

    const getBestStudyTime = () => {
        const hourStats = new Array(24).fill(0).map(() => ({ correct: 0, total: 0 }));

        sessions.forEach(s => {
            const hour = new Date(s.startTime).getHours();
            hourStats[hour].correct += s.correctAnswers;
            hourStats[hour].total += (s.correctAnswers + s.wrongAnswers);
        });

        let bestHour = -1;
        let bestAccuracy = -1;

        hourStats.forEach((stat, hour) => {
            if (stat.total > 20) {
                const accuracy = stat.correct / stat.total;
                if (accuracy > bestAccuracy) {
                    bestAccuracy = accuracy;
                    bestHour = hour;
                }
            }
        });

        return { bestHour, accuracy: bestAccuracy > 0 ? bestAccuracy : 0 };
    };

    const getWeeklyComparison = () => {
        const now = new Date();
        const startOfThisWeek = new Date(now);
        startOfThisWeek.setDate(now.getDate() - now.getDay());
        startOfThisWeek.setHours(0, 0, 0, 0);

        const startOfLastWeek = new Date(startOfThisWeek);
        startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

        let thisWeekTime = 0, lastWeekTime = 0;

        dayStats.forEach(d => {
            const dateObj = new Date(d.date + 'T00:00:00');
            if (dateObj >= startOfThisWeek) {
                thisWeekTime += d.totalTime;
            } else if (dateObj >= startOfLastWeek && dateObj < startOfThisWeek) {
                lastWeekTime += d.totalTime;
            }
        });

        const percentChange = lastWeekTime === 0
            ? (thisWeekTime > 0 ? 100 : 0)
            : Math.round(((thisWeekTime - lastWeekTime) / lastWeekTime) * 100);

        return { thisWeekTime, lastWeekTime, percentChange };
    };

    // Calculate accuracy evolution (Retention rate equivalent for Ebbinghaus)
    const getRetentionRate = () => {
        let recentCorrect = 0, recentTotal = 0;
        let pastCorrect = 0, pastTotal = 0;

        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        sessions.forEach(s => {
            if (s.startTime >= thirtyDaysAgo.getTime()) {
                recentCorrect += s.correctAnswers;
                recentTotal += (s.correctAnswers + s.wrongAnswers);
            } else {
                pastCorrect += s.correctAnswers;
                pastTotal += (s.correctAnswers + s.wrongAnswers);
            }
        });

        const recentAcc = recentTotal > 0 ? recentCorrect / recentTotal : 0;
        const pastAcc = pastTotal > 0 ? pastCorrect / pastTotal : 0;

        const change = pastAcc > 0 ? ((recentAcc - pastAcc) / pastAcc) * 100 : 0;

        return { recentAcc: Math.round(recentAcc * 100), pastAcc: Math.round(pastAcc * 100), change: Math.round(change) };
    };

    // Get number of inactive days
    const getInactiveDays = () => {
        if (dayStats.length === 0) return 0;
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // dayStats is sorted descending by date
        const lastStudyDate = new Date(dayStats[0].date + 'T00:00:00');
        const diffTime = Math.abs(now.getTime() - lastStudyDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    };

    const getDailyGoalProgress = (goalMinutes: number = 20) => {
        if (dayStats.length === 0) return { current: 0, target: goalMinutes, percent: 0 };
        const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD local
        const todayStats = dayStats.find(d => d.date === today);

        const currentMinutes = todayStats ? Math.round(todayStats.totalTime / 60) : 0;
        const percent = Math.min(100, Math.round((currentMinutes / goalMinutes) * 100));

        return { current: currentMinutes, target: goalMinutes, percent };
    };

    const getChartData = (days: number = 30) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const filtered = dayStats.filter(d => {
            const dateObj = new Date(d.date + 'T00:00:00');
            const diffDays = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays < days;
        });

        return filtered.reverse().map(d => ({
            date: d.date.substring(5).replace('-', '/'), // MM/DD
            fullDate: d.date,
            tempo: Math.round(d.totalTime / 60),
            acertos: d.totalCorrect,
            erros: d.totalWrong,
            precisao: (d.totalCorrect + d.totalWrong) > 0 ? Math.round((d.totalCorrect / (d.totalCorrect + d.totalWrong)) * 100) : 0,
        }));
    };

    return {
        sessions,
        dayStats,
        loading,
        saveSession,
        getDayStatsStr,
        getMostDifficultWords,
        getStudyHeatmap,
        getBestStudyTime,
        getWeeklyComparison,
        getRetentionRate,
        getInactiveDays,
        getDailyGoalProgress,
        getChartData,
        refreshData: loadData
    };
};
