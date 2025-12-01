// types.ts

export interface Keyword {
    id: string;
    word: string;
    pinyin: string;
    meaning: string;
    language?: 'zh' | 'de';
}

export interface StudyItem {
    id: number | string; // Aceita ID numérico (antigo) ou string (Firebase)
    chinese: string;
    pinyin: string;
    translation: string;
    tokens: string[];
    keywords: Keyword[];
    language?: 'zh' | 'de';
    createdAt?: any; // <--- NOVA LINHA: Necessária para o banco de dados ordenar
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

// Declaração global para bibliotecas externas
declare global {
    interface Window {
        pinyinPro: {
            pinyin: (text: string, options?: any) => any;
        };
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }
}