import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface LeaderboardEntry {
    odaUserId: string;
    name: string;
    avatar?: string;
    score: number;
    totalTime: number;
    streak: number;
    correct: number;
}

export interface UseLeaderboardResult {
    entries: LeaderboardEntry[];
    userRank: number | null;
    loading: boolean;
    updateUserScore: (userId: string, name: string, avatar: string | undefined, score: number, totalTime: number, streak: number, correct: number) => Promise<void>;
}

export function useLeaderboard(currentUserId: string | null | undefined): UseLeaderboardResult {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Listen to leaderboard collection, ordered by score descending
        const leaderboardRef = collection(db, 'leaderboard');
        const q = query(leaderboardRef, orderBy('score', 'desc'), limit(100));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: LeaderboardEntry[] = [];
            snapshot.forEach(doc => {
                const docData = doc.data();
                data.push({
                    odaUserId: doc.id,
                    name: docData.name || 'Anônimo',
                    avatar: docData.avatar,
                    score: docData.score || 0,
                    totalTime: docData.totalTime || 0,
                    streak: docData.streak || 0,
                    correct: docData.correct || 0,
                });
            });
            setEntries(data);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching leaderboard:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Calculate user's rank
    const userRank = currentUserId
        ? entries.findIndex(e => e.odaUserId === currentUserId) + 1 || null
        : null;

    const updateUserScore = async (
        userId: string,
        name: string,
        avatar: string | undefined,
        score: number,
        totalTime: number,
        streak: number,
        correct: number
    ) => {
        if (!userId) return;

        const leaderboardRef = doc(db, 'leaderboard', userId);
        await setDoc(leaderboardRef, {
            name,
            avatar: avatar || null,
            score,
            totalTime,
            streak,
            correct,
            updatedAt: new Date(),
        }, { merge: true });
    };

    return { entries, userRank, loading, updateUserScore };
}
