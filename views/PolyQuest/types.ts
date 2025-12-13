export enum GamePhase {
  LOBBY = 'LOBBY',
  WAITING_ROOM = 'WAITING_ROOM',
  SELECTION = 'SELECTION',
  PLAYING = 'PLAYING',
  BOSS_FIGHT = 'BOSS_FIGHT', // New Phase
  GAME_OVER = 'GAME_OVER'
}

export enum Language {
  GERMAN = 'Alemão',
  ENGLISH = 'Inglês',
  SPANISH = 'Espanhol',
  FRENCH = 'Francês',
  JAPANESE = 'Japonês',
  ITALIAN = 'Italiano',
  PORTUGUESE = 'Português',
  MANDARIN = 'Mandarim',
  RUSSIAN = 'Russo'
}

export enum Difficulty {
  BEGINNER = 'Iniciante',
  INTERMEDIATE = 'Intermediário',
  ADVANCED = 'Avançado'
}

export enum SOSState {
  NONE = 'NONE',
  ACTIVE = 'ACTIVE', // Jogador pediu ajuda, aguardando salvador
  RESOLVED_BY_ALLY = 'RESOLVED_BY_ALLY' // Salvador acertou, sinônimo liberado para o dono
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isReady: boolean;
  color: string; // Hex or Tailwind class for user identity
  fatigueExpiresAt?: number; // Timestamp when fatigue ends
}

export interface Enigma {
  id: string;
  word: string; // A palavra original
  contextSentence: string; // A frase original
  correctTranslation: string; // Tradução correta no contexto
  options: string[]; // 1 correta, 4 distratores
  difficulty: "hard";
  synonymOrDefinition: string; // Dica contextual (Sinônimo ou Definição simples)
}

export interface EnigmaStatus {
  id: string;
  isSolved: boolean;
  solvedBy?: string; // Player ID
  hintUsed: boolean;
  failedBy: string[]; // List of Player IDs who attempted and failed
  
  // Assistance Mechanics
  sosState: SOSState;
  sosRequesterId?: string; // Quem pediu ajuda
  sosHelperId?: string; // Quem ajudou
  helpCount: number; // Quantas vezes pediu ajuda (para cálculo de pontos: 5 vs 3)
}

export interface SelectedWord {
  word: string;
  userIds: string[]; // List of users who selected this word
}

// New Types for Game Events
export interface IntruderChallenge {
  intruderWord: string;
  modifiedText: string;
  intruderIndex?: number; // Optional index approximation
}

export interface BossChallenge {
  originalSentence: string;
  shuffledBlocks: string[];
}

export interface GameState {
  roomCode: string;
  hostId: string; // ID of the player who created the room
  phase: GamePhase;
  players: Player[];
  targetLanguage: Language; // Language to learn (Target)
  sourceLanguage: Language; // Base text language (Source)
  difficulty: Difficulty;
  sourceText: string; // The text used for the game
  selectedWords: SelectedWord[]; // Words chosen by players with attribution
  currentRound: number;
  maxRounds: number;
  enigmas: Enigma[]; 
  enigmaStatuses: EnigmaStatus[]; // Track status of each enigma
  
  // New Global Mechanics
  groupHealth: number; // 0-100
  lastSolverId: string | null;
  consecutiveSolves: number;

  // Active Challenges
  intruderData?: IntruderChallenge | null;
  hasIntruderHappened: boolean;
  bossData?: BossChallenge | null;
}