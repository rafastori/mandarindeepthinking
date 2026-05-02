import React, { useCallback, useEffect, useState } from 'react';
import Icon from '../../../components/Icon';
import { TUTORIAL_STEPS, TutorialStep } from '../tutorial-steps';
import { THEME } from '../theme';
import { audio } from '../audio';

interface Props {
    open: boolean;
    onClose: () => void;
}

const ACCENT_RING: Record<NonNullable<TutorialStep['accent']>, string> = {
    gold: 'border-amber-400/60 shadow-[0_0_30px_rgba(255,216,110,0.3)]',
    rose: 'border-rose-400/60 shadow-[0_0_30px_rgba(244,63,94,0.3)]',
    emerald: 'border-emerald-400/60 shadow-[0_0_30px_rgba(52,211,153,0.3)]',
    violet: 'border-violet-400/60 shadow-[0_0_30px_rgba(167,139,250,0.4)]',
    sky: 'border-sky-400/60 shadow-[0_0_30px_rgba(56,189,248,0.3)]',
};

const ACCENT_TEXT: Record<NonNullable<TutorialStep['accent']>, string> = {
    gold: 'text-amber-300',
    rose: 'text-rose-300',
    emerald: 'text-emerald-300',
    violet: 'text-violet-300',
    sky: 'text-sky-300',
};

const TutorialOverlay: React.FC<Props> = ({ open, onClose }) => {
    const [idx, setIdx] = useState(0);
    const total = TUTORIAL_STEPS.length;
    const step = TUTORIAL_STEPS[idx];
    const accent = step?.accent || 'gold';

    // Reseta para o início ao reabrir
    useEffect(() => {
        if (open) setIdx(0);
    }, [open]);

    const next = useCallback(() => {
        if (idx < total - 1) {
            audio.tick();
            setIdx(i => i + 1);
        } else {
            audio.classPerk();
            onClose();
        }
    }, [idx, total, onClose]);

    const prev = useCallback(() => {
        if (idx > 0) {
            audio.tick();
            setIdx(i => i - 1);
        }
    }, [idx]);

    // Atalhos de teclado
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, next, prev, onClose]);

    if (!open || !step) return null;

    const isLast = idx === total - 1;
    const isFirst = idx === 0;

    return (
        <div
            className={`fixed inset-0 z-[120] ${THEME.bg} flex flex-col animate-in fade-in duration-200`}
            role="dialog"
            aria-modal="true"
        >
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/30 backdrop-blur">
                <div className="flex items-center gap-2 text-white">
                    <Icon name="help-circle" size={22} className="text-amber-300" />
                    <div className="leading-none">
                        <p className="text-xs uppercase tracking-widest text-amber-300 font-black">Tutorial PolyQuest</p>
                        <p className="text-[10px] text-white/50 font-mono mt-0.5">{idx + 1} / {total} — {step.chapter}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-white/60 hover:text-white text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10"
                >
                    Pular tutorial
                    <Icon name="x" size={16} />
                </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-black/30">
                <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300"
                    style={{ width: `${((idx + 1) / total) * 100}%` }}
                />
            </div>

            {/* Slide content */}
            <div className="flex-1 overflow-y-auto px-4 py-6 md:py-10">
                <div className="max-w-2xl mx-auto">
                    <div
                        key={idx}
                        className={`${THEME.bgPanelSolid} rounded-3xl border-2 ${ACCENT_RING[accent]} p-6 md:p-8 animate-in slide-in-from-right-4 duration-300`}
                    >
                        {step.visual && (
                            <div className="mb-5 flex items-center justify-center min-h-[120px]">
                                {step.visual}
                            </div>
                        )}

                        <p className={`text-[11px] uppercase tracking-widest font-black ${ACCENT_TEXT[accent]} mb-1`}>
                            {step.chapter}
                        </p>
                        <h2 className="text-2xl md:text-3xl font-black text-white mb-1 leading-tight">
                            {step.title}
                        </h2>
                        {step.subtitle && (
                            <p className="text-sm md:text-base text-white/70 mb-5">{step.subtitle}</p>
                        )}

                        <div className="text-white/85 text-base leading-relaxed">
                            {step.body}
                        </div>

                        {step.tip && (
                            <div className={`mt-5 px-3 py-2.5 rounded-xl bg-white/5 border-l-4 ${
                                accent === 'rose' ? 'border-rose-400' :
                                accent === 'emerald' ? 'border-emerald-400' :
                                accent === 'violet' ? 'border-violet-400' :
                                accent === 'sky' ? 'border-sky-400' :
                                'border-amber-400'
                            } flex items-start gap-2`}>
                                <Icon name="lightbulb" size={16} className={`${ACCENT_TEXT[accent]} mt-0.5 flex-shrink-0`} />
                                <p className="text-xs text-white/70 italic">{step.tip}</p>
                            </div>
                        )}
                    </div>

                    {/* Dots indicator */}
                    <div className="flex justify-center gap-1.5 mt-6 mb-4 flex-wrap max-w-md mx-auto">
                        {TUTORIAL_STEPS.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => { audio.tick(); setIdx(i); }}
                                className={`h-2 rounded-full transition-all ${
                                    i === idx ? 'w-6 bg-amber-400' :
                                    i < idx ? 'w-2 bg-amber-600' :
                                    'w-2 bg-white/20 hover:bg-white/40'
                                }`}
                                title={`${i + 1}. ${s.title}`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom navigation */}
            <div className="border-t border-white/10 bg-black/30 backdrop-blur px-4 py-3">
                <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                    <button
                        onClick={prev}
                        disabled={isFirst}
                        className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                            isFirst
                                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                    >
                        <Icon name="chevron-left" size={18} />
                        Anterior
                    </button>

                    <div className="hidden md:block text-white/40 text-xs font-mono">
                        ← →  para navegar · Esc para fechar
                    </div>

                    <button
                        onClick={next}
                        className={`px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition-all active:scale-95 ${
                            isLast
                                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 shadow-lg shadow-amber-500/30'
                                : 'bg-amber-400 hover:bg-amber-300 text-slate-900'
                        }`}
                    >
                        {isLast ? 'Começar a Jogar' : 'Próximo'}
                        <Icon name={isLast ? 'sword' : 'chevron-right'} size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TutorialOverlay;
