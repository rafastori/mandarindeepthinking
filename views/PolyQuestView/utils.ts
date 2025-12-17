import { PolyQuestPlayer } from './types';
import { User } from 'firebase/auth';

/**
 * Criar objeto de jogador a partir do usuário Firebase
 */
export const createPlayerFromUser = (user: User, totalScore: number = 0): PolyQuestPlayer => {
    return {
        id: user.uid,
        name: user.displayName || 'Anonymous',
        avatarUrl: user.photoURL || '',
        score: 0,
        isReady: false,
        isFatigued: false,
        consecutiveCorrect: 0,
        helpCount: 0,
        totalScore,
    };
};

/**
 * Validar texto base do jogo
 */
export const validateText = (text: string, minWords: number = 40): { valid: boolean; wordCount: number; error?: string } => {
    if (!text || text.trim().length === 0) {
        return { valid: false, wordCount: 0, error: 'Texto não pode estar vazio' };
    }

    // Contar palavras (separadas por espaços)
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;

    if (wordCount < minWords) {
        return {
            valid: false,
            wordCount,
            error: `Texto deve ter pelo menos ${minWords} palavras. Atual: ${wordCount}`
        };
    }

    return { valid: true, wordCount };
};

/**
 * Tokenizar texto em palavras mantendo pontuação
 */
export const tokenizeText = (text: string): string[] => {
    // Regex para separar palavras mantendo pontuação como tokens separados
    // Exemplo: "Hello, world!" -> ["Hello", ",", "world", "!"]
    return text.match(/[\w'-]+|[.,!?;:]/g) || [];
};

/**
 * Verificar se todos os jogadores estão prontos
 */
export const allPlayersReady = (players: PolyQuestPlayer[]): boolean => {
    return players.length > 0 && players.every(p => p.isReady);
};

/**
 * Calcular pontos com multiplicador de combo
 */
export const calculatePoints = (basePoints: number, multiplier: number): number => {
    return Math.round(basePoints * multiplier);
};

/**
 * Verificar se jogador está em fadiga
 */
export const isPlayerFatigued = (player: PolyQuestPlayer): boolean => {
    if (!player.isFatigued) return false;
    if (!player.fatigueEndsAt) return false;

    // Verificar se o tempo de fadiga já passou
    return Date.now() < player.fatigueEndsAt;
};

/**
 * Obter nome do idioma pelo código
 */
export const getLanguageName = (code: string, languages: { code: string; name: string }[]): string => {
    const lang = languages.find(l => l.code === code);
    return lang?.name || code.toUpperCase();
};

/**
 * Formatar tempo em MM:SS
 */
export const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Embaralhar array (Fisher-Yates shuffle)
 */
export const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};
