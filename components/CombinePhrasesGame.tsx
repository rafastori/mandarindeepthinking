import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle, Volume2, Square, Zap } from 'lucide-react';
import { SupportedLanguage } from '../types';
import PlayableRoundSummary from './PlayableRoundSummary';
import { practiceComboXp } from '../utils/playableXp';
import {
    PhrasePair,
    buildCombineBoard,
    CombineBoard,
    decideBoardSize,
} from '../utils/combinePhrases';

interface CombinePhrasesGameProps {
    pairs: PhrasePair[];
    onResult: (correct: boolean, word: string, type?: 'general' | 'pronunciation', points?: number) => void;
    onExit: () => void;
    speak: (text: string, lang: SupportedLanguage, id: string, sentenceItemId?: string) => void;
    stop: () => void;
    playingId: string | null;
}

type Flash = 'correct' | 'wrong' | null;

const stampStyle = `
.stamp-card {
  position: relative;
  border-radius: 2px;
}
.stamp-card::before,
.stamp-card::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  height: 10px;
  pointer-events: none;
  background-image: radial-gradient(circle at 6px 5px, #f1f5f9 5px, transparent 5.5px);
  background-size: 12px 10px;
  background-repeat: repeat-x;
}
.stamp-card::before { top: -5px; }
.stamp-card::after { bottom: -5px; transform: rotate(180deg); }
`;

const CombinePhrasesGame: React.FC<CombinePhrasesGameProps> = ({
    pairs, onResult, onExit, speak, stop, playingId,
}) => {
    const [remaining, setRemaining] = useState<PhrasePair[]>(() => [...pairs]);
    const [board, setBoard] = useState<CombineBoard | null>(null);
    const [selectedL2, setSelectedL2] = useState<string | null>(null);
    const [selectedL1, setSelectedL1] = useState<string | null>(null);
    const [flash, setFlash] = useState<Flash>(null);
    const [locked, setLocked] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [matchedCount, setMatchedCount] = useState(0);
    const [wrongCount, setWrongCount] = useState(0);
    const [sessionXP, setSessionXP] = useState(0);
    const [combo, setCombo] = useState(0);
    const [finished, setFinished] = useState(false);
    const total = pairs.length;

    const deal = useCallback((pool: PhrasePair[]) => {
        if (!pool.length) {
            setBoard(null);
            setFinished(true);
            return;
        }
        setBoard(buildCombineBoard(pool, decideBoardSize(pool)));
        setSelectedL2(null);
        setSelectedL1(null);
        setFlash(null);
        setLocked(false);
    }, []);

    useEffect(() => {
        deal([...pairs]);
        setRemaining([...pairs]);
        setMatchedCount(0);
        setWrongCount(0);
        setSessionXP(0);
        setCombo(0);
        setFinished(false);
        // only on new session (pairs identity from parent start)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pairs]);

    const isCjk = useMemo(
        () => pairs.some(p => /[\u3400-\u9fff]/.test(p.sentence)),
        [pairs]
    );

    const tryMatch = (l2Id: string, l1Id: string) => {
        if (locked) return;
        const ok = l2Id === l1Id;
        setLocked(true);
        setFlash(ok ? 'correct' : 'wrong');
        if (ok) {
            const hit = remaining.find(p => p.id === l2Id);
            const nextCombo = combo + 1;
            const xp = practiceComboXp(nextCombo);
            onResult(true, hit?.sentence || l2Id, 'general', xp);
            setCombo(nextCombo);
            setSessionXP(x => x + xp);
            setMatchedCount(n => n + 1);
            const nextPool = remaining.filter(p => p.id !== l2Id);
            setRemaining(nextPool);
            setTimeout(() => {
                stop();
                deal(nextPool);
            }, 520);
        } else {
            const attempted = remaining.find(p => p.id === l2Id);
            onResult(false, attempted?.sentence || l2Id);
            setCombo(0);
            setWrongCount(n => n + 1);
            setTimeout(() => {
                setSelectedL2(null);
                setSelectedL1(null);
                setFlash(null);
                setLocked(false);
            }, 520);
        }
    };

    const pickL2 = (id: string) => {
        if (locked || finished) return;
        if (selectedL2 === id) {
            setSelectedL2(null);
            return;
        }
        setSelectedL2(id);
        if (selectedL1) tryMatch(id, selectedL1);
    };

    const pickL1 = (id: string) => {
        if (locked || finished) return;
        if (selectedL1 === id) {
            setSelectedL1(null);
            return;
        }
        setSelectedL1(id);
        if (selectedL2) tryMatch(selectedL2, id);
    };

    const listen = (pair: PhrasePair, e: React.MouseEvent) => {
        e.stopPropagation();
        const aid = `lab-combine-${pair.id}`;
        if (playingId === aid) stop();
        else speak(pair.sentence, (pair.language || 'zh') as SupportedLanguage, aid, pair.id);
    };

    const cardClass = (id: string, side: 'l2' | 'l1') => {
        const selected = side === 'l2' ? selectedL2 === id : selectedL1 === id;
        const involved = selectedL2 === id || selectedL1 === id;
        let ring = 'bg-white';
        if (flash && involved) {
            ring = flash === 'correct' ? 'bg-emerald-50 ring-2 ring-emerald-400' : 'bg-red-50 ring-2 ring-red-400';
        } else if (selected) {
            ring = 'bg-brand-50 ring-2 ring-brand-500';
        }
        return `stamp-card w-full px-3 py-2.5 text-center shadow-sm transition-colors ${ring}`;
    };

    if (finished) {
        return (
            <div className="h-full flex flex-col bg-slate-100 max-w-md mx-auto">
                <header className="bg-brand-600 text-white px-3 py-3 flex items-center gap-2 flex-shrink-0">
                    <button type="button" onClick={onExit} className="p-1.5 rounded-lg hover:bg-white/15" aria-label="Voltar">
                        ←
                    </button>
                    <h1 className="flex-1 text-center font-bold text-base pr-8">Combine as frases</h1>
                </header>
                <PlayableRoundSummary
                    title="Pares combinados"
                    subtitle="Cada par certo já valeu XP no resumo da sessão e nas estatísticas."
                    correct={matchedCount}
                    total={total}
                    wrong={wrongCount}
                    xp={sessionXP}
                    onDone={onExit}
                />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-100 max-w-md mx-auto pb-16 relative">
            <style>{stampStyle}</style>
            <header className="bg-brand-600 text-white px-3 py-3 flex items-center gap-2 flex-shrink-0">
                <button type="button" onClick={onExit} className="p-1.5 rounded-lg hover:bg-white/15 text-lg leading-none" aria-label="Voltar">
                    ←
                </button>
                <h1 className="flex-1 text-center font-bold text-[15px]">Combine as frases</h1>
                <span className="flex items-center gap-1 text-[11px] font-extrabold bg-white/15 px-2 py-1 rounded-full">
                    {combo >= 2 && <span className="opacity-90">{combo}x</span>}
                    <Zap size={11} className="fill-current" />
                    {sessionXP}
                </span>
            </header>

            <p className="text-center text-[11px] font-bold text-slate-500 py-2 flex-shrink-0">
                {matchedCount} / {total} pares
            </p>

            <div className="flex-1 flex flex-col px-4 gap-2 overflow-hidden min-h-0">
                <AnimatePresence initial={false}>
                    {(board?.l2 || []).map(pair => {
                        const aid = `lab-combine-${pair.id}`;
                        return (
                            <motion.div
                                key={`l2-${pair.id}`}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.92 }}
                                className="relative"
                            >
                                <button
                                    type="button"
                                    onClick={() => pickL2(pair.id)}
                                    className={`${cardClass(pair.id, 'l2')} pr-10`}
                                >
                                    <span className={`block text-[15px] leading-snug ${isCjk ? 'font-chinese' : 'font-sans'}`}>
                                        {pair.sentence}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={e => listen(pair, e)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-brand-600 z-10"
                                    aria-label="Ouvir"
                                >
                                    {playingId === aid ? <Square size={13} /> : <Volume2 size={13} />}
                                </button>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            <div className="relative flex-shrink-0 py-4">
                <div className="h-px bg-slate-300 mx-4" />
                <button
                    type="button"
                    onClick={() => setShowHelp(v => !v)}
                    className="absolute right-5 -top-1 w-11 h-11 rounded-full bg-brand-600 text-white shadow-lg flex items-center justify-center"
                    aria-label="Ajuda"
                    style={{ boxShadow: '0 6px 16px rgba(5, 150, 105, 0.35)' }}
                >
                    <HelpCircle size={22} />
                </button>
            </div>

            <div className="flex-1 flex flex-col px-4 gap-2 overflow-hidden min-h-0 pb-3">
                <AnimatePresence initial={false}>
                    {(board?.l1 || []).map(pair => (
                        <motion.button
                            key={`l1-${pair.id}`}
                            type="button"
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92 }}
                            onClick={() => pickL1(pair.id)}
                            className={`${cardClass(pair.id, 'l1')} font-sans text-[14px] leading-snug text-slate-800`}
                        >
                            {pair.translation}
                        </motion.button>
                    ))}
                </AnimatePresence>
            </div>

            {showHelp && (
                <button
                    type="button"
                    className="absolute inset-0 z-10 bg-black/40 flex items-end sm:items-center justify-center p-4"
                    onClick={() => setShowHelp(false)}
                >
                    <div className="bg-white rounded-2xl p-4 text-left text-sm text-slate-600 leading-relaxed shadow-xl max-w-sm" onClick={e => e.stopPropagation()}>
                        <p className="font-extrabold text-slate-800 mb-1">Como jogar</p>
                        <p>
                            Toque uma frase em cima (língua de estudo) e a tradução em português embaixo.
                            Só precisa haver <span className="font-bold">um par verdadeiro</span> no tabuleiro — o resto pode ser distrator.
                            Pares certos saem e não voltam até o fim da sessão.
                        </p>
                        <p className="mt-3 text-xs text-slate-400">Toque fora para fechar.</p>
                    </div>
                </button>
            )}
        </div>
    );
};

export default CombinePhrasesGame;
