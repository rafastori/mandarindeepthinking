import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Stats } from '../types';

const defaultStats: Stats = { correct: 0, wrong: 0, history: [], wordCounts: {} };

export const useUserProfile = (userId: string | null | undefined) => {
    const [savedIds, setSavedIds] = useState<string[]>([]);
    const [stats, setStats] = useState<Stats>(defaultStats);
    const [totalScore, setTotalScore] = useState<number>(0);
    const [activeFolderFilters, setActiveFolderFilters] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setSavedIds([]);
            setStats(defaultStats);
            setActiveFolderFilters([]);
            setLoading(false);
            return;
        }

        setLoading(true); // Reset loading when userId changes

        const userRef = doc(db, 'users', userId);
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('[PROFILE DEBUG] Firestore Data:', data);
                console.log('[PROFILE DEBUG] data.stats:', data.stats);
                setSavedIds(data.savedIds || []);
                setStats(data.stats || defaultStats);
                setTotalScore(data.totalScore || 0);
                setActiveFolderFilters(data.activeFolderFilters || []);
            } else {
                // Cria o documento se não existir - mas não sobrescreve loading até persistir?
                // Na verdade, onSnapshot dispara logo, se não existir, cria e a gente assume defaultStats
                setDoc(userRef, { savedIds: [], stats: defaultStats, activeFolderFilters: [] }, { merge: true });
            }
            setLoading(false); // Data loaded (or default set)
        });

        return () => unsubscribe();
    }, [userId]);

    const updateFavorites = async (newIds: string[]) => {
        if (!userId) return;
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, { savedIds: newIds }, { merge: true });
    };

    const updateStats = async (newStats: Stats) => {
        if (!userId) return;
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, { stats: newStats }, { merge: true });
    };

    const updateFolderFilters = async (newFilters: string[]) => {
        if (!userId) return;
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, { activeFolderFilters: newFilters }, { merge: true });
    };

    return { savedIds, stats, totalScore, activeFolderFilters, updateFavorites, updateStats, updateFolderFilters, loading };
};
