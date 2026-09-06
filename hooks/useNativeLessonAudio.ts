import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ImportAudioResult,
    NativeAudioFileMeta,
    NativeAudioLibrarySummary,
    nativeAudioLibrary,
    NATIVE_LIBRARY_CHANGE_EVENT,
} from '../services/nativeAudioLibrary';
import { ChinesePodSuffix, pickPreferredRecord } from '../utils/chinesePodAudio';

export interface NativeLessonMatch {
    lessonId: string;
    file: NativeAudioFileMeta;
}

interface PlayerState {
    isPlaying: boolean;
    isLooping: boolean;
    currentTime: number;
    duration: number;
}

const idlePlayer: PlayerState = {
    isPlaying: false,
    isLooping: false,
    currentTime: 0,
    duration: 0,
};

export function useNativeAudioLibrary() {
    const [summary, setSummary] = useState<NativeAudioLibrarySummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastImport, setLastImport] = useState<ImportAudioResult | null>(null);

    const refresh = useCallback(async () => {
        try {
            const next = await nativeAudioLibrary.getSummary();
            setSummary(next);
            setError(null);
        } catch (e: any) {
            setError(e?.message || 'Não foi possível ler a biblioteca de áudio.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const onChange = () => { refresh(); };
        window.addEventListener(NATIVE_LIBRARY_CHANGE_EVENT, onChange);
        return () => window.removeEventListener(NATIVE_LIBRARY_CHANGE_EVENT, onChange);
    }, [refresh]);

    const importFileList = useCallback(async (files: FileList | File[], sourceLabel?: string) => {
        setBusy(true);
        setError(null);
        try {
            const list = Array.from(files);
            const result = await nativeAudioLibrary.importFiles(list, { sourceLabel });
            setLastImport(result);
            await refresh();
            return result;
        } catch (e: any) {
            const message = e?.message || 'Falha ao importar os MP3.';
            setError(message);
            throw e;
        } finally {
            setBusy(false);
        }
    }, [refresh]);

    const importDirectory = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            const handle = await nativeAudioLibrary.pickDirectory();
            if (!handle) return null;
            const result = await nativeAudioLibrary.importDirectory(handle);
            setLastImport(result);
            await refresh();
            return result;
        } catch (e: any) {
            const message = e?.message || 'Não foi possível abrir a pasta.';
            setError(message);
            throw e;
        } finally {
            setBusy(false);
        }
    }, [refresh]);

    const reconnectDirectory = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            const result = await nativeAudioLibrary.reconnectDirectory();
            if (result) setLastImport(result);
            await refresh();
            return result;
        } catch (e: any) {
            const message = e?.message || 'Não foi possível reconectar a pasta.';
            setError(message);
            throw e;
        } finally {
            setBusy(false);
        }
    }, [refresh]);

    const clearLibrary = useCallback(async () => {
        setBusy(true);
        try {
            await nativeAudioLibrary.clear();
            setLastImport(null);
            await refresh();
        } finally {
            setBusy(false);
        }
    }, [refresh]);

    const setPreferredSuffix = useCallback(async (suffix: ChinesePodSuffix) => {
        await nativeAudioLibrary.setPreferredSuffix(suffix);
        await refresh();
    }, [refresh]);

    const setKeepLargeFiles = useCallback(async (keep: boolean) => {
        await nativeAudioLibrary.setKeepLargeFiles(keep);
        await refresh();
    }, [refresh]);

    return {
        summary,
        loading,
        busy,
        error,
        lastImport,
        supportsDirectoryPicker: nativeAudioLibrary.supportsDirectoryPicker(),
        refresh,
        importFileList,
        importDirectory,
        reconnectDirectory,
        clearLibrary,
        setPreferredSuffix,
        setKeepLargeFiles,
    };
}

export function useNativeLessonPlayer(
    lessonId: string | null,
    options?: { onBeforePlay?: () => void }
) {
    const library = useNativeAudioLibrary();
    const [player, setPlayer] = useState<PlayerState>(idlePlayer);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const urlRef = useRef<string | null>(null);
    const onBeforePlayRef = useRef(options?.onBeforePlay);
    onBeforePlayRef.current = options?.onBeforePlay;

    const match = useMemo<NativeLessonMatch | null>(() => {
        if (!lessonId || !library.summary) return null;
        const file = pickPreferredRecord(
            library.summary.files,
            lessonId,
            library.summary.preferredSuffix
        );
        return file ? { lessonId, file } : null;
    }, [lessonId, library.summary]);

    const teardown = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
        if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
        }
        setPlayer(prev => ({ ...idlePlayer, isLooping: prev.isLooping }));
    }, []);

    const attach = useCallback((audio: HTMLAudioElement, looping: boolean) => {
        const onTime = () => {
            setPlayer(prev => ({
                ...prev,
                currentTime: audio.currentTime || 0,
                duration: Number.isFinite(audio.duration) ? audio.duration : prev.duration,
            }));
        };
        const onMeta = () => {
            setPlayer(prev => ({
                ...prev,
                duration: Number.isFinite(audio.duration) ? audio.duration : 0,
            }));
        };
        const onEnded = () => {
            setPlayer(prev => looping || audio.loop
                ? prev
                : { ...prev, isPlaying: false, currentTime: 0 });
        };
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('loadedmetadata', onMeta);
        audio.addEventListener('ended', onEnded);
        audio.loop = looping;
        return () => {
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('loadedmetadata', onMeta);
            audio.removeEventListener('ended', onEnded);
        };
    }, []);

    const ensureAudio = useCallback(async () => {
        if (!match) return null;
        if (audioRef.current && urlRef.current) return audioRef.current;

        const record = await nativeAudioLibrary.getFile(match.file.id);
        if (!record) return null;

        const url = URL.createObjectURL(record.blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audio.preload = 'auto';
        audioRef.current = audio;
        attach(audio, player.isLooping);
        return audio;
    }, [attach, match, player.isLooping]);

    useEffect(() => {
        teardown();
    }, [match?.file.id, teardown]);

    useEffect(() => {
        return () => teardown();
    }, [teardown]);

    const play = useCallback(async () => {
        if (!match) return;
        onBeforePlayRef.current?.();
        const audio = await ensureAudio();
        if (!audio) return;
        try {
            await audio.play();
            setPlayer(prev => ({ ...prev, isPlaying: true }));
        } catch (e) {
            console.warn('Falha ao tocar áudio nativo:', e);
        }
    }, [ensureAudio, match]);

    const pause = useCallback(() => {
        audioRef.current?.pause();
        setPlayer(prev => ({ ...prev, isPlaying: false }));
    }, []);

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setPlayer(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    }, []);

    const toggle = useCallback(() => {
        if (player.isPlaying) pause();
        else play();
    }, [pause, play, player.isPlaying]);

    const replay = useCallback(async () => {
        onBeforePlayRef.current?.();
        const audio = await ensureAudio();
        if (!audio) return;
        audio.currentTime = 0;
        try {
            await audio.play();
            setPlayer(prev => ({ ...prev, isPlaying: true, currentTime: 0 }));
        } catch (e) {
            console.warn('Falha ao repetir áudio nativo:', e);
        }
    }, [ensureAudio]);

    const setLooping = useCallback((isLooping: boolean) => {
        if (audioRef.current) audioRef.current.loop = isLooping;
        setPlayer(prev => ({ ...prev, isLooping }));
    }, []);

    const seek = useCallback((ratio: number) => {
        const audio = audioRef.current;
        if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
        const next = Math.min(Math.max(ratio, 0), 1) * audio.duration;
        audio.currentTime = next;
        setPlayer(prev => ({ ...prev, currentTime: next }));
    }, []);

    return {
        ...library,
        match,
        isPlaying: player.isPlaying,
        isLooping: player.isLooping,
        currentTime: player.currentTime,
        duration: player.duration,
        play,
        pause,
        stop,
        toggle,
        replay,
        setLooping,
        seek,
    };
}
