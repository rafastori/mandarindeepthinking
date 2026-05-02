import React from 'react';
import { BossDef } from '../types';

interface Props {
    boss: BossDef;
    state: 'idle' | 'wounded' | 'dying' | 'dead';
    isAttacking?: boolean;
    isHit?: boolean;          // pulsa quando recebe dano
    size?: number;
}

/**
 * BossSprite — SVG vetorial do boss, com 4 variações.
 * Animações via CSS classes no container.
 */
const BossSprite: React.FC<Props> = ({ boss, state, isAttacking, isHit, size = 200 }) => {
    const dying = state === 'dying' || state === 'dead';
    const wounded = state === 'wounded';
    const sway = isAttacking ? 'animate-bounce' : 'animate-float-slow';

    return (
        <div
            className={`relative inline-block transition-all ${dying ? 'opacity-30 grayscale rotate-12' : ''} ${isHit ? 'animate-hit-pulse' : ''}`}
            style={{ width: size, height: size }}
        >
            <div className={sway} style={{ width: '100%', height: '100%' }}>
                {boss.sprite === 'lich' && <LichSprite color={boss.color} wounded={wounded} />}
                {boss.sprite === 'dragon' && <DragonSprite color={boss.color} wounded={wounded} />}
                {boss.sprite === 'shadow' && <ShadowSprite color={boss.color} wounded={wounded} />}
                {boss.sprite === 'oracle' && <OracleSprite color={boss.color} wounded={wounded} />}
            </div>

            {/* Glow / aura */}
            <div
                className="absolute inset-0 rounded-full blur-3xl opacity-40 -z-10"
                style={{ backgroundColor: boss.color }}
            />

            {/* Animações inline (via style tag) */}
            <style>{`
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-8px) rotate(-1deg); }
                }
                .animate-float-slow { animation: float-slow 3.5s ease-in-out infinite; }

                @keyframes hit-pulse {
                    0% { transform: scale(1) translateX(0); filter: brightness(1); }
                    20% { transform: scale(1.08) translateX(-4px); filter: brightness(2.5) saturate(0.4); }
                    40% { transform: scale(1.05) translateX(6px); filter: brightness(2); saturate(0.4); }
                    60% { transform: scale(1) translateX(-3px); filter: brightness(1.3); }
                    100% { transform: scale(1) translateX(0); filter: brightness(1); }
                }
                .animate-hit-pulse { animation: hit-pulse 0.5s ease-out; }
            `}</style>
        </div>
    );
};

// ─── Sprites individuais ───────────────────────────

const LichSprite: React.FC<{ color: string; wounded?: boolean }> = ({ color, wounded }) => (
    <svg viewBox="0 0 200 200" width="100%" height="100%">
        {/* Capuz */}
        <path
            d="M 50 80 Q 100 20 150 80 L 160 160 Q 100 180 40 160 Z"
            fill={color}
            opacity="0.95"
        />
        {/* Caveira */}
        <ellipse cx="100" cy="105" rx="38" ry="42" fill="#F5F5DC" />
        {/* Sombra dos olhos */}
        <ellipse cx="85" cy="100" rx="9" ry="14" fill="#000" />
        <ellipse cx="115" cy="100" rx="9" ry="14" fill="#000" />
        {/* Brilho dos olhos */}
        <circle cx="85" cy="100" r="4" fill={wounded ? '#FCA5A5' : '#A78BFA'} />
        <circle cx="115" cy="100" r="4" fill={wounded ? '#FCA5A5' : '#A78BFA'} />
        {/* Glow dos olhos */}
        <circle cx="85" cy="100" r="8" fill={wounded ? '#EF4444' : '#A78BFA'} opacity="0.4" />
        <circle cx="115" cy="100" r="8" fill={wounded ? '#EF4444' : '#A78BFA'} opacity="0.4" />
        {/* Mandíbula */}
        <path d="M 75 130 L 100 145 L 125 130 L 120 138 L 100 152 L 80 138 Z" fill="#2A2A2A" />
        {/* Dentes */}
        <line x1="85" y1="135" x2="85" y2="142" stroke="#F5F5DC" strokeWidth="2" />
        <line x1="100" y1="138" x2="100" y2="146" stroke="#F5F5DC" strokeWidth="2" />
        <line x1="115" y1="135" x2="115" y2="142" stroke="#F5F5DC" strokeWidth="2" />
        {/* Detalhes do capuz */}
        <path d="M 60 90 L 70 70" stroke="#000" strokeWidth="1.5" opacity="0.5" />
        <path d="M 140 90 L 130 70" stroke="#000" strokeWidth="1.5" opacity="0.5" />
    </svg>
);

const DragonSprite: React.FC<{ color: string; wounded?: boolean }> = ({ color, wounded }) => (
    <svg viewBox="0 0 200 200" width="100%" height="100%">
        {/* Corpo */}
        <ellipse cx="100" cy="120" rx="60" ry="50" fill={color} />
        {/* Asas */}
        <path d="M 40 100 Q 10 60 30 130 Z" fill={color} opacity="0.7" />
        <path d="M 160 100 Q 190 60 170 130 Z" fill={color} opacity="0.7" />
        {/* Cabeça */}
        <ellipse cx="100" cy="80" rx="40" ry="35" fill={color} />
        {/* Chifres */}
        <path d="M 80 50 L 75 30 L 85 45 Z" fill="#FCD34D" />
        <path d="M 120 50 L 125 30 L 115 45 Z" fill="#FCD34D" />
        {/* Olhos */}
        <circle cx="85" cy="78" r="5" fill="#000" />
        <circle cx="115" cy="78" r="5" fill="#000" />
        <circle cx="85" cy="76" r="2" fill={wounded ? '#FCA5A5' : '#FBBF24'} />
        <circle cx="115" cy="76" r="2" fill={wounded ? '#FCA5A5' : '#FBBF24'} />
        {/* Narinas */}
        <ellipse cx="92" cy="92" rx="2" ry="3" fill="#000" />
        <ellipse cx="108" cy="92" rx="2" ry="3" fill="#000" />
        {/* Dentes */}
        <path d="M 88 105 L 92 113 L 96 105 Z" fill="#F5F5DC" />
        <path d="M 104 105 L 108 113 L 112 105 Z" fill="#F5F5DC" />
        {/* Escamas no corpo */}
        <circle cx="80" cy="130" r="3" fill="#000" opacity="0.2" />
        <circle cx="100" cy="135" r="3" fill="#000" opacity="0.2" />
        <circle cx="120" cy="130" r="3" fill="#000" opacity="0.2" />
        <circle cx="90" cy="145" r="3" fill="#000" opacity="0.2" />
        <circle cx="110" cy="145" r="3" fill="#000" opacity="0.2" />
    </svg>
);

const ShadowSprite: React.FC<{ color: string; wounded?: boolean }> = ({ color, wounded }) => (
    <svg viewBox="0 0 200 200" width="100%" height="100%">
        {/* Forma fluida */}
        <path
            d="M 50 50 Q 100 20 150 50 Q 180 100 150 150 Q 100 180 50 150 Q 20 100 50 50 Z"
            fill={color}
            opacity="0.9"
        />
        {/* Bordas etéreas */}
        <path
            d="M 50 50 Q 100 20 150 50 Q 180 100 150 150 Q 100 180 50 150 Q 20 100 50 50 Z"
            fill="none"
            stroke={color}
            strokeWidth="3"
            opacity="0.5"
        />
        {/* Olhos vazios */}
        <ellipse cx="80" cy="90" rx="10" ry="15" fill="#000" />
        <ellipse cx="120" cy="90" rx="10" ry="15" fill="#000" />
        {/* Brilho */}
        <circle cx="80" cy="92" r="3" fill={wounded ? '#FCA5A5' : '#FFF'} opacity="0.9" />
        <circle cx="120" cy="92" r="3" fill={wounded ? '#FCA5A5' : '#FFF'} opacity="0.9" />
        {/* Bocaboca */}
        <path d="M 70 130 Q 100 150 130 130" stroke="#000" strokeWidth="3" fill="none" />
        {/* Filamentos / wisps */}
        <path d="M 30 70 Q 20 60 30 90" stroke={color} strokeWidth="2" fill="none" opacity="0.6" />
        <path d="M 170 70 Q 180 60 170 90" stroke={color} strokeWidth="2" fill="none" opacity="0.6" />
    </svg>
);

const OracleSprite: React.FC<{ color: string; wounded?: boolean }> = ({ color, wounded }) => (
    <svg viewBox="0 0 200 200" width="100%" height="100%">
        {/* Cabeça/orb */}
        <circle cx="100" cy="100" r="55" fill={color} opacity="0.9" />
        <circle cx="100" cy="100" r="55" fill="none" stroke={color} strokeWidth="2" opacity="0.4" />
        {/* Olho central enorme */}
        <ellipse cx="100" cy="100" rx="30" ry="20" fill="#F5F5DC" />
        <circle cx="100" cy="100" r="14" fill={wounded ? '#EF4444' : '#0EA5E9'} />
        <circle cx="100" cy="100" r="6" fill="#000" />
        <circle cx="103" cy="97" r="2" fill="#FFF" />
        {/* Símbolos místicos ao redor */}
        <text x="100" y="40" textAnchor="middle" fontSize="14" fill={color} opacity="0.7">✦</text>
        <text x="100" y="170" textAnchor="middle" fontSize="14" fill={color} opacity="0.7">✦</text>
        <text x="40" y="105" textAnchor="middle" fontSize="14" fill={color} opacity="0.7">◇</text>
        <text x="160" y="105" textAnchor="middle" fontSize="14" fill={color} opacity="0.7">◇</text>
    </svg>
);

export default BossSprite;
