import { useCallback, useEffect, useState } from 'react';
import { StudyItem } from '../types';
import { localDB } from '../services/localDB';
import { nativeAudioLibrary, NATIVE_ALIGNMENT_CHANGE_EVENT } from '../services/nativeAudioLibrary';
import { autoAlignLesson } from '../services/whisperAligner';
import {
    AlignSentenceInput,
    LessonAlignment,
    hashLessonContent,
    realignOneSentence,
    shiftCues,
    updateCueTimes,
} from '../utils/audioAlignment';
import { formatTokensToText } from '../views/ReadingView/shared';

export function sentencesFromItems(items: StudyItem[]): AlignSentenceInput[] {
    return items.map(item => ({
        id: item.id.toString(),
        text: (item.tokens && item.tokens.length > 0)
            ? formatTokensToText(item.tokens)
            : (item.chinese || ''),
    }));
}

async function persistAlignment(alignment: LessonAlignment): Promise<void> {
    await nativeAudioLibrary.saveAlignment(alignment);
    try {
        const profile = await localDB.getProfile();
        await localDB.updateProfile({
            nativeAlignments: {
                ...(profile.nativeAlignments || {}),
                [alignment.lessonId]: alignment,
            },
        });
    } catch (e) {
        console.warn('Não foi possível espelhar o alinhamento no perfil:', e);
    }
}

export function useLessonAlignment(lessonId: string | null, items: StudyItem[]) {
    const [alignment, setAlignment] = useState<LessonAlignment | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const sentences = sentencesFromItems(items);
    const contentHash = hashLessonContent(sentences);

    const refresh = useCallback(async () => {
        if (!lessonId) {
            setAlignment(null);
            return;
        }
        setLoading(true);
        try {
            let stored = await nativeAudioLibrary.getAlignment(lessonId);
            if (!stored) {
                const profile = await localDB.getProfile();
                stored = profile.nativeAlignments?.[lessonId] || null;
                if (stored) await nativeAudioLibrary.saveAlignment(stored);
            }
            setAlignment(stored);
            setError(null);
        } catch (e: any) {
            setError(e?.message || 'Falha ao ler o alinhamento.');
        } finally {
            setLoading(false);
        }
    }, [lessonId]);

    useEffect(() => {
        refresh();
        const onChange = () => { refresh(); };
        window.addEventListener(NATIVE_ALIGNMENT_CHANGE_EVENT, onChange);
        return () => window.removeEventListener(NATIVE_ALIGNMENT_CHANGE_EVENT, onChange);
    }, [refresh]);

    const save = useCallback(async (next: LessonAlignment) => {
        await persistAlignment(next);
        setAlignment(next);
    }, []);

    const runAutoAlign = useCallback(async (audioFileId: string, language?: StudyItem['language']) => {
        if (!lessonId) return null;
        const file = await nativeAudioLibrary.getFile(audioFileId);
        if (!file) throw new Error('MP3 nativo não encontrado. Vincule o digestivo primeiro.');
        setBusy(true);
        setError(null);
        setProgress(0);
        setProgressMessage('Preparando…');
        try {
            const result = await autoAlignLesson({
                lessonId,
                audioFileId,
                blob: file.blob,
                sentences,
                language: language || 'zh',
                onProgress: (value, message) => {
                    setProgress(value);
                    if (message) setProgressMessage(message);
                },
            });
            await persistAlignment(result);
            setAlignment(result);
            return result;
        } catch (e: any) {
            const message = e?.message || 'Não foi possível alinhar automaticamente.';
            setError(message);
            throw e;
        } finally {
            setBusy(false);
            setProgressMessage('');
        }
    }, [lessonId, sentences]);

    const applyCues = useCallback(async (mutator: (current: LessonAlignment) => LessonAlignment) => {
        if (!alignment) return;
        const next = mutator(alignment);
        await save(next);
    }, [alignment, save]);

    const markTimes = useCallback(async (itemId: string, patch: { start?: number; end?: number }) => {
        if (!alignment) return;
        await save({
            ...alignment,
            method: 'manual',
            cues: updateCueTimes(alignment.cues, itemId, patch, alignment.duration),
            updatedAt: new Date().toISOString(),
        });
    }, [alignment, save]);

    const shiftAll = useCallback(async (deltaSeconds: number) => {
        if (!alignment) return;
        await save({
            ...alignment,
            method: 'manual',
            cues: shiftCues(alignment.cues, deltaSeconds, alignment.duration),
            updatedAt: new Date().toISOString(),
        });
    }, [alignment, save]);

    const realignOne = useCallback(async (itemId: string) => {
        if (!alignment) return;
        await save({
            ...alignment,
            cues: realignOneSentence(alignment.cues, itemId, sentences, alignment.whisperChunks, alignment.duration),
            updatedAt: new Date().toISOString(),
        });
    }, [alignment, save, sentences]);

    const clearAlignment = useCallback(async () => {
        if (!lessonId) return;
        await nativeAudioLibrary.deleteAlignment(lessonId);
        try {
            const profile = await localDB.getProfile();
            if (profile.nativeAlignments?.[lessonId]) {
                const next = { ...profile.nativeAlignments };
                delete next[lessonId];
                await localDB.updateProfile({ nativeAlignments: next });
            }
        } catch {
            // ignore
        }
        setAlignment(null);
    }, [lessonId]);

    const stale = !!alignment && alignment.contentHash !== contentHash;

    return {
        alignment,
        sentences,
        contentHash,
        stale,
        loading,
        busy,
        progress,
        progressMessage,
        error,
        refresh,
        save,
        runAutoAlign,
        applyCues,
        markTimes,
        shiftAll,
        realignOne,
        clearAlignment,
    };
}
