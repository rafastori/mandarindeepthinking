import React, { useEffect, useState } from 'react';

export interface FloatPoint {
    id: string;
    x: number;        // 0-100 (% da viewport)
    y: number;        // 0-100
    text: string;     // ex.: "+25", "-12 HP"
    color: 'gold' | 'green' | 'red' | 'blue';
}

interface Props {
    items: FloatPoint[];
    onDone?: (id: string) => void;
}

/** Texto flutuante de feedback (+pontos, -dano). Sobe e desaparece. */
const ScoreFloat: React.FC<Props> = ({ items, onDone }) => {
    return (
        <div className="pointer-events-none fixed inset-0 z-[60]">
            {items.map(it => (
                <FloatingItem key={it.id} item={it} onDone={onDone} />
            ))}
        </div>
    );
};

const FloatingItem: React.FC<{ item: FloatPoint; onDone?: (id: string) => void }> = ({ item, onDone }) => {
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        const t = setTimeout(() => {
            setVisible(false);
            onDone?.(item.id);
        }, 1400);
        return () => clearTimeout(t);
    }, [item.id, onDone]);

    if (!visible) return null;

    const colorClass = {
        gold: 'text-amber-300',
        green: 'text-emerald-300',
        red: 'text-rose-400',
        blue: 'text-sky-300',
    }[item.color];

    return (
        <div
            className={`absolute font-black text-2xl ${colorClass} drop-shadow-lg select-none animate-float-up`}
            style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                textShadow: '0 0 6px rgba(0,0,0,0.7)',
            }}
        >
            {item.text}
            <style>{`
                @keyframes float-up {
                    0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; }
                    20% { transform: translate(-50%, -10px) scale(1.2); opacity: 1; }
                    80% { transform: translate(-50%, -50px) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, -80px) scale(0.9); opacity: 0; }
                }
                .animate-float-up { animation: float-up 1.4s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ScoreFloat;
