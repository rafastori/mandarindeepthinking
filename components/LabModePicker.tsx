import React from 'react';
import { motion } from 'framer-motion';
import { AlignLeft, Link2 } from 'lucide-react';
import { LabSessionKind } from '../types';

interface LabModePickerProps {
    selected: LabSessionKind;
    onSelect: (kind: LabSessionKind) => void;
    onStart: () => void;
    ordenarReady: boolean;
    combinableReady: boolean;
    ordenarCount: number;
    combinableCount: number;
}

const LabModePicker: React.FC<LabModePickerProps> = ({
    selected, onSelect, onStart,
    ordenarReady, combinableReady, ordenarCount, combinableCount,
}) => {
    const canStart = selected === 'ordenar' ? ordenarReady : combinableReady;
    const blocked = selected === 'ordenar'
        ? 'Adicione textos com frases tokenizadas para ordenar as peças.'
        : 'Precisa de frases com texto e tradução nas pastas filtradas.';

    const modes: { id: LabSessionKind; title: string; subtitle: string; detail: string; count: number; ready: boolean; icon: React.ReactNode }[] = [
        {
            id: 'ordenar',
            icon: <AlignLeft size={18} />,
            title: 'Ordenar tokens',
            subtitle: 'Monte a frase com as peças',
            detail: 'O Lab atual: ouça (opcional), veja a tradução e reordene os tokens da língua de estudo.',
            count: ordenarCount,
            ready: ordenarReady,
        },
        {
            id: 'combinar',
            icon: <Link2 size={18} />,
            title: 'Combinar frases',
            subtitle: 'Ligue a frase (L2) à tradução (L1)',
            detail: 'Tabuleiro com frases em cima e português embaixo. Pelo menos um par verdadeiro por rodada; distratores aleatórios no restante.',
            count: combinableCount,
            ready: combinableReady,
        },
    ];

    return (
        <div className="p-4 h-full flex flex-col max-w-md mx-auto pb-20">
            <div className="mb-4">
                <h2 className="text-lg font-extrabold text-slate-800">Laboratório</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Escolha o jogo. Ordenar tokens continua disponível; Combinar frases é o modo novo de pares.
                </p>
            </div>
            <div className="flex flex-col gap-2.5 flex-1">
                {modes.map(mode => {
                    const isOn = selected === mode.id;
                    return (
                        <motion.button
                            key={mode.id}
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onSelect(mode.id)}
                            className={`text-left rounded-2xl border-2 p-3.5 transition-colors ${
                                isOn
                                    ? 'border-brand-500 bg-brand-50 shadow-sm'
                                    : 'border-slate-200 bg-white hover:border-brand-200'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <span className={`mt-0.5 p-2 rounded-xl ${isOn ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {mode.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-slate-800 text-sm">{mode.title}</span>
                                        {mode.id === 'ordenar' && (
                                            <span className="text-[9px] font-extrabold uppercase tracking-wide bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                                                Atual
                                            </span>
                                        )}
                                        {mode.id === 'combinar' && (
                                            <span className="text-[9px] font-extrabold uppercase tracking-wide bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                                                Novo
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-semibold text-slate-600 mt-0.5">{mode.subtitle}</p>
                                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">{mode.detail}</p>
                                    <p className={`text-[10px] mt-1.5 font-bold ${mode.ready ? 'text-brand-600' : 'text-amber-600'}`}>
                                        {mode.count} frase{mode.count === 1 ? '' : 's'}
                                    </p>
                                </div>
                            </div>
                        </motion.button>
                    );
                })}
            </div>
            <motion.button
                type="button"
                whileTap={canStart ? { scale: 0.97 } : {}}
                onClick={onStart}
                disabled={!canStart}
                className={`mt-4 w-full py-3.5 rounded-2xl font-bold ${
                    canStart
                        ? 'bg-brand-600 text-white hover:bg-brand-700'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
                style={canStart ? { boxShadow: '0 4px 18px rgba(5, 150, 105, 0.32)' } : {}}
            >
                Começar
            </motion.button>
            {!canStart && (
                <p className="text-[11px] text-center text-amber-700 mt-2">{blocked}</p>
            )}
        </div>
    );
};

export default LabModePicker;
