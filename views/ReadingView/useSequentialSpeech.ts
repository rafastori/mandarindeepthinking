import { useCallback, useEffect, useRef, useState } from 'react';
import { SupportedLanguage } from '../../types';

export interface SpeechItem {
    id: string;
    text: string;
    language: SupportedLanguage;
}

type Status = 'idle' | 'playing' | 'paused';

interface SpeakFn {
    (text: string, language: SupportedLanguage, id?: string): Promise<void>;
}

interface StopFn {
    (): void;
}

/**
 * Reproduz uma lista de SpeechItem em sequência, com controle de play/pause/stop/skip
 * e progresso (currentIndex, currentId).
 *
 * Usa o speak/stop do usePuterSpeech subjacente — não duplica a lógica de TTS.
 */
export function useSequentialSpeech(speak: SpeakFn, stop: StopFn) {
    const [status, setStatus] = useState<Status>('idle');
    const [currentIndex, setCurrentIndex] = useState(-1);
    const queueRef = useRef<SpeechItem[]>([]);
    const cancelRef = useRef(false);
    const pausedRef = useRef(false);
    const indexRef = useRef(-1);

    // Espera até pausedRef voltar a false. Usa polling leve.
    const waitWhilePaused = useCallback(async () => {
        while (pausedRef.current && !cancelRef.current) {
            await new Promise(r => setTimeout(r, 150));
        }
    }, []);

    const runFromIndex = useCallback(async (startIdx: number) => {
        const queue = queueRef.current;
        for (let i = startIdx; i < queue.length; i++) {
            if (cancelRef.current) return;
            await waitWhilePaused();
            if (cancelRef.current) return;

            indexRef.current = i;
            setCurrentIndex(i);
            const item = queue[i];
            try {
                await speak(item.text, item.language, item.id);
            } catch {
                // Continua mesmo se uma frase falhar
            }
            if (cancelRef.current) return;

            // Pausa breve entre frases
            await new Promise(r => setTimeout(r, 400));
        }
        // Terminou normalmente
        cancelRef.current = false;
        pausedRef.current = false;
        indexRef.current = -1;
        setCurrentIndex(-1);
        setStatus('idle');
    }, [speak, waitWhilePaused]);

    const start = useCallback((items: SpeechItem[]) => {
        // Cancela qualquer execução anterior
        cancelRef.current = true;
        stop();

        // Inicia nova
        queueRef.current = items;
        cancelRef.current = false;
        pausedRef.current = false;
        setStatus('playing');
        runFromIndex(0);
    }, [runFromIndex, stop]);

    const pause = useCallback(() => {
        if (status !== 'playing') return;
        pausedRef.current = true;
        stop(); // interrompe áudio em curso
        setStatus('paused');
    }, [status, stop]);

    const resume = useCallback(() => {
        if (status !== 'paused') return;
        pausedRef.current = false;
        const idx = indexRef.current >= 0 ? indexRef.current : 0;
        setStatus('playing');
        runFromIndex(idx);
    }, [status, runFromIndex]);

    const stopAll = useCallback(() => {
        cancelRef.current = true;
        pausedRef.current = false;
        stop();
        indexRef.current = -1;
        setCurrentIndex(-1);
        setStatus('idle');
    }, [stop]);

    const next = useCallback(() => {
        if (queueRef.current.length === 0) return;
        const target = Math.min(indexRef.current + 1, queueRef.current.length - 1);
        if (target === indexRef.current) {
            // já está no último — para
            stopAll();
            return;
        }
        cancelRef.current = true;
        stop();
        // micro-task para deixar a corrida atual encerrar
        setTimeout(() => {
            cancelRef.current = false;
            pausedRef.current = false;
            setStatus('playing');
            runFromIndex(target);
        }, 50);
    }, [runFromIndex, stop, stopAll]);

    const prev = useCallback(() => {
        if (queueRef.current.length === 0) return;
        const target = Math.max(indexRef.current - 1, 0);
        cancelRef.current = true;
        stop();
        setTimeout(() => {
            cancelRef.current = false;
            pausedRef.current = false;
            setStatus('playing');
            runFromIndex(target);
        }, 50);
    }, [runFromIndex, stop]);

    // Cleanup no unmount
    useEffect(() => {
        return () => {
            cancelRef.current = true;
            stop();
        };
    }, [stop]);

    return {
        status,
        currentIndex,
        total: queueRef.current.length,
        currentId: currentIndex >= 0 ? queueRef.current[currentIndex]?.id : null,
        start,
        pause,
        resume,
        stop: stopAll,
        next,
        prev,
    };
}
