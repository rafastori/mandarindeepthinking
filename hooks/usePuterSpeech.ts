import { useCallback, useEffect, useState } from 'react';
import { SupportedLanguage } from '../types';

/**
 * Hook para síntese de voz com Puter TTS (IA) e fallback para Web Speech API
 * 
 * Retorna:
 * - speak: função para falar texto
 * - isPuterConnected: true se Puter está disponível e logado
 * - connectPuter: função para iniciar login no Puter
 * - puterUsername: nome do usuário Puter (se logado)
 */
export const usePuterSpeech = () => {
    const [isPuterConnected, setIsPuterConnected] = useState(false);
    const [puterUsername, setPuterUsername] = useState<string | null>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

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

    // Fallback para Web Speech API
    const fallbackSpeak = useCallback((text: string, language: SupportedLanguage = 'zh') => {
        if (!('speechSynthesis' in window)) return;

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);

        const langMap: Record<SupportedLanguage, string> = {
            'zh': 'zh-CN',
            'de': 'de-DE',
            'pt': 'pt-BR',
            'en': 'en-US',
            'fr': 'fr-FR',
            'es': 'es-ES',
            'it': 'it-IT',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
        };

        const targetLangCode = langMap[language] || 'zh-CN';
        const targetLangShort = language;

        utterance.lang = targetLangCode;

        if (voices.length > 0) {
            const specificVoice = voices.find(v => v.lang === targetLangCode) ||
                voices.find(v => v.lang.startsWith(targetLangShort));
            if (specificVoice) {
                utterance.voice = specificVoice;
            }
        }

        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }, [voices]);

    // Função principal de fala
    const speak = useCallback(async (text: string, language: SupportedLanguage = 'zh') => {
        // Tenta usar Puter primeiro se conectado
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
                // Se falhar, marca como desconectado e usa fallback
                setIsPuterConnected(false);
            }
        }

        // Fallback para Web Speech API
        fallbackSpeak(text, language);
    }, [isPuterConnected, fallbackSpeak]);

    return {
        speak,
        isPuterConnected,
        connectPuter,
        disconnectPuter,
        puterUsername
    };
};
