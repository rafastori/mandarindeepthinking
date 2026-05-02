import { PolyQuestPlayer } from './types';
import { User } from 'firebase/auth';

/** Cria objeto de jogador a partir do usuário Firebase */
export const createPlayerFromUser = (user: User, totalScore: number = 0): PolyQuestPlayer => {
    return {
        id: user.uid,
        name: user.displayName || 'Anônimo',
        avatarUrl: user.photoURL || '',
        score: 0,
        isReady: false,
        consecutiveCorrect: 0,
        helpCount: 0,
        totalScore,
    };
};

/** Validar texto base do jogo */
export const validateText = (text: string, minWords: number = 40): { valid: boolean; wordCount: number; error?: string } => {
    if (!text || text.trim().length === 0) {
        return { valid: false, wordCount: 0, error: 'Texto não pode estar vazio' };
    }
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;
    if (wordCount < minWords) {
        return {
            valid: false,
            wordCount,
            error: `Texto deve ter pelo menos ${minWords} palavras. Atual: ${wordCount}`,
        };
    }
    return { valid: true, wordCount };
};

/** Tokenizar texto em palavras mantendo pontuação (Western only) */
export const tokenizeText = (text: string): string[] => {
    return text.match(/[\w'-]+|[.,!?;:]/g) || [];
};

export const allPlayersReady = (players: PolyQuestPlayer[]): boolean => {
    return players.length > 0 && players.every(p => p.isReady);
};

export const calculatePoints = (basePoints: number, multiplier: number): number => {
    return Math.round(basePoints * multiplier);
};

export const getLanguageName = (code: string, languages: { code: string; name: string }[]): string => {
    const lang = languages.find(l => l.code === code);
    return lang?.name || code.toUpperCase();
};

export const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

/** Detecta CJK (chinês/japonês/coreano) */
export const isCJKLanguage = (lang: string): boolean => {
    return ['zh', 'ja', 'ko'].includes(lang);
};

/** Tokeniza preservando CJK como caracteres individuais ou palavras curtas */
export const tokenizeForIntruder = (text: string, lang: string): string[] => {
    if (isCJKLanguage(lang)) {
        // Quebra em runs de caracteres CJK + pontuação separada
        return text
            .split(/(\s+|[.,!?;:。，！？；：、()]|[　-〿぀-ゟ゠-ヿ一-龯])/)
            .filter(t => t && t.trim().length > 0);
    }
    return text.split(/\s+/).filter(t => t.length > 0);
};

/** Insere uma palavra intrusa no texto e retorna nova versão tokenizada + índice */
export const injectIntruder = (
    text: string,
    intruderWord: string,
    lang: string
): { tokens: string[]; insertedAt: number } => {
    const tokens = tokenizeForIntruder(text, lang);
    if (tokens.length < 2) return { tokens: [intruderWord, ...tokens], insertedAt: 0 };
    // Insere numa posição aleatória entre 25% e 75% do texto
    const min = Math.floor(tokens.length * 0.25);
    const max = Math.floor(tokens.length * 0.75);
    const insertedAt = min + Math.floor(Math.random() * Math.max(1, max - min));
    const out = [...tokens.slice(0, insertedAt), intruderWord, ...tokens.slice(insertedAt)];
    return { tokens: out, insertedAt };
};
