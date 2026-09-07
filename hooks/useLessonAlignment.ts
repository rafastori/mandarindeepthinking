import { useCallback, useEffect, useRef, useState } from 'react';
import { StudyItem } from '../types';
import { localDB } from '../services/localDB';
import { nativeAudioLibrary, NATIVE_ALIGNMENT_CHANGE_EVENT } from '../services/nativeAudioLibrary';
import { autoAlignLesson } from '../services/whisperAligner';
import {
    AlignSentenceInput,
    LessonAlignment,
    LiveMarkEndError,
    applyLiveEnd,
    applyLiveStart,
    clampIntroSkip,
    emptyManualAlignment,
    hashLessonContent,
    realignOneSentence,
    rebaseCuesForIntroSkip,
    resolveIntroSkip,
    shiftCues,
    updateCueTimes,
    setManualCueTimes,
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
    const alignmentRef = useRef<LessonAlignment | null>(null);
    const pendingSaves = useRef(0);
    alignmentRef.current = alignment;

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
            if (pendingSaves.current > 0 && alignmentRef.current) {
                setError(null);
                return;
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
        alignmentRef.current = next;
        setAlignment(next);
        pendingSaves.current += 1;
        try {
            await persistAlignment(next);
        } finally {
            pendingSaves.current -= 1;
        }
    }, []);

    const ensureManualAlignment = useCallback(async (
        audioFileId: string,
        duration: number,
        introSkipSeconds?: number
    ) => {
        if (!lessonId) return null;
        const current = alignmentRef.current;
        if (current) {
            const skip = introSkipSeconds != null
                ? clampIntroSkip(introSkipSeconds, duration || current.duration)
                : current.introSkipSeconds;
            if (
                (duration > 0 && duration > (current.duration || 0) + 0.05) ||
                (skip != null && skip !== current.introSkipSeconds)
            ) {
                const next: LessonAlignment = {
                    ...current,
                    duration: duration > 0 ? duration : current.duration,
                    introSkipSeconds: skip,
                    updatedAt: new Date().toISOString(),
                };
                await save(next);
                return next;
            }
            return current;
        }
        const created = emptyManualAlignment({
            lessonId,
            audioFileId,
            contentHash,
            duration,
            introSkipSeconds,
        });
        await save(created);
        return created;
    }, [contentHash, lessonId, save]);

    const markLiveStart = useCallback(async (
        itemId: string,
        time: number,
        introSkipSeconds = 0
    ) => {
        const current = alignmentRef.current;
        if (!current) return { ok: false as const, reason: 'no_alignment' as const };
        const result = applyLiveStart(
            current.cues,
            itemId,
            time,
            current.duration || time + 1,
            introSkipSeconds
        );
        await save({
            ...current,
            method: 'manual',
            duration: Math.max(current.duration, time + 1),
            cues: result.cues,
            updatedAt: new Date().toISOString(),
        });
        return { ok: true as const, start: result.start, clampedToIntro: result.clampedToIntro };
    }, [save]);

    const markLiveEnd = useCallback(async (
        itemId: string,
        nextItemId: string | undefined,
        time: number
    ): Promise<{ ok: true; end: number } | { ok: false; reason: LiveMarkEndError | 'no_alignment' }> => {
        const current = alignmentRef.current;
        if (!current) return { ok: false, reason: 'no_alignment' };
        const result = applyLiveEnd(
            current.cues,
            itemId,
            nextItemId,
            time,
            current.duration || time + 1
        );
        if (result.ok === false) return { ok: false, reason: result.reason };
        await save({
            ...current,
            method: 'manual',
            duration: Math.max(current.duration, time + 1),
            cues: result.cues,
            updatedAt: new Date().toISOString(),
        });
        return { ok: true, end: result.end };
    }, [save]);

    const runAutoAlign = useCallback(async (
        audioFileId: string,
        language?: StudyItem['language'],
        introSkipSeconds?: number
    ) => {
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
                introSkipSeconds,
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
        const current = alignmentRef.current;
        if (!current) return;
        const duration = Math.max(current.duration, 0);
        await save({
            ...current,
            method: 'manual',
            cues: setManualCueTimes(current.cues, itemId, patch, duration),
            updatedAt: new Date().toISOString(),
        });
    }, [save]);

    const shiftAll = useCallback(async (deltaSeconds: number) => {
        if (!alignment) return;
        const minStart = alignment.introSkipSeconds != null
            ? clampIntroSkip(alignment.introSkipSeconds, alignment.duration)
            : 0;
        await save({
            ...alignment,
            method: 'manual',
            cues: shiftCues(alignment.cues, deltaSeconds, alignment.duration, minStart),
            updatedAt: new Date().toISOString(),
        });
    }, [alignment, save]);

    const applyIntroSkip = useCallback(async (seconds: number, rebaseCues = true) => {
        const duration = alignment?.duration ?? 999;
        const nextSkip = clampIntroSkip(seconds, duration);
        await nativeAudioLibrary.setIntroSkipSeconds(nextSkip);
        if (!alignment) return;
        const previous = alignment.cues[0]?.start ?? alignment.introSkipSeconds ?? 0;
        const cues = rebaseCues
            ? rebaseCuesForIntroSkip(alignment.cues, previous, nextSkip, alignment.duration)
            : alignment.cues;
        await save({
            ...alignment,
            method: 'manual',
            introSkipSeconds: nextSkip,
            cues,
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
        markLiveStart,
        markLiveEnd,
        ensureManualAlignment,
        shiftAll,
        applyIntroSkip,
        realignOne,
        clearAlignment,
        introSkip: resolveIntroSkip(alignment),
    };
}
