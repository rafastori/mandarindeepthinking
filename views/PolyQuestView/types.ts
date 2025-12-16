// PolyQuest Types
// Tipos específicos para o jogo PolyQuest

// Estados/Fases do jogo
export type GamePhase = 'lobby' | 'exploration' | 'quest' | 'intruder' | 'boss' | 'finished';

// Jogador do PolyQuest
export interface PolyQuestPlayer {
    id: string;
    name: string;
    avatarUrl: string;
    score: number;
    isReady: boolean;
    isFatigued: boolean;
    fatigueEndsAt?: number; // timestamp
    consecutiveCorrect: number;
    helpCount: number; // Para MVP Colaborativo
}

// Palavra/Enigma
export interface WordEnigma {
    word: string;
    translation: string;
    alternatives: string[]; // Opções incorretas
    isDiscovered: boolean;
    discoveredBy?: string; // ID do jogador que resolveu
    needsHelp?: boolean;
    helpRequestedBy?: string; // ID do jogador que pediu ajuda
    helpedBy?: string; // ID do jogador que ajudou
    synonym?: string; // Gerado pela IA quando alguém pede ajuda
    attempts: number; // Quantas vezes foi tentada
}

// Configuração do jogo
export interface GameConfig {
    sourceLang: string; // Código do idioma (ex: 'de', 'fr', 'es')
    targetLang: string; // Código do idioma (ex: 'pt', 'en')
    originalText: string;
    minWords: number; // Mínimo de palavras no texto (padrão: 40)
}

// Sala do PolyQuest
export interface PolyQuestRoom {
    id: string;
    name: string;
    hostId: string;
    players: PolyQuestPlayer[];
    phase: GamePhase;

    // Configuração
    config: GameConfig;

    // Estado do jogo
    confidence: number; // 0-100 (barra de vida compartilhada)
    selectedWords: string[]; // Palavras marcadas na fase de exploração
    enigmas: WordEnigma[];
    currentEnigmaIndex: number; // Índice do enigma atual

    // Eventos especiais
    intruderWord?: string;
    intruderFound?: boolean;
    intruderFoundBy?: string;

    bossPhrase?: string;
    bossPhraseBlocks?: string[];

    // Combos e multiplicadores
    lastCorrectBy?: string; // ID do último jogador que acertou
    comboMultiplier: number; // 1.0, 1.5, 2.0, etc.

    // Metadados
    createdAt: Date;
    startedAt?: Date;
    finishedAt?: Date;
}

// Ação de jogo (para histórico/logs)
export interface GameAction {
    type: 'correct' | 'wrong' | 'help_request' | 'help_given' | 'intruder_found' | 'boss_attempt';
    playerId: string;
    enigmaWord?: string;
    timestamp: Date;
    pointsAwarded?: number;
}

// Resultado final
export interface GameResult {
    roomId: string;
    players: {
        id: string;
        name: string;
        score: number;
        helpCount: number;
    }[];
    masterPolyglot: string; // ID do jogador com maior pontuação
    mvpCollaborative: string; // ID do jogador com mais ajudas
    totalTime: number; // Em segundos
    finalConfidence: number;
    victory: boolean;
}

// Idiomas suportados
export interface Language {
    code: string;
    name: string;
    flag: string; // Emoji da bandeira
}

export const SUPPORTED_LANGUAGES: Language[] = [
    { code: 'de', name: 'Alemão', flag: '🇩🇪' },
    { code: 'fr', name: 'Francês', flag: '🇫🇷' },
    { code: 'es', name: 'Espanhol', flag: '🇪🇸' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'en', name: 'Inglês', flag: '🇬🇧' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'zh', name: 'Chinês', flag: '🇨🇳' },
    { code: 'ja', name: 'Japonês', flag: '🇯🇵' },
    { code: 'ko', name: 'Coreano', flag: '🇰🇷' },
];

// Constantes do jogo
export const GAME_CONSTANTS = {
    MIN_WORDS: 40,
    INITIAL_CONFIDENCE: 100,
    ERROR_PENALTY: 15, // Porcentagem
    CORRECT_POINTS: 10,
    HELP_GIVEN_POINTS: 5,
    HELP_RECEIVED_POINTS: 5,
    HELP_RECEIVED_SECOND_ATTEMPT_POINTS: 3,
    INTRUDER_POINTS: 20,
    BOSS_VICTORY_POINTS: 50,
    BOSS_ERROR_PENALTY: 20, // Porcentagem
    FATIGUE_THRESHOLD: 2, // Acertos consecutivos
    FATIGUE_DURATION: 10000, // 10 segundos em ms
    INTRUDER_TRIGGER_PERCENT: 0.5, // 50% dos enigmas
    COMBO_MULTIPLIERS: [1.0, 1.5, 2.0, 2.5, 3.0],
};
