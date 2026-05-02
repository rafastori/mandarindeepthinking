// PolyQuest — regras balanceadas (schema v2)
// Constantes centralizadas. O texto explicativo das regras antigas
// foi movido para fora do código (não é usado em runtime).

import { BossDef } from './types';

export const RULES = {
    // Vida da party
    PARTY_INITIAL_HP: 100,
    PARTY_MAX_HP: 100,

    // Compatibilidade com schema antigo (alias)
    MIN_WORDS: 1,
    INITIAL_CONFIDENCE: 100,

    // Pontuação base
    CORRECT_POINTS: 10,
    HELP_RECEIVED_POINTS: 5,
    HELP_GIVEN_POINTS: 6,
    INTRUDER_POINTS: 25,
    BOSS_VICTORY_POINTS: 60,

    // Penalidades
    WRONG_DAMAGE: 12,
    HINT_COST: 4,
    ELIMINATE_COST: 4,
    BOSS_FAIL_DAMAGE: 8,
    INTRUDER_FAIL_DAMAGE: 12,
    BOSS_ATTACK_DAMAGE: 7,

    // Curas
    INTRUDER_HEAL: 15,

    // Intruder
    INTRUDER_TRIGGER_PCT: 0.5,
    INTRUDER_TIMEOUT_MS: 25_000,

    // Boss scaling
    BOSS_HP_PER_PLAYER: 80,
    BOSS_HP_BASE: 120,
    BOSS_ATTACK_INTERVAL_MS: 18_000,

    // Combo (sequência de acertos da party)
    COMBO_TIMEOUT_MS: 12_000,
    COMBO_THRESHOLDS: [3, 5, 8],
    COMBO_MULTIPLIERS: [1.0, 1.25, 1.5, 2.0],

    // Class perks
    WARRIOR_DIRECT_DAMAGE: 25,
    BARD_BUFF_MULTIPLIER: 2,

    // Aliases legados
    ERROR_PENALTY: 12,
    BOSS_ERROR_PENALTY: 8,
    HELP_RECEIVED_SECOND_ATTEMPT_POINTS: 3,
    FATIGUE_THRESHOLD: 999,
    FATIGUE_DURATION: 0,
};

export const BOSSES: BossDef[] = [
    {
        id: 'lich',
        name: 'O Lich Lexical',
        sprite: 'lich',
        color: '#7C3AED',
        taunts: [
            'Suas palavras... morrerão comigo.',
            'Uma sílaba a mais e tudo se desfaz.',
            'Aprendi línguas mortas há mil anos.',
        ],
    },
    {
        id: 'dragon',
        name: 'Drakon, o Devorador de Sentenças',
        sprite: 'dragon',
        color: '#DC2626',
        taunts: [
            'GRAAAW! Sua gramática é fraca!',
            'Cuspirei verbos irregulares em vocês!',
        ],
    },
    {
        id: 'shadow',
        name: 'A Sombra do Significado',
        sprite: 'shadow',
        color: '#1E293B',
        taunts: [
            'Vocês não me veem...',
            'Cada erro me alimenta.',
        ],
    },
    {
        id: 'oracle',
        name: 'O Oráculo Ambíguo',
        sprite: 'oracle',
        color: '#0EA5E9',
        taunts: [
            'A resposta é ambígua... é correta a sua escolha?',
            'Toda palavra tem dois sentidos. Qual o seu?',
        ],
    },
];

export function pickRandomBoss(): BossDef {
    return BOSSES[Math.floor(Math.random() * BOSSES.length)];
}

export function calculateBossHP(playerCount: number): number {
    return RULES.BOSS_HP_BASE + RULES.BOSS_HP_PER_PLAYER * Math.max(1, playerCount);
}

export function comboMultiplierFor(count: number): number {
    const thresholds = RULES.COMBO_THRESHOLDS;
    const multipliers = RULES.COMBO_MULTIPLIERS;
    if (count >= thresholds[2]) return multipliers[3];
    if (count >= thresholds[1]) return multipliers[2];
    if (count >= thresholds[0]) return multipliers[1];
    return multipliers[0];
}
