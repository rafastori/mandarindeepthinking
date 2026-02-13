import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Stats } from '../types';

const defaultStats: Stats = { correct: 0, wrong: 0, history: [], wordCounts: {}, studyMoreIds: [] };

export const useUserProfile = (userId: string | null | undefined) => {
    const [savedIds, setSavedIds] = useState<string[]>([]);
    const [stats, setStats] = useState<Stats>(defaultStats);
    const [totalScore, setTotalScore] = useState<number>(0);
    const [activeFolderFilters, setActiveFolderFilters] = useState<string[]>([]);

    useEffect(() => {
        if (!userId) {
            setSavedIds([]);
            setStats(defaultStats);
            setActiveFolderFilters([]);
            return;
        }

        const userRef = doc(db, 'users', userId);
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSavedIds(data.savedIds || []);
                setStats(data.stats || defaultStats);
                setTotalScore(data.totalScore || 0);
                setActiveFolderFilters(data.activeFolderFilters || []);
            } else {
                // Cria o documento se não existir
                setDoc(userRef, { savedIds: [], stats: defaultStats, activeFolderFilters: [] }, { merge: true });
            }
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

    return { savedIds, stats, totalScore, activeFolderFilters, updateFavorites, updateStats, updateFolderFilters };
};
