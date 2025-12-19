// Tipo centralizado para idiomas suportados
export type SupportedLanguage = 'zh' | 'de' | 'pt' | 'en' | 'fr' | 'es' | 'it' | 'ja' | 'ko';

// Lista de idiomas disponíveis para estudo (excluindo português que é língua nativa)
export const STUDY_LANGUAGES: { code: SupportedLanguage; name: string; flag: string }[] = [
    { code: 'de', name: 'Alemão', flag: '🇩🇪' },
    { code: 'fr', name: 'Francês', flag: '🇫🇷' },
    { code: 'es', name: 'Espanhol', flag: '🇪🇸' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'en', name: 'Inglês', flag: '🇬🇧' },
    { code: 'zh', name: 'Chinês', flag: '🇨🇳' },
    { code: 'ja', name: 'Japonês', flag: '🇯🇵' },
    { code: 'ko', name: 'Coreano', flag: '🇰🇷' },
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