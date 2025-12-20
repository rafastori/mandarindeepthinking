import { useState, useCallback, useRef, useEffect } from 'react';
import { SupportedLanguage } from '../types';

export type RecognitionEngine = 'native' | 'whisper';

interface UseSpeechRecognitionReturn {
    isListening: boolean;
    isProcessing: boolean;
    isSupported: boolean;
    transcript: string;
    confidence: number;
    error: string | null;
    engine: RecognitionEngine;
    isModelLoading: boolean;
    modelProgress: number;
    startListening: (language: SupportedLanguage, expectedText?: string) => void;
    stopListening: () => void;
    resetTranscript: () => void;
    setEngine: (engine: RecognitionEngine) => void;
}

const langMap: Record<SupportedLanguage, string> = {
    'zh': 'zh-CN',
    'de': 'de-DE',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'fr': 'fr-FR',
    'es': 'es-ES',
    'it': 'it-IT',
    'en': 'en-US',
    'pt': 'pt-BR',
};

// Mapeamento para o Whisper (codes do Transformers.js)
const whisperLangMap: Record<string, string> = {
    'zh-CN': 'chinese',
    'de-DE': 'german',
    'ja-JP': 'japanese',
    'ko-KR': 'korean',
    'fr-FR': 'french',
    'es-ES': 'spanish',
    'it-IT': 'italian',
    'en-US': 'english',
    'pt-BR': 'portuguese',
};

export const useSpeechRecognition = (): UseSpeechRecognitionReturn => {
    const [engine, setEngineState] = useState<RecognitionEngine>(() => {
        if (typeof window === 'undefined') return 'native';
        return (localStorage.getItem('speech_engine') as RecognitionEngine) || 'native';
    });

    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [confidence, setConfidence] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [modelProgress, setModelProgress] = useState(0);

    const recognitionRef = useRef<any>(null);
    const workerRef = useRef<Worker | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const isSupported = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    const setEngine = (newEngine: RecognitionEngine) => {
        setEngineState(newEngine);
        localStorage.setItem('speech_engine', newEngine);
    };

    // --- Lógica NATIVA ---
    useEffect(() => {
        if (!isSupported || engine !== 'native' || typeof window === 'undefined') return;

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onresult = (event: any) => {
            let fullTranscript = '';
            for (let i = 0; i < event.results.length; i++) {
                fullTranscript += event.results[i][0].transcript;
            }
            setTranscript(fullTranscript);
            setConfidence(event.results[event.results.length - 1][0].confidence || 0.9);
        };

        recognitionRef.current.onerror = (event: any) => {
            if (event.error === 'no-speech' || event.error === 'aborted') return;
            setError(event.error);
            setIsListening(false);
        };

        recognitionRef.current.onend = () => setIsListening(false);

        return () => recognitionRef.current?.abort();
    }, [isSupported, engine]);

    // --- Lógica WHISPER ---
    useEffect(() => {
        if (engine !== 'whisper' || typeof window === 'undefined') return;

        // Inicializar Worker
        console.log('useSpeechRecognition: Inicializando Whisper Worker...');
        try {
            workerRef.current = new Worker(new URL('../services/whisper.worker.ts', import.meta.url), {
                type: 'module'
            });
            console.log('useSpeechRecognition: Worker criado com sucesso.');
        } catch (err) {
            console.error('useSpeechRecognition: Falha ao criar o Worker:', err);
            setError('Erro ao carregar o motor de voz local.');
            return;
        }

        workerRef.current.onmessage = (event) => {
            const { status, progress, transcript: result, error: workerError } = event.data;

            switch (status) {
                case 'loading':
                    setIsModelLoading(true);
                    setModelProgress(0);
                    break;
                case 'progress':
                    if (typeof progress === 'number' && !isNaN(progress)) {
                        setModelProgress(progress);
                    }
                    break;
                case 'ready':
                    setIsModelLoading(false);
                    setModelProgress(100);
                    break;
                case 'result':
                    setTranscript(result);
                    setConfidence(1.0);
                    setIsProcessing(false);
                    break;
                case 'error':
                    console.error('Whisper worker error:', workerError);
                    setError(workerError);
                    setIsModelLoading(false);
                    setIsProcessing(false);
                    break;
            }
        };

        // Carregar modelo imediatamente ao selecionar Whisper
        workerRef.current.postMessage({ type: 'load' });

        return () => {
            workerRef.current?.terminate();
        };
    }, [engine]);

    const startRecordingWhisper = async (languageCode: string, expectedText?: string) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                setIsListening(false);
                setIsProcessing(true);
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });

                // Converter Blob para Float32Array de 16kHz (o que o Whisper espera)
                const audioContext = new AudioContext({ sampleRate: 16000 });
                const arrayBuffer = await audioBlob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                const float32Data = audioBuffer.getChannelData(0);

                workerRef.current?.postMessage({
                    type: 'transcribe',
                    audio: float32Data,
                    language: whisperLangMap[languageCode] || 'english',
                    prompt: expectedText
                });

                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsListening(true);
        } catch (err) {
            setError('Não foi possível acessar o microfone.');
        }
    };

    const startListening = useCallback((language: SupportedLanguage, expectedText?: string) => {
        setError(null);
        setTranscript('');
        setConfidence(0);

        const langCode = langMap[language] || 'zh-CN';

        if (engine === 'native') {
            if (!isSupported) return setError('Nativo não suportado');
            recognitionRef.current.lang = langCode;
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) { setError('Erro ao iniciar nativo'); }
        } else {
            startRecordingWhisper(langCode, expectedText);
        }
    }, [isSupported, engine]);

    const stopListening = useCallback(() => {
        if (engine === 'native') {
            recognitionRef.current?.stop();
        } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            // A transcrição acontece no onstop do mediaRecorder
        }
    }, [engine]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setConfidence(0);
        setError(null);
        setIsProcessing(false);
    }, []);

    return {
        isListening,
        isProcessing,
        isSupported,
        transcript,
        confidence,
        error,
        engine,
        isModelLoading,
        modelProgress,
        startListening,
        stopListening,
        resetTranscript,
        setEngine,
    };
};
