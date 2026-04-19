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
    const [isPuterConnected, setIsPuterConnected] = useState(() => {
        try { return typeof puter !== 'undefined' && !!puter.auth?.isSignedIn(); }
        catch { return false; }
    });
    const [puterUsername, setPuterUsername] = useState<string | null>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [playingId, setPlayingId] = useState<string | null>(null); // ID do item em reprodução
    const speakingRef = useRef(false);
    const queueRef = useRef<Array<{ text: string; language: SupportedLanguage; resolve: () => void }>>([]);
    const currentAudioRef = useRef<HTMLAudioElement | null>(null); // Ref para áudio Puter atual

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

            utterance.onend = () => { setPlayingId(null); resolve(); };
            utterance.onerror = () => { setPlayingId(null); resolve(); };

            window.speechSynthesis.speak(utterance);

            // Fallback timeout in case onend doesn't fire
            setTimeout(() => { setPlayingId(null); resolve(); }, 10000);
        });
    }, [voices]);

    // Para qualquer áudio em reprodução
    const stop = useCallback(() => {
        // Para Web Speech API
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        // Para áudio Puter (HTMLAudioElement ou similar)
        if (currentAudioRef.current) {
            try {
                // Tenta pause() - método padrão de HTMLAudioElement
                if (typeof currentAudioRef.current.pause === 'function') {
                    currentAudioRef.current.pause();
                }
                // Tenta resetar o tempo
                if ('currentTime' in currentAudioRef.current) {
                    currentAudioRef.current.currentTime = 0;
                }
                // Tenta stop() caso o objeto tenha esse método
                if (typeof (currentAudioRef.current as any).stop === 'function') {
                    (currentAudioRef.current as any).stop();
                }
            } catch (e) {
                console.warn('Erro ao parar áudio:', e);
            }
            currentAudioRef.current = null;
        }
        setPlayingId(null);
    }, []);

    // Função principal de fala - retorna Promise que resolve quando o áudio TERMINA
    // id: identificador opcional do item (para toggle play/pause na UI)
    const speak = useCallback(async (text: string, language: SupportedLanguage = 'zh', id?: string): Promise<void> => {
        // Se já está tocando este mesmo ID, para e retorna (toggle)
        if (id && playingId === id) {
            stop();
            return;
        }

        // Para qualquer áudio anterior antes de iniciar novo
        stop();

        // Seta o ID em reprodução
        if (id) setPlayingId(id);

        // Tenta usar Puter se estiver conectado
        if (isPuterConnected && typeof puter !== 'undefined') {
            try {
                // Mapeamento de idiomas para códigos AWS Polly e vozes
                const voiceMap: Record<SupportedLanguage, { lang: string; voice: string }> = {
                    'pt': { lang: 'pt-BR', voice: 'Camila' },     // Português brasileiro
                    'zh': { lang: 'cmn-CN', voice: 'Zhiyu' },     // Chinês mandarim
                    'de': { lang: 'de-DE', voice: 'Vicki' },      // Alemão
                    'en': { lang: 'en-US', voice: 'Joanna' },     // Inglês
                    'fr': { lang: 'fr-FR', voice: 'Celine' },     // Francês
                    'es': { lang: 'es-ES', voice: 'Lucia' },      // Espanhol
                    'it': { lang: 'it-IT', voice: 'Bianca' },     // Italiano
                    'ja': { lang: 'ja-JP', voice: 'Mizuki' },     // Japonês
                    'ko': { lang: 'ko-KR', voice: 'Seoyeon' },    // Coreano
                };

                const config = voiceMap[language] || voiceMap['pt'];

                // Usa AWS Polly (provider padrão) com idioma explícito
                const audio = await puter.ai.txt2speech(text, {
                    language: config.lang,
                    voice: config.voice,
                    engine: 'neural'  // Vozes neurais são mais naturais
                });

                if (audio && typeof audio.play === 'function') {
                    currentAudioRef.current = audio; // Armazena referência para poder parar

                    // Retorna Promise que resolve quando o áudio TERMINA de tocar
                    return new Promise<void>((resolve) => {
                        // Listener para quando o áudio terminar
                        const onEnded = () => {
                            audio.removeEventListener?.('ended', onEnded);
                            setPlayingId(null);
                            resolve();
                        };

                        // Adiciona listener de fim
                        if (typeof audio.addEventListener === 'function') {
                            audio.addEventListener('ended', onEnded);
                        }

                        // Inicia reprodução
                        audio.play().catch(() => { setPlayingId(null); resolve(); });

                        // Fallback timeout de 15s caso o evento ended não dispare
                        setTimeout(() => {
                            audio.removeEventListener?.('ended', onEnded);
                            setPlayingId(null);
                            resolve();
                        }, 15000);
                    });
                }
            } catch (e) {
                console.warn('Puter TTS falhou, usando fallback:', e);
                setPlayingId(null);
            }
        }

        // Fallback para Web Speech API
        await fallbackSpeak(text, language);
    }, [isPuterConnected, fallbackSpeak, playingId, stop]);

    // Fala múltiplos textos em sequência
    const speakSequence = useCallback(async (items: Array<{ text: string; language: SupportedLanguage }>): Promise<void> => {
        for (const item of items) {
            await speak(item.text, item.language);
            // Pausa de 1 segundo entre itens para evitar sobreposição
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }, [speak]);

    return {
        speak,
        speakSequence,
        stop,
        playingId,
        isPuterConnected,
        connectPuter,
        disconnectPuter,
        puterUsername
    };
};
