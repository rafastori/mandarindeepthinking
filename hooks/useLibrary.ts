import { useState, useEffect, useMemo } from 'react';
import { StudyItem } from '../types';
import { studyData as staticData } from '../constants';

export const useLibrary = () => {
    const [userItems, setUserItems] = useState<StudyItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('mandarin_user_library');
            if (saved) {
                setUserItems(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load user library", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addItems = (newItems: StudyItem[]) => {
        setUserItems(prev => {
            const updated = [...newItems, ...prev];
            localStorage.setItem('mandarin_user_library', JSON.stringify(updated));
            return updated;
        });
    };

    const removeItem = (id: string | number) => {
        setUserItems(prev => {
            const updated = prev.filter(item => item.id !== id);
            localStorage.setItem('mandarin_user_library', JSON.stringify(updated));
            return updated;
        });
    };

    // Combine static data (IDs 1-21) with user data (String IDs)
    // User data comes first so newly imported texts appear at the top
    const libraryData = useMemo(() => {
        return [...userItems, ...staticData];
    }, [userItems]);

    return { 
        libraryData, 
        addItems, 
        removeItem,
        isUserItem: (id: string | number) => typeof id === 'string' // Static IDs are numbers, User IDs are strings
    };
};