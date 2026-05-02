import React, { useEffect, useState } from 'react';
import { ComboState } from '../types';
import { RULES } from '../rules';

interface Props {
    combo: ComboState;
}

/**
 * ComboMeter — mostra contagem + multiplicador atual.
 * Pulsa quando o combo aumenta. Esmaece quando o timeout chega.
 */
const ComboMeter: React.FC<Props> = ({ combo }) => {
    const [pulse, setPulse] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (combo.count > 0) {
            setPulse(true);
            const t = setTimeout(() => setPulse(false), 300);
            return () => clearTimeout(t);
        }
    }, [combo.count]);

    useEffect(() => {
        if (combo.count === 0 || combo.lastCorrectAt === 0) return;
        const tick = () => {
            const remain = Math.max(0, RULES.COMBO_TIMEOUT_MS - (Date.now() - combo.lastCorrectAt));
            setTimeLeft(remain);
        };
        tick();
        const id = setInterval(tick, 100);
        return () => clearInterval(id);
    }, [combo.lastCorrectAt, combo.count]);

    if (combo.count === 0) return null;

    const pctTimeLeft = (timeLeft / RULES.COMBO_TIMEOUT_MS) * 100;
    const isHot = combo.multiplier >= 1.5;

    return (
        <div className={`inline-flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-br ${isHot ? 'from-orange-500 to-rose-600' : 'from-amber-400 to-orange-500'} text-white shadow-lg ${pulse ? 'animate-combo-pop' : ''}`}>
            <div className="flex items-baseline gap-2 leading-none">
                <span className="text-2xl font-black tracking-tight">×{combo.multiplier.toFixed(combo.multiplier === Math.floor(combo.multiplier) ? 0 : 2)}</span>
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">combo</span>
            </div>
            <div className="text-[10px] opacity-80 font-bold">{combo.count} acertos</div>
            <div className="w-full h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div className="h-full bg-white" style={{ width: `${pctTimeLeft}%` }} />
            </div>
            <style>{`
                @keyframes combo-pop {
                    0% { transform: scale(1); }
                    40% { transform: scale(1.18) rotate(-2deg); }
                    100% { transform: scale(1); }
                }
                .animate-combo-pop { animation: combo-pop 0.3s ease-out; }
            `}</style>
        </div>
    );
};

export default ComboMeter;
