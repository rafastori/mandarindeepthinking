import { useCallback, useEffect, useState, useRef } from 'react';
import { SupportedLanguage } from '../types';

/**
 * Hook para síntese de voz com Puter TTS (IA) e fallback para Web Speech API
 * 
 * Retorna:
 * - speak: função para falar texto (retorna Promise)
 * - speakSequence: fala múltiplos textos em sequência, aguardando cada um terminar
 * - isPuterConnected: true se Puter está disponível e logado
 * - connectPuter: função para iniciar login no Puter
 * - puterUsername: nome do usuário Puter (se logado)
 */
export const usePuterSpeech = () => {
    const [isPuterConnected, setIsPuterConnected] = useState(false);
    const [puterUsername, setPuterUsername] = useState<string | null>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const speakingRef = useRef(false);
    const queueRef = useRef<Array<{ text: string; language: SupportedLanguage; resolve: () => void }>>([]);

    // Carrega vozes do navegador para fallback
    useEffect(() => {
        const loadVoices = () => {
            const available = window.speechSynthesis?.getVoices() || [];
            setVoices(available);
        };

        loadVoices();
        if (window.speechSynthesis?.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    // Verifica status do Puter ao montar
    useEffect(() => {
        const checkPuterStatus = () => {
            try {
                if (typeof puter !== 'undefined' && puter.auth) {
                    const isSignedIn = puter.auth.isSignedIn();
                    setIsPuterConnected(isSignedIn);

                    if (isSignedIn) {
                        const user = puter.auth.getUser();
                        setPuterUsername(user?.username || null);
                    }
                }
            } catch (e) {
                console.warn('Puter não disponível:', e);
                setIsPuterConnected(false);
            }
        };

        // Verifica após pequeno delay para garantir que o SDK carregou
        const timer = setTimeout(checkPuterStatus, 1000);
        return () => clearTimeout(timer);
    }, []);

    // Função para conectar ao Puter
    const connectPuter = useCallback(async () => {
        try {
            if (typeof puter === 'undefined') {
                console.warn('Puter SDK não carregado');
                return false;
            }

            const result = await puter.auth.signIn();
            if (result?.username) {
                setIsPuterConnected(true);
                setPuterUsername(result.username);
                return true;
            }
            return false;
        } catch (e) {
            console.error('Erro ao conectar ao Puter:', e);
            setIsPuterConnected(false);
            return false;
        }
    }, []);

    // Função para desconectar do Puter
    const disconnectPuter = useCallback(async () => {
        try {
            if (typeof puter !== 'undefined' && puter.auth) {
                await puter.auth.signOut();
                setIsPuterConnected(false);
                setPuterUsername(null);
            }
        } catch (e) {
            console.error('Erro ao desconectar do Puter:', e);
        }
    }, []);

    // Fallback para Web Speech API - retorna Promise
    const fallbackSpeak = useCallback((text: string, language: SupportedLanguage = 'zh'): Promise<void> => {
        return new Promise((resolve) => {
            if (!('speechSynthesis' in window)) {
                resolve();
                return;
            }

            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);

            const langMap: Record<SupportedLanguage, string[]> = {
                'zh': ['zh-CN', 'zh-TW', 'zh'],
                'de': ['de-DE', 'de-AT', 'de'],
                'pt': ['pt-BR', 'pt-PT', 'pt'],
                'en': ['en-US', 'en-GB', 'en'],
                'fr': ['fr-FR', 'fr-CA', 'fr'],
                'es': ['es-ES', 'es-MX', 'es'],
                'it': ['it-IT', 'it'],
                'ja': ['ja-JP', 'ja'],
                'ko': ['ko-KR', 'ko'],
            };

            const targetLangCodes = langMap[language] || ['zh-CN'];
            const primaryLangCode = targetLangCodes[0];

            utterance.lang = primaryLangCode;

            if (voices.length > 0) {
                let selectedVoice: SpeechSynthesisVoice | undefined;

                for (const langCode of targetLangCodes) {
                    selectedVoice = voices.find(v => v.lang === langCode);
                    if (selectedVoice) break;

                    selectedVoice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
                    if (selectedVoice) break;
                }

                if (selectedVoice) {
                    utterance.voice = selectedVoice;
                    utterance.lang = selectedVoice.lang;
                }
            }

            utterance.rate = 0.9;

            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();

            window.speechSynthesis.speak(utterance);

            // Fallback timeout in case onend doesn't fire
            setTimeout(() => resolve(), 10000);
        });
    }, [voices]);

    // Função principal de fala - retorna Promise
    const speak = useCallback(async (text: string, language: SupportedLanguage = 'zh'): Promise<void> => {
        // Tenta usar Puter se estiver conectado
        if (isPuterConnected && typeof puter !== 'undefined') {
            try {
                const audio = await puter.ai.txt2speech(text, {
                    provider: 'openai',
                    model: 'gpt-4o-mini-tts',
                    voice: 'nova',
                    response_format: 'mp3'
                });

                if (audio && typeof audio.play === 'function') {
                    await audio.play();
                    return; // Sucesso com Puter
                }
            } catch (e) {
                console.warn('Puter TTS falhou, usando fallback:', e);
            }
        }

        // Fallback para Web Speech API
        await fallbackSpeak(text, language);
    }, [isPuterConnected, fallbackSpeak]);

    // Fala múltiplos textos em sequência
    const speakSequence = useCallback(async (items: Array<{ text: string; language: SupportedLanguage }>): Promise<void> => {
        for (const item of items) {
            await speak(item.text, item.language);
            // Small pause between items
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }, [speak]);

    return {
        speak,
        speakSequence,
        isPuterConnected,
        connectPuter,
        disconnectPuter,
        puterUsername
    };
};
