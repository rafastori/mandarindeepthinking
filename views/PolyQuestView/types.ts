// PolyQuest Types — schema v2 (RPG cooperativo)

export type GamePhase =
    | 'lobby'
    | 'exploration'
    | 'quest'
    | 'intruder'
    | 'boss'
    | 'victory'
    | 'defeat';

export type PlayerClass = 'mage' | 'bard' | 'warrior';

export interface ClassDef {
    id: PlayerClass;
    name: string;
    icon: string;        // emoji para HUD
    color: string;       // hex
    perkName: string;
    perkDesc: string;
    perkCooldownMs: number;
}

export const PLAYER_CLASSES: ClassDef[] = [
    {
        id: 'mage',
        name: 'Mago',
        icon: '🧙',
        color: '#8B5CF6',
        perkName: 'Revelar Inicial',
        perkDesc: 'Mostra a primeira letra da resposta correta para a sala.',
        perkCooldownMs: 45_000,
    },
    {
        id: 'bard',
        name: 'Bardo',
        icon: '🎵',
        color: '#06B6D4',
        perkName: 'Inspiração',
        perkDesc: 'Próxima resposta correta da party vale 2x pontos.',
        perkCooldownMs: 60_000,
    },
    {
        id: 'warrior',
        name: 'Guerreiro',
        icon: '⚔️',
        color: '#EF4444',
        perkName: 'Investida',
        perkDesc: 'Causa 25 de dano direto ao boss (só na fase de boss).',
        perkCooldownMs: 35_000,
    },
];

export interface PolyQuestPlayer {
    id: string;
    name: string;
    avatarUrl: string;
    score: number;
    isReady: boolean;
    consecutiveCorrect: number;
    helpCount: number;
    totalScore: number;
    cls?: PlayerClass;
    perkUsedAt?: number;          // timestamp do último uso (cooldown)
    bardBuffActive?: boolean;     // se o próximo acerto vale 2x
}

export interface WordEnigma {
    word: string;
    translation: string;
    alternatives: string[];
    isDiscovered: boolean;
    discoveredBy?: string;
    needsHelp?: boolean;
    helpRequestedBy?: string;
    helpedBy?: string;
    synonym?: string;
    attempts: number;
    activeSolver?: string;
    revealedInitial?: boolean;    // perk do mago
}

export interface GameConfig {
    sourceLang: string;
    targetLang: string;
    originalText: string;
    tokens: string[];
    minWords: number;
    difficulty: string;
    context?: string;             // 'gemini' | 'library'
    selectedFolderIds?: string[];
}

export interface ComboState {
    count: number;                // acertos consecutivos da PARTY (não individual)
    multiplier: number;           // 1.0, 1.25, 1.5, 2.0
    lastCorrectAt: number;        // timestamp
    lastCorrectBy: string;        // userId
}

export interface BossDef {
    id: string;
    name: string;
    sprite: 'lich' | 'dragon' | 'shadow' | 'oracle';   // tipo do SVG
    color: string;
    taunts: string[];             // frases que o boss solta ocasionalmente
}

export interface BossState {
    def: BossDef;
    hp: number;
    maxHp: number;
    targetSentence: string;
    blocks: string[];
    placedBlocks: { id: string; text: string; placedBy: string; placedAt: number }[];
    nextAttackAt: number;         // timestamp; 0 = sem ataque ativo
    attackPower: number;
    attackIntervalMs: number;
    attemptCount: number;
    lastTauntAt?: number;
    lastDamageAt?: number;        // pra animar o sprite
    state: 'idle' | 'wounded' | 'dying' | 'dead';
}

export interface IntruderState {
    fakeWord: string;
    insertedAtIndex: number;      // posição no array de tokens
    startedAt: number;
    timeoutMs: number;
    resolved: boolean;
    resolvedBy?: string;
    success?: boolean;
}

export interface PolyQuestRoom {
    id: string;
    name: string;
    hostId: string;
    players: PolyQuestPlayer[];
    phase: GamePhase;
    config: GameConfig;

    // RPG state
    partyHP: number;              // 0-maxPartyHP
    maxPartyHP: number;
    selectedWords: string[];
    enigmas: WordEnigma[];
    combo: ComboState;
    boss: BossState | null;
    intruder: IntruderState | null;
    intruderTriggered: boolean;   // já disparou uma vez nessa partida

    // Metadados
    createdAt: Date;
    startedAt?: Date;
    finishedAt?: Date;
    updatedAt?: Date;
}

export interface GameResult {
    roomId: string;
    score: number;
    rank: number;
    totalPlayers: number;
    won: boolean;
    bossDefeated: boolean;
    wordsLearned: number;
    helpsGiven: number;
}

export interface Language {
    code: string;
    name: string;
    flag: string;
    isoCode: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
    { code: 'de', name: 'Alemão', flag: '🇩🇪', isoCode: 'de' },
    { code: 'fr', name: 'Francês', flag: '🇫🇷', isoCode: 'fr' },
    { code: 'es', name: 'Espanhol', flag: '🇪🇸', isoCode: 'es' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹', isoCode: 'it' },
    { code: 'en', name: 'Inglês', flag: '🇬🇧', isoCode: 'gb' },
    { code: 'pt', name: 'Português', flag: '🇧🇷', isoCode: 'br' },
    { code: 'zh', name: 'Chinês', flag: '🇨🇳', isoCode: 'cn' },
    { code: 'ja', name: 'Japonês', flag: '🇯🇵', isoCode: 'jp' },
    { code: 'ko', name: 'Coreano', flag: '🇰🇷', isoCode: 'kr' },
];

// Compat shim: alguns componentes externos podem importar GAME_CONSTANTS antigo.
// Re-exporto a partir das RULES novas (em rules.ts) para não quebrar.
export { RULES as GAME_CONSTANTS } from './rules';
