import React from 'react';
import { motion } from 'framer-motion';
import { Headphones, Languages, PenLine, LayoutGrid, Sparkles } from 'lucide-react';
import { PracticeSessionKind } from '../types';

interface PracticeModePickerProps {
    selected: PracticeSessionKind;
    onSelect: (kind: PracticeSessionKind) => void;
    onStart: () => void;
    tradicionalReady: boolean;
    audioReady: boolean;
    tradicionalCount: number;
    audioCount: number;
    enableAiHelp: boolean;
    onToggleAiHelp: (on: boolean) => void;
    hasNativeAlignment: boolean;
}

const MODES: {
    id: PracticeSessionKind;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    detail: string;
}[] = [
    {
        id: 'tradicional',
        icon: <LayoutGrid size={18} />,
        title: 'Tradicional',
        subtitle: 'Cloze, múltipla escolha ou swipe',
        detail: 'O modo atual: complete a frase com a palavra salva. Permanece o padrão.',
    },
    {
        id: 'audio-traducao',
        icon: <Languages size={18} />,
        title: 'Áudio → tradução',
        subtitle: 'Ouça (L2) e escreva em português (L1)',
        detail: 'Tradução: o que você entendeu, na sua língua. Não é ditado em chinês/alemão.',
    },
    {
        id: 'audio-escrita',
        icon: <PenLine size={18} />,
        title: 'Áudio → escrita',
        subtitle: 'Ouça e escreva na língua de estudo (L2)',
        detail: 'Ditado / transcrição: hanzi, alemão etc. — o texto que você ouviu, não a tradução.',
    },
];

const PracticeModePicker: React.FC<PracticeModePickerProps> = ({
    selected, onSelect, onStart,
    tradicionalReady, audioReady, tradicionalCount, audioCount,
    enableAiHelp, onToggleAiHelp, hasNativeAlignment,
}) => {
    const canStart = selected === 'tradicional' ? tradicionalReady : audioReady;
    const blockedReason = selected === 'tradicional'
        ? 'Salve pelo menos 4 palavras na Leitura para o modo tradicional.'
        : 'Precisa de frases com texto + tradução nas pastas filtradas.';

    return (
        <div className="p-4 h-full flex flex-col max-w-md mx-auto pb-20">
            <div className="mb-4">
                <h2 className="text-lg font-extrabold text-slate-800">Como quer praticar?</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Tradicional continua o padrão. Os modos de áudio usam o digestivo nativo quando a frase está alinhada; senão, TTS.
                </p>
            </div>

            <div className="flex flex-col gap-2.5 flex-1">
                {MODES.map(mode => {
                    const isOn = selected === mode.id;
                    const ready = mode.id === 'tradicional' ? tradicionalReady : audioReady;
                    const count = mode.id === 'tradicional' ? tradicionalCount : audioCount;
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
                                        {mode.id === 'tradicional' && (
                                            <span className="text-[9px] font-extrabold uppercase tracking-wide bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                                                Padrão
                                            </span>
                                        )}
                                        {mode.id !== 'tradicional' && hasNativeAlignment && (
                                            <span className="text-[9px] font-extrabold uppercase tracking-wide bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                                                DG
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-semibold text-slate-600 mt-0.5">{mode.subtitle}</p>
                                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">{mode.detail}</p>
                                    <p className={`text-[10px] mt-1.5 font-bold ${ready ? 'text-brand-600' : 'text-amber-600'}`}>
                                        {mode.id === 'tradicional'
                                            ? `${count} questão${count === 1 ? '' : 's'} de palavras salvas`
                                            : `${count} frase${count === 1 ? '' : 's'} com áudio`}
                                    </p>
                                </div>
                            </div>
                        </motion.button>
                    );
                })}
            </div>

            <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={enableAiHelp}
                    onChange={e => onToggleAiHelp(e.target.checked)}
                    className="mt-0.5 accent-brand-600"
                />
                <span className="text-xs text-slate-600 leading-snug">
                    <span className="font-bold text-slate-800 inline-flex items-center gap-1">
                        <Sparkles size={12} className="text-brand-600" />
                        Explicação por IA do erro
                    </span>
                    <span className="block mt-0.5 text-slate-400">
                        Botões opcionais em cada cartão: dica antes de responder (sem spoiler completo) e explicação depois. Não chama a IA sozinha.
                    </span>
                </span>
            </label>

            <motion.button
                type="button"
                whileTap={canStart ? { scale: 0.97 } : {}}
                onClick={onStart}
                disabled={!canStart}
                className={`mt-3 w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 ${
                    canStart
                        ? 'bg-brand-600 text-white hover:bg-brand-700'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
                style={canStart ? { boxShadow: '0 4px 18px rgba(5, 150, 105, 0.32)' } : {}}
            >
                <Headphones size={16} />
                Começar
            </motion.button>
            {!canStart && (
                <p className="text-[11px] text-center text-amber-700 mt-2">{blockedReason}</p>
            )}
        </div>
    );
};

export default PracticeModePicker;
