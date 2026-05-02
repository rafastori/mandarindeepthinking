import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom } from '../types';
import { THEME } from '../theme';
import { audio } from '../audio';
import { tokenizeForIntruder } from '../utils';
import { RULES } from '../rules';

interface Props {
    room: PolyQuestRoom;
    currentUserId: string;
    onResolveIntruder: (selectedWord: string) => void;
    onTimeoutIntruder: () => void;
}

/**
 * IntruderChallenge — overlay full-screen.
 * O texto reaparece com a palavra falsa inserida no índice salvo no `intruder.insertedAtIndex`.
 * Timer regressivo: se ninguém clicar, dispara timeout.
 */
export const IntruderChallenge: React.FC<Props> = ({ room, onResolveIntruder, onTimeoutIntruder }) => {
    const intruder = room.intruder;
    const [timeLeft, setTimeLeft] = useState(intruder ? intruder.timeoutMs : 0);
    const [pulseScreen, setPulseScreen] = useState(true);

    // Tokens com o intruso inserido na posição salva
    const tokens = useMemo(() => {
        if (!intruder) return [];
        const baseTokens = tokenizeForIntruder(room.config.originalText, room.config.sourceLang);
        const idx = Math.max(0, Math.min(intruder.insertedAtIndex, baseTokens.length));
        return [...baseTokens.slice(0, idx), intruder.fakeWord, ...baseTokens.slice(idx)];
    }, [intruder?.insertedAtIndex, room.config.originalText, room.config.sourceLang]);

    // Timer regressivo
    useEffect(() => {
        if (!intruder) return;
        const interval = setInterval(() => {
            const elapsed = Date.now() - intruder.startedAt;
            const remain = Math.max(0, intruder.timeoutMs - elapsed);
            setTimeLeft(remain);
            if (remain <= 0) {
                onTimeoutIntruder();
                clearInterval(interval);
            } else if (remain < 5000 && Math.floor(remain / 1000) !== Math.floor((remain + 100) / 1000)) {
                audio.tick();
            }
        }, 100);
        return () => clearInterval(interval);
    }, [intruder?.startedAt]);

    // Anima a entrada
    useEffect(() => {
        const t = setTimeout(() => setPulseScreen(false), 800);
        return () => clearTimeout(t);
    }, []);

    if (!intruder) return null;

    const secondsLeft = Math.ceil(timeLeft / 1000);
    const tlPct = (timeLeft / intruder.timeoutMs) * 100;

    const handleClick = (word: string) => {
        const clean = word.replace(/[.,/#!$%^&*;:{}=\-_`~()。，！？；：、]/g, '').trim();
        onResolveIntruder(clean);
        if (clean.toLowerCase() === intruder.fakeWord.toLowerCase()) {
            audio.victory();
        } else {
            audio.wrong();
        }
    };

    return (
        <div className={`fixed inset-0 z-[80] ${THEME.bgDeep} flex items-center justify-center p-4 ${pulseScreen ? 'animate-flash-red' : ''}`}>
            {/* Aura vermelha pulsando ao redor */}
            <div className="absolute inset-0 ring-[12px] ring-rose-500 ring-inset animate-pulse pointer-events-none" />

            <div className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto ${THEME.bgPanelSolid} rounded-3xl shadow-2xl border-4 border-rose-500 animate-in zoom-in-90 duration-300`}>
                {/* Header dramático */}
                <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700 p-5 text-white text-center">
                    <div className="flex items-center justify-center gap-3 mb-1">
                        <Icon name="alert-triangle" size={28} className="text-amber-300 animate-pulse" />
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-widest">Desafio do Intruso</h2>
                        <Icon name="alert-triangle" size={28} className="text-amber-300 animate-pulse" />
                    </div>
                    <p className="text-rose-100 font-medium text-sm">
                        Uma palavra falsa foi plantada no texto. Encontrem-na <span className="font-black">JUNTOS</span>!
                    </p>
                </div>

                {/* Timer */}
                <div className="bg-black/50 px-5 py-2 flex items-center gap-3 border-b border-rose-500/30">
                    <Icon name="clock" size={18} className="text-rose-300" />
                    <span className="font-mono text-2xl font-black text-white">{secondsLeft}s</span>
                    <div className="flex-1 h-2 bg-rose-900/50 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-100"
                            style={{ width: `${tlPct}%` }}
                        />
                    </div>
                </div>

                {/* Caça */}
                <div className="p-6">
                    <div className="flex flex-wrap gap-1.5 text-base md:text-lg leading-loose justify-center text-white/90">
                        {tokens.map((word, i) => (
                            <button
                                key={i}
                                onClick={() => handleClick(word)}
                                className="px-2 py-1 rounded hover:bg-rose-500/30 hover:text-rose-200 hover:scale-110 transition-all cursor-pointer border border-transparent hover:border-rose-400"
                            >
                                {word}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-black/40 p-4 text-center border-t border-rose-500/30">
                    <p className="text-xs text-white/70">
                        Acerto: <span className="font-bold text-emerald-300">+{RULES.INTRUDER_POINTS} pts</span> & <span className="font-bold text-emerald-300">+{RULES.INTRUDER_HEAL} HP</span> ·
                        Erro: <span className="font-bold text-rose-300">-{RULES.INTRUDER_FAIL_DAMAGE} HP</span>
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes flash-red {
                    0%, 100% { background-color: rgba(225, 29, 72, 0); }
                    30% { background-color: rgba(225, 29, 72, 0.6); }
                }
                .animate-flash-red { animation: flash-red 0.8s ease-in-out; }
            `}</style>
        </div>
    );
};
