import { SupportedLanguage } from '../../types';

// Contextos disponíveis para o jogo
export type DominoContext =
    | 'language'      // Tradução de idiomas
    | 'medicine'      // Termos médicos
    | 'computing'     // Termos de TI
    | 'engineering'   // Termos de engenharia
    | 'chemistry'     // Termos químicos
    | 'biology'       // Termos biológicos
    | 'law'           // Termos jurídicos
    | 'library'       // Biblioteca Pessoal de Estudo
    | 'custom';       // Personalizado

// Par termo/definição gerado pela IA ou selecionado da biblioteca
export interface TermPair {
    index: number;      // 0-12
    term: string;       // Palavra no idioma estudado ou termo técnico
    definition: string; // Tradução ou definição
    originalRefId?: string; // ID original do banco do usuário (para gamificação)
    language?: SupportedLanguage; // Idioma original da palavra no DB (ex: 'de', 'ja', 'es')
}

// Peça de dominó
export interface DominoPiece {
    id: string;
    leftIndex: number;   // Índice (0-12) do lado esquerdo
    rightIndex: number;  // Índice (0-12) do lado direito
    leftText: string;    // Texto do lado esquerdo (termo OU definição)
    rightText: string;   // Texto do lado direito (termo OU definição)
    isHub?: boolean;     // Peça central inicial
}

// Peça colocada no tabuleiro
export interface PlacedPiece {
    piece: DominoPiece;
    position: number;
    orientation: 'normal' | 'flipped';
    placedBy: string;
}

// Trem (linha de peças)
export interface Train {
    id: string;
    ownerId: string | null;  // null = Trem Mexicano
    pieces: PlacedPiece[];
    isOpen: boolean;         // Outros podem jogar aqui
    openEndIndex: number;    // Índice (0-12) da ponta aberta
    openEndText: string;     // Texto da ponta aberta
}

// Jogador
export interface DominoPlayer {
    id: string;
    name: string;
    avatarUrl: string;
    hand: DominoPiece[];
    score: number;
    isReady: boolean;
    isBot?: boolean;
    isPaused?: boolean;      // Jogador pausado (saiu temporariamente)
    pausedAt?: any;          // Timestamp de quando pausou (para timeout 2min)
}

// Configuração do jogo
export interface DominoConfig {
    context: DominoContext;
    sourceLang?: SupportedLanguage;
    targetLang?: SupportedLanguage;
    customTopic?: string;
    customContext?: string;  // Contexto adicional (disponível para TODOS os modos)
    difficulty: 'Iniciante' | 'Intermediário' | 'Avançado';
    selectedFolderIds?: string[]; // IDs das pastas da biblioteca selecionadas pelo usuário
}

// Emote broadcast para interações
export interface EmoteBroadcast {
    emoteId: string;
    emoji: string;
    soundType?: 'applause' | 'laugh' | 'bell' | 'horn' | 'tick' | 'party';
    senderId: string;
    senderName: string;
    timestamp: number;
}

// Sala do jogo
export interface DominoRoom {
    id: string;
    name: string;
    hostId: string;
    players: DominoPlayer[];
    phase: 'lobby' | 'playing' | 'finished';
    config: DominoConfig;

    // Dados do deck (gerados pela IA)
    termPairs: TermPair[];

    // Estado do jogo
    boneyard: DominoPiece[];
    trains: Train[];
    hubPiece?: DominoPiece;
    currentTurn: string;
    consecutivePasses: number;

    // Interações (emotes)
    emotes: EmoteBroadcast[];

    createdAt: any;
    startedAt?: any;
    finishedAt?: any;
}

// Constantes do jogo
export const DOMINO_CONSTANTS = {
    TOTAL_TERMS: 13,         // 0-12, como no double-12
    TOTAL_PIECES: 91,        // (13 * 14) / 2 = 91 combinações
    PIECES_2_4_PLAYERS: 15,
    PIECES_5_6_PLAYERS: 12,
    MAX_PLAYERS: 6,
    MIN_PLAYERS: 2,
};

// Contextos disponíveis para seleção
export const CONTEXT_OPTIONS: { value: DominoContext; label: string; icon: string }[] = [
    { value: 'library', label: 'Biblioteca', icon: '📚' },
    { value: 'language', label: 'Idiomas', icon: '🌍' },
    { value: 'medicine', label: 'Medicina', icon: '🏥' },
    { value: 'computing', label: 'Computação', icon: '💻' },
    { value: 'engineering', label: 'Engenharia', icon: '⚙️' },
    { value: 'chemistry', label: 'Química', icon: '🧪' },
    { value: 'biology', label: 'Biologia', icon: '🧬' },
    { value: 'law', label: 'Direito', icon: '⚖️' },
    { value: 'custom', label: 'Personalizado', icon: '✨' },
];
