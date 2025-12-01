
import { useCallback, useEffect, useState } from 'react';

export const useSpeech = () => {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    // Carrega a lista de vozes (necessário pois o Chrome carrega assincronamente)
    useEffect(() => {
        const loadVoices = () => {
            const available = window.speechSynthesis.getVoices();
            setVoices(available);
        };

        loadVoices();
        
        // Evento disparado quando as vozes são carregadas pelo navegador
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    const speak = useCallback((text: string, language: 'zh' | 'de' = 'zh') => {
        if (!('speechSynthesis' in window)) return;
        
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Definições alvo
        const targetLangCode = language === 'de' ? 'de-DE' : 'zh-CN';
        const targetLangShort = language === 'de' ? 'de' : 'zh';

        utterance.lang = targetLangCode;
        
        // Tenta encontrar a melhor voz instalada para o idioma
        if (voices.length > 0) {
            // 1. Tenta correspondência exata (ex: 'de-DE')
            // 2. Tenta correspondência parcial (ex: 'de_DE' ou apenas 'de')
            const specificVoice = voices.find(v => v.lang === targetLangCode) || 
                                  voices.find(v => v.lang.startsWith(targetLangShort));
            
            if (specificVoice) {
                utterance.voice = specificVoice;
            } else {
                console.warn(`Nenhuma voz encontrada para ${targetLangCode}. Usando padrão.`);
            }
        }
        
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }, [voices]);

    return speak;
};
