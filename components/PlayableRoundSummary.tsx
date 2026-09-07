import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';

export interface PlayableRoundSummaryProps {
    title?: string;
    subtitle?: string;
    correct: number;
    total: number;
    wrong: number;
    xp: number;
    onDone: () => void;
    doneLabel?: string;
}

const PlayableRoundSummary: React.FC<PlayableRoundSummaryProps> = ({
    title = 'Sessão concluída',
    subtitle = 'Acertos e XP já entram no resumo da sessão e nas estatísticas.',
    correct, total, wrong, xp, onDone, doneLabel = 'Voltar aos modos',
}) => {
    const attempts = correct + wrong;
    const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;

    return (
        <div className="flex-1 flex items-center justify-center p-6">
            <motion.div
                initial={{ y: 24, opacity: 0, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-lg text-center"
            >
                <p className="text-2xl font-extrabold text-slate-900 mb-1">{title}</p>
                <p className="text-sm text-slate-500 mb-5">{subtitle}</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-brand-50 rounded-2xl p-4">
                        <div className="text-2xl font-extrabold text-brand-600">{correct}/{total}</div>
                        <div className="text-[11px] text-slate-500 font-medium">Acertos</div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4">
                        <div className="text-2xl font-extrabold text-slate-700">+{xp}</div>
                        <div className="text-[11px] text-slate-500 font-medium">XP</div>
                    </div>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                    {wrong} erro{wrong === 1 ? '' : 's'} · {accuracy}% nesta rodada
                </p>
                <button
                    type="button"
                    onClick={onDone}
                    className="w-full py-3.5 bg-brand-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2"
                >
                    <RotateCcw size={16} />
                    {doneLabel}
                </button>
            </motion.div>
        </div>
    );
};

export default PlayableRoundSummary;
