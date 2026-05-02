import React, { useEffect, useState } from 'react';

interface Props {
    current: number;
    max: number;
    label?: string;
    color?: 'party' | 'boss';
    height?: 'sm' | 'md' | 'lg';
}

/**
 * HPBar — barra de vida com transição suave + cor por tier de saúde.
 * Faz "sangrar" quando perde HP (mostra um traço vermelho do valor antigo).
 */
const HPBar: React.FC<Props> = ({ current, max, label, color = 'party', height = 'md' }) => {
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

    // Track de "perda recente" — desenha um overlay vermelho que diminui
    const [bleed, setBleed] = useState(pct);
    const [shake, setShake] = useState(false);

    useEffect(() => {
        if (pct < bleed) {
            setShake(true);
            const t1 = setTimeout(() => setShake(false), 300);
            const t2 = setTimeout(() => setBleed(pct), 600);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        } else if (pct > bleed) {
            setBleed(pct);
        }
    }, [pct, bleed]);

    const tier = pct > 60 ? 'high' : pct > 30 ? 'mid' : 'low';
    const fillClass =
        color === 'boss'
            ? tier === 'high' ? 'bg-gradient-to-r from-rose-700 to-rose-500'
              : tier === 'mid' ? 'bg-gradient-to-r from-orange-700 to-orange-500'
              : 'bg-gradient-to-r from-amber-700 to-yellow-500'
            : tier === 'high' ? 'bg-gradient-to-r from-emerald-500 to-emerald-300'
              : tier === 'mid' ? 'bg-gradient-to-r from-amber-500 to-amber-300'
              : 'bg-gradient-to-r from-rose-600 to-rose-400';

    const heightClass = height === 'lg' ? 'h-5' : height === 'sm' ? 'h-2' : 'h-3.5';

    return (
        <div className={`w-full ${shake ? 'animate-shake-x' : ''}`}>
            {label && (
                <div className="flex justify-between items-baseline mb-1 text-xs font-bold text-white/80">
                    <span>{label}</span>
                    <span className="font-mono">{Math.round(current)}/{max}</span>
                </div>
            )}
            <div className={`relative w-full ${heightClass} bg-black/40 rounded-full overflow-hidden border border-white/10`}>
                {/* Bleed (perda em curso) */}
                <div
                    className="absolute inset-y-0 left-0 bg-rose-300/40 transition-all duration-500"
                    style={{ width: `${bleed}%` }}
                />
                {/* Fill atual */}
                <div
                    className={`absolute inset-y-0 left-0 ${fillClass} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                />
                {/* Shine */}
                <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-b from-white/30 to-transparent rounded-full"
                    style={{ width: `${pct}%`, height: '40%' }}
                />
            </div>
            <style>{`
                @keyframes shake-x {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-3px); }
                    75% { transform: translateX(3px); }
                }
                .animate-shake-x { animation: shake-x 0.18s ease-in-out 2; }
            `}</style>
        </div>
    );
};

export default HPBar;
