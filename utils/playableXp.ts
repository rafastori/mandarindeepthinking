/** Combo da Prática clássica: 1× / 1.5× / 2× / 3× sobre 10 XP. */
export function practiceComboMultiplier(streak: number): number {
    if (streak < 3) return 1;
    if (streak < 5) return 1.5;
    if (streak < 10) return 2;
    return 3;
}

export function practiceComboXp(streakAfterCorrect: number): number {
    return Math.round(10 * practiceComboMultiplier(streakAfterCorrect));
}
