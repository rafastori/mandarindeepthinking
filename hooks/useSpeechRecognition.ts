import { useState, useCallback, useRef, useEffect } from 'react';
import { SupportedLanguage } from '../types';

// Interface abstrata para permitir migração futura para Whisper/Transformers.js
interface SpeechRecognitionResult {
    transcript: string;
    confidence: number;
    isFinal: boolean;
}

interface UseSpeechRecognitionReturn {
    isListening: boolean;
    isSupported: boolean;
    transcript: string;
    confidence: number;
    error: string | null;
    startListening: (language: SupportedLanguage) => void;
    stopListening: () => void;
    resetTranscript: () => void;
}

// Mapeamento de idiomas para códigos do Web Speech API
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

/**
 * Hook para reconhecimento de fala usando Web Speech API
 * 
 * NOTA: Este hook foi projetado com interface abstrata para permitir
 * migração futura para Transformers.js + Whisper sem alterar os componentes consumidores.
 * 
 * Para migrar, basta substituir a implementação interna mantendo a mesma interface.
 */
export const useSpeechRecognition = (): UseSpeechRecognitionReturn => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [confidence, setConfidence] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<any>(null);

    // Verificar suporte do browser
    const isSupported = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    // Inicializar reconhecimento
    useEffect(() => {
        if (!isSupported) return;

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true; // Não para ao detectar silêncio
        recognitionRef.current.interimResults = true;
        recognitionRef.current.maxAlternatives = 1;

        recognitionRef.current.onresult = (event: any) => {
            // Pegar todos os resultados e concatenar
            let fullTranscript = '';
            for (let i = 0; i < event.results.length; i++) {
                fullTranscript += event.results[i][0].transcript;
            }
            const lastResult = event.results[event.results.length - 1];
            const confidence = lastResult[0].confidence || 0;

            setTranscript(fullTranscript);
            setConfidence(confidence);
        };

        recognitionRef.current.onerror = (event: any) => {
            // Ignorar erros de "no-speech" e "aborted" em modo contínuo
            if (event.error === 'no-speech' || event.error === 'aborted') {
                return;
            }
            console.error('Speech recognition error:', event.error);
            setError(event.error);
            setIsListening(false);
        };

        recognitionRef.current.onend = () => {
            // Só marca como não-ouvindo se realmente queremos parar
            setIsListening(false);
        };

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, [isSupported]);

    const startListening = useCallback((language: SupportedLanguage) => {
        if (!isSupported || !recognitionRef.current) {
            setError('Speech recognition not supported in this browser');
            return;
        }

        setError(null);
        setTranscript('');
        setConfidence(0);

        recognitionRef.current.lang = langMap[language] || 'en-US';

        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch (err) {
            console.error('Failed to start recognition:', err);
            setError('Failed to start speech recognition');
        }
    }, [isSupported]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, [isListening]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setConfidence(0);
        setError(null);
    }, []);

    return {
        isListening,
        isSupported,
        transcript,
        confidence,
        error,
        startListening,
        stopListening,
        resetTranscript,
    };
};
