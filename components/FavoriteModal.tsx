import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { FavoriteConfig } from '../types';

interface FavoriteModalProps {
    isOpen: boolean;
    onClose: () => void;
    wordId: string;
    wordTerm: string;
    currentConfig?: FavoriteConfig;
    onSave: (config: FavoriteConfig | null) => void;
}

const FavoriteModal: React.FC<FavoriteModalProps> = ({
    isOpen,
    onClose,
    wordId,
    wordTerm,
    currentConfig,
    onSave
}) => {
    const [mode, setMode] = useState<'relative' | 'absolute'>('relative');
    const [relativeMultiplier, setRelativeMultiplier] = useState<number>(2);
    const [absoluteIntervalDays, setAbsoluteIntervalDays] = useState<number>(1);

    useEffect(() => {
        if (isOpen) {
            if (currentConfig) {
                setMode(currentConfig.mode);
                if (currentConfig.relativeMultiplier) setRelativeMultiplier(currentConfig.relativeMultiplier);
                if (currentConfig.absoluteIntervalDays) setAbsoluteIntervalDays(currentConfig.absoluteIntervalDays);
            } else {
                setMode('relative');
                setRelativeMultiplier(2);
                setAbsoluteIntervalDays(1);
            }
        }
    }, [isOpen, currentConfig]);

    if (!isOpen) return null;

    const handleSave = () => {
        const config: FavoriteConfig = {
            id: wordId,
            mode,
            ...(mode === 'relative' ? { relativeMultiplier } : { absoluteIntervalDays }),
            ...(currentConfig?.lastReviewedAt ? { lastReviewedAt: currentConfig.lastReviewedAt } : {})
        };
        onSave(config);
        onClose();
    };

    const handleRemove = () => {
        onSave(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm shadow-xl flex items-end sm:items-center justify-center z-[100] animate-in fade-in duration-200 p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-8 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-white">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                        <Icon name="star" className="text-amber-400" size={24} fill="#fbbf24" />
                        Favoritos
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <Icon name="x" size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 overflow-y-auto space-y-6">
                    <div>
                        <p className="text-sm text-slate-500 mb-1">Configurando frequência para o card:</p>
                        <p className="font-bold text-lg text-brand-700 truncate" dangerouslySetInnerHTML={{ __html: wordTerm }}></p>
                    </div>

                    {/* Mode Selection */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setMode('relative')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'relative' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Relativa (Multiplicador)
                        </button>
                        <button
                            onClick={() => setMode('absolute')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'absolute' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Absoluta (Dias)
                        </button>
                    </div>

                    {/* Relative Settings */}
                    {mode === 'relative' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Este card aparecerá <span className="font-bold">embaralhado mais vezes</span> que os outros cards normais durante a mesma sessão de prática.
                            </p>

                            <div className="flex flex-col gap-2 relative">
                                {[2, 3, 4, 5].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setRelativeMultiplier(num)}
                                        className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${relativeMultiplier === num
                                                ? 'border-brand-500 bg-brand-50 text-brand-700 font-bold shadow-sm'
                                                : 'border-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-50 font-medium'
                                            }`}
                                    >
                                        <span>Revisar {num}x mais</span>
                                        {relativeMultiplier === num && <Icon name="check-circle" size={20} className="text-brand-500" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Absolute Settings */}
                    {mode === 'absolute' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                                <Icon name="info" className="text-amber-500 shrink-0 mt-0.5" size={20} />
                                <p className="text-sm text-amber-800 leading-relaxed">
                                    Cards com Frequência Absoluta ignoram as pastas selecionadas. Eles sempre "furarão a fila" e aparecerão na Prática quando for o dia deles.
                                </p>
                            </div>

                            <p className="font-bold text-slate-700 text-sm uppercase tracking-wider">Intervalo Fixo</p>

                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { val: 1, label: 'Diário' },
                                    { val: 2, label: 'A cada 2 dias' },
                                    { val: 3, label: 'A cada 3 dias' },
                                    { val: 7, label: 'Semanal (7 d)' }
                                ].map(opt => (
                                    <button
                                        key={opt.val}
                                        onClick={() => setAbsoluteIntervalDays(opt.val)}
                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${absoluteIntervalDays === opt.val
                                                ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                                                : 'border-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        <span className={`text-2xl font-black mb-1 ${absoluteIntervalDays === opt.val ? 'text-brand-600' : 'text-slate-400'}`}>
                                            {opt.val}
                                        </span>
                                        <span className={`text-xs ${absoluteIntervalDays === opt.val ? 'font-bold' : 'font-medium'}`}>
                                            {opt.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Fixed Actions */}
                <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                    {currentConfig && (
                        <button
                            onClick={handleRemove}
                            className="p-3 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-colors border-2 border-transparent hover:border-red-100"
                            title="Remover formato favorito"
                        >
                            <Icon name="trash-2" size={24} />
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        className="flex-1 bg-brand-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-brand-700 shadow-md transition-all flex items-center justify-center gap-2"
                    >
                        <Icon name="check" size={20} />
                        <span className="text-lg">Salvar Preferência</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FavoriteModal;
