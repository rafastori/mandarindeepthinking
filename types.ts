// Tipo centralizado para idiomas suportados
export type SupportedLanguage = 'zh' | 'de' | 'pt' | 'en' | 'fr' | 'es' | 'it' | 'ja' | 'ko';

// Lista de idiomas disponíveis para estudo (excluindo português que é língua nativa)
export const STUDY_LANGUAGES: { code: SupportedLanguage; name: string; flag: string; isoCode: string }[] = [
    { code: 'de', name: 'Alemão', flag: '🇩🇪', isoCode: 'de' },
    { code: 'fr', name: 'Francês', flag: '🇫🇷', isoCode: 'fr' },
    { code: 'es', name: 'Espanhol', flag: '🇪🇸', isoCode: 'es' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹', isoCode: 'it' },
    { code: 'en', name: 'Inglês', flag: '🇬🇧', isoCode: 'gb' },
    { code: 'zh', name: 'Chinês', flag: '🇨🇳', isoCode: 'cn' },
    { code: 'ja', name: 'Japonês', flag: '🇯🇵', isoCode: 'jp' },
    { code: 'ko', name: 'Coreano', flag: '🇰🇷', isoCode: 'kr' },
];

export interface Keyword {
    id: string;
    word: string;
    pinyin: string;
    meaning: string;
    language?: SupportedLanguage;
}

export interface StudyItem {
    id: number | string;
    chinese: string;
    pinyin: string;
    translation: string;
    tokens: string[];
    keywords: Keyword[];
    language?: SupportedLanguage;
    createdAt?: any;
    type?: 'text' | 'word';
    originalSentence?: string;
    folderPath?: string; // Ex: "Aula 1" ou "Curso/Aula 1/Gramática"
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
    // Gamification fields
    totalTime?: number; // Total time in seconds
    tabTime?: Record<string, number>; // Time per tab in seconds
    streak?: number; // Consecutive days
    lastLoginDate?: string; // ISO date string YYYY-MM-DD
    points?: number; // Total XP/points
    inventory?: InventoryItem[];
    achievements?: Achievement[];
    studyMoreIds?: string[]; // IDs de palavras marcadas para "estudar mais" (2x frequência)
}

export interface InventoryItem {
    id: string;
    name: string;
    icon: string; // Emoji or lucide icon name
    unlockedAt: string; // ISO date
    type: 'avatar' | 'badge' | 'powerup';
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    unlockedAt?: string; // ISO date, undefined if locked
    progress?: number; // 0-100
    target?: number; // e.g., 7 for "7-day streak"
}

// Session stats for the summary screen
export interface SessionStats {
    startTime: number; // timestamp
    endTime?: number;
    wordsReviewed: number;
    correctAnswers: number;
    wrongAnswers: number;
    tabTime: Record<string, number>;
    pointsEarned: number;
}

export interface Player {
    id: string;
    name: string;
    avatarUrl?: string;
    score?: number;
    isBot?: boolean;
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
        lang: SupportedLanguage;
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

    // Contador de rodadas jogadas (para game over após 4 rodadas)
    roundsPlayed?: number;
}

declare global {
    interface Window {
        pinyinPro: {
            pinyin: (text: string, options?: any) => any;
        };
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }

    // Puter SDK Types
    const puter: {
        ai: {
            txt2speech: (text: string, options?: {
                provider?: 'aws-polly' | 'openai' | 'elevenlabs';
                voice?: string;
                model?: string;
                language?: string;
                engine?: 'standard' | 'neural' | 'generative';
                response_format?: string;
            }) => Promise<HTMLAudioElement>;
        };
        auth: {
            isSignedIn: () => boolean;
            signIn: () => Promise<{ username: string }>;
            signOut: () => Promise<void>;
            getUser: () => { username: string } | null;
        };
    };
}