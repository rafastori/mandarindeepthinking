import { useState, useRef, useCallback, useEffect } from 'react';
import { localDB, VoiceRecording } from '../services/localDB';

interface UseVoiceRecordingReturn {
    // Estado
    recordingIds: Set<string>;
    isRecording: boolean;
    isPlaying: boolean;
    recordingWordId: string | null;
    playingWordId: string | null;
    recordingTime: number;
    error: string | null;
    // Ações
    hasRecording: (wordId: string) => boolean;
    startRecording: (wordId: string) => Promise<void>;
    stopAndSave: () => Promise<void>;
    playRecording: (wordId: string) => Promise<void>;
    stopPlaying: () => void;
}

export const useVoiceRecording = (): UseVoiceRecordingReturn => {
    const [recordingIds, setRecordingIds] = useState<Set<string>>(new Set());
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [recordingWordId, setRecordingWordId] = useState<string | null>(null);
    const [playingWordId, setPlayingWordId] = useState<string | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentWordIdRef = useRef<string | null>(null);

    // Carrega IDs que já possuem gravação no mount
    useEffect(() => {
        localDB.getAllVoiceRecordingIds().then(ids => {
            setRecordingIds(new Set(ids));
        }).catch(err => {
            console.error('[VoiceRecording] Erro ao carregar IDs:', err);
        });
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    const hasRecording = useCallback((wordId: string): boolean => {
        return recordingIds.has(wordId);
    }, [recordingIds]);

    const startRecording = useCallback(async (wordId: string) => {
        try {
            setError(null);
            audioChunksRef.current = [];
            currentWordIdRef.current = wordId;

            // Stop any playing audio
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
                setIsPlaying(false);
                setPlayingWordId(null);
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
            });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start(100);
            setIsRecording(true);
            setRecordingWordId(wordId);
            setRecordingTime(0);

            timerRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err: any) {
            console.error('[VoiceRecording] Erro ao iniciar gravação:', err);
            setError(err.message || 'Não foi possível acessar o microfone.');
        }
    }, []);

    const stopAndSave = useCallback(async () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

        const wordId = currentWordIdRef.current;
        if (!wordId) return;

        return new Promise<void>((resolve) => {
            const recorder = mediaRecorderRef.current!;

            recorder.onstop = async () => {
                // Stop stream
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }

                // Stop timer
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }

                const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });

                // Salva no IndexedDB
                const now = new Date().toISOString();
                const recording: VoiceRecording = {
                    wordId,
                    audioBlob: blob,
                    mimeType: recorder.mimeType,
                    createdAt: now,
                    updatedAt: now,
                };

                try {
                    await localDB.saveVoiceRecording(recording);
                    setRecordingIds(prev => {
                        const next = new Set(prev);
                        next.add(wordId);
                        return next;
                    });
                } catch (err) {
                    console.error('[VoiceRecording] Erro ao salvar:', err);
                }

                setIsRecording(false);
                setRecordingWordId(null);
                setRecordingTime(0);
                currentWordIdRef.current = null;
                resolve();
            };

            recorder.stop();
        });
    }, []);

    const playRecording = useCallback(async (wordId: string) => {
        try {
            // Stop any current playback
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }

            const recording = await localDB.getVoiceRecording(wordId);
            if (!recording) return;

            const url = URL.createObjectURL(recording.audioBlob);
            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onended = () => {
                URL.revokeObjectURL(url);
                setIsPlaying(false);
                setPlayingWordId(null);
                audioRef.current = null;
            };

            audio.onerror = () => {
                URL.revokeObjectURL(url);
                setIsPlaying(false);
                setPlayingWordId(null);
                audioRef.current = null;
            };

            setIsPlaying(true);
            setPlayingWordId(wordId);
            await audio.play();
        } catch (err: any) {
            console.error('[VoiceRecording] Erro ao reproduzir:', err);
            setIsPlaying(false);
            setPlayingWordId(null);
        }
    }, []);

    const stopPlaying = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setIsPlaying(false);
        setPlayingWordId(null);
    }, []);

    return {
        recordingIds,
        isRecording,
        isPlaying,
        recordingWordId,
        playingWordId,
        recordingTime,
        error,
        hasRecording,
        startRecording,
        stopAndSave,
        playRecording,
        stopPlaying,
    };
};
