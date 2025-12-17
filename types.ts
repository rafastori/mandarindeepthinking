export interface Keyword {
    id: string;
    word: string;
    pinyin: string;
    meaning: string;
    language?: 'zh' | 'de';
}

export interface StudyItem {
    id: number | string;
    chinese: string;
    pinyin: string;
    translation: string;
    tokens: string[];
    keywords: Keyword[];
    language?: string;
    createdAt?: any;
    type?: 'text' | 'word';
    originalSentence?: string;
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

export interface Player {
    id: string;
    name: string;
    avatarUrl?: string;
    score?: number;
}

// ATUALIZAÇÃO: Card agora tem distratores
export interface GameCard {
    word: string;
    pinyin: string;
    meaning: string;
    example: string;
    distractors: string[]; // <--- NOVO
}

export interface GameRoom {
    id: string;
    name: string;
    players: Player[];
    hostId: string;
    createdAt: any;

    status: 'lobby' | 'review' | 'playing' | 'finished' | 'regenerating';

    config?: {
        topic: string;
        lang: 'zh' | 'de';
        diff: string;
    };

    targetScore: number;
    teamScore: number;

    deck: GameCard[];

    // MUDANÇA TOTAL NA LÓGICA DE CONTROLE
    // Fila de índices de cartas disponíveis (ex: [0, 1, 2, 5])
    cardQueue?: number[];

    // Mapeia qual carta está com qual jogador { 'user123': 0 }
    activeHands?: Record<string, number>;

    // Mantemos para compatibilidade temporária, mas não usaremos mais da mesma forma
    currentCardIndex?: number;
    roundAnswers?: Record<string, boolean>;
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