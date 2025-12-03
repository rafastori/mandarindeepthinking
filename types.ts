import { Timestamp } from 'firebase/firestore';

export interface Keyword {
    id: string;
    word: string;
    pinyin: string;
    meaning: string;
    language?: 'zh' | 'de';
}

export interface StudyItem {
    id: number | string;
    chinese: string;     // Se for Texto: O texto todo. Se for Palavra: A palavra.
    pinyin: string;
    translation: string;
    tokens: string[];
    keywords: Keyword[];
    language?: 'zh' | 'de';
    createdAt?: any;
    
    // NOVOS CAMPOS PARA RESOLVER O PROBLEMA:
    type?: 'text' | 'word';  // 'text' = Artigo/Frase (Aparece na Leitura). 'word' = Card (Não aparece).
    originalSentence?: string; // Guarda a frase completa de onde a palavra saiu (para o Cloze).
}

export interface StatsHistory {
    word: string;
    date: string;
    time: string;
    type: 'general' | 'pronunciation';
}

export interface Stats {
    correct: number;
    wrong: number;
    history: StatsHistory[];
    wordCounts: Record<string, number>;
}

declare global {
    interface Window {
        pinyinPro: {
            pinyin: (text: string, options?: any) => any;
        };
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }
}