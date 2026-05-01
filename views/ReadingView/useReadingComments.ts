import { useCallback, useEffect, useState } from 'react';
import { localDB, UserComment } from '../../services/localDB';

/**
 * Carrega todos os comentários do usuário e expõe API para CRUD.
 * Comentários são per-word (uma vez vale para todas as ocorrências da palavra) ou per-sentence.
 */
export function useReadingComments() {
    const [comments, setComments] = useState<UserComment[]>([]);
    const [loaded, setLoaded] = useState(false);

    const reload = useCallback(async () => {
        try {
            const all = await localDB.getAllComments();
            setComments(all);
        } catch (e) {
            console.error('Erro ao carregar comentários:', e);
        } finally {
            setLoaded(true);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    const addComment = useCallback(async (
        targetType: 'word' | 'sentence',
        targetKey: string,
        text: string
    ) => {
        const now = new Date().toISOString();
        const comment: UserComment = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            targetType,
            targetKey,
            text: text.trim(),
            createdAt: now,
            updatedAt: now,
        };
        await localDB.putComment(comment);
        setComments(prev => [...prev, comment]);
        return comment;
    }, []);

    const updateComment = useCallback(async (id: string, text: string) => {
        const existing = comments.find(c => c.id === id);
        if (!existing) return;
        const updated: UserComment = {
            ...existing,
            text: text.trim(),
            updatedAt: new Date().toISOString(),
        };
        await localDB.putComment(updated);
        setComments(prev => prev.map(c => c.id === id ? updated : c));
    }, [comments]);

    const deleteComment = useCallback(async (id: string) => {
        await localDB.deleteComment(id);
        setComments(prev => prev.filter(c => c.id !== id));
    }, []);

    const getCommentsFor = useCallback((targetType: 'word' | 'sentence', targetKey: string) => {
        return comments.filter(c => c.targetType === targetType && c.targetKey === targetKey);
    }, [comments]);

    const hasCommentFor = useCallback((targetType: 'word' | 'sentence', targetKey: string) => {
        return comments.some(c => c.targetType === targetType && c.targetKey === targetKey);
    }, [comments]);

    return {
        comments,
        loaded,
        addComment,
        updateComment,
        deleteComment,
        getCommentsFor,
        hasCommentFor,
        reload,
    };
}
