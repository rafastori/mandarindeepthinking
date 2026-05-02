// PolyQuest — tokens visuais (modern dark-fantasy lite)
// Palette: roxo profundo + dourado quente + verde-veneno + tons de aviso.

export const THEME = {
    // Backgrounds
    bg: 'bg-gradient-to-br from-[#0F0628] via-[#1B0A3D] to-[#2A0E5C]',
    bgDeep: 'bg-[#0A0420]',
    bgPanel: 'bg-[#1B0A3D]/85 backdrop-blur',
    bgPanelSolid: 'bg-[#231250]',
    bgCard: 'bg-[#2A1660]/70',

    // Borders
    borderGlow: 'border border-[#FFD86E]/40',
    borderSoft: 'border border-white/10',
    borderActive: 'border-2 border-[#FFD86E]',
    borderDanger: 'border-2 border-rose-500',
    borderHelp: 'border-2 border-amber-400',

    // Text
    textPrimary: 'text-white',
    textMuted: 'text-white/60',
    textDim: 'text-white/40',
    textGold: 'text-[#FFD86E]',
    textHeal: 'text-emerald-300',
    textDamage: 'text-rose-400',
    textCombo: 'text-orange-300',

    // Buttons
    btnPrimary: 'bg-gradient-to-br from-[#FFD86E] to-[#E8A828] text-slate-900 shadow-lg shadow-[#FFD86E]/20 hover:shadow-[#FFD86E]/40',
    btnDanger: 'bg-gradient-to-br from-rose-500 to-rose-700 text-white',
    btnGhost: 'bg-white/5 hover:bg-white/10 text-white border border-white/10',

    // Status colors (HP bar tiers)
    hpHigh: 'from-emerald-400 to-emerald-500',
    hpMid: 'from-amber-400 to-amber-500',
    hpLow: 'from-rose-500 to-rose-700',

    // Shadows / glows
    glowGold: 'shadow-[0_0_20px_rgba(255,216,110,0.4)]',
    glowDanger: 'shadow-[0_0_20px_rgba(244,63,94,0.5)]',
    glowMagic: 'shadow-[0_0_30px_rgba(167,139,250,0.5)]',
};

// Cores por jogador (para identificar quem fez o quê)
export const PLAYER_PALETTE = [
    { hex: '#F472B6', name: 'rose', tw: 'pink' },
    { hex: '#60A5FA', name: 'blue', tw: 'blue' },
    { hex: '#34D399', name: 'green', tw: 'emerald' },
    { hex: '#FBBF24', name: 'gold', tw: 'amber' },
    { hex: '#A78BFA', name: 'violet', tw: 'purple' },
    { hex: '#FB923C', name: 'flame', tw: 'orange' },
    { hex: '#22D3EE', name: 'cyan', tw: 'cyan' },
    { hex: '#F87171', name: 'red', tw: 'red' },
];

export function getPlayerColor(userId: string): { hex: string; name: string; tw: string } {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PLAYER_PALETTE[Math.abs(hash) % PLAYER_PALETTE.length];
}
