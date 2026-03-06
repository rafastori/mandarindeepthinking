import React from 'react';
import Icon from './Icon';
import { Stats } from '../types';

interface StatsModalProps {
    stats: Stats;
    onClose: () => void;
    onClear: () => void;
    onToggleIgnoreWord?: (word: string) => void;
    onOpenDetailedStats?: () => void;
}

const StatsModal: React.FC<StatsModalProps> = ({ stats, onClose, onClear, onToggleIgnoreWord, onOpenDetailedStats }) => {
    if (!stats) return null;
    const total = stats.correct + stats.wrong;
    const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 0;

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center animate-pop">
            <div className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl h-[80vh] flex flex-col overflow-hidden animate-slide-up sm:animate-none">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Icon name="activity" size={20} className="text-brand-600" /> Performance
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
                        <Icon name="x" size={24} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-brand-50 p-4 rounded-xl border border-brand-100 text-center">
                            <span className="block text-3xl font-bold text-brand-600 mb-1">{stats.correct}</span>
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">Correct</span>
                        </div>
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                            <span className="block text-3xl font-bold text-red-500 mb-1">{stats.wrong}</span>
                            <span className="text-xs font-bold text-red-300 uppercase tracking-wider">Wrong</span>
                        </div>
                    </div>
                    <div className="bg-slate-800 text-white p-4 rounded-xl mb-6 flex justify-between items-center shadow-lg">
                        <div>
                            <p className="text-xs opacity-60 uppercase font-bold tracking-wider">Global Accuracy</p>
                            <p className="text-2xl font-bold">{accuracy}%</p>
                        </div>
                        <div className="h-10 w-10 rounded-full border-4 border-white/20 flex items-center justify-center">
                            <span className="text-xs font-bold">{total > 0 ? (accuracy >= 80 ? 'A+' : accuracy >= 60 ? 'B' : 'C') : '-'}</span>
                        </div>
                    </div>
                    <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <Icon name="history" size={16} /> Error History
                    </h3>
                    {stats.history.length === 0 ? <p className="text-center text-slate-400 text-sm py-4">No errors recorded yet.</p> :
                        <div className="space-y-2">
                            {stats.history.map((entry, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-red-50/50 rounded-lg border border-red-50">
                                    <div className="flex items-center gap-2">
                                        <span className="font-chinese font-bold text-slate-700 text-lg">{entry.word}</span>
                                        {stats.wordCounts && stats.wordCounts[entry.word] > 1 && (<span className="bg-red-200 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">{stats.wordCounts[entry.word]}x</span>)}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <span className="block text-[10px] font-bold text-red-400 uppercase">{entry.type === 'pronunciation' ? 'Pronunciation' : 'Error'}</span>
                                            <span className="block text-[10px] text-slate-400">{entry.date}</span>
                                        </div>
                                        {onToggleIgnoreWord && (() => {
                                            const isIgnored = stats.ignoredReviewWords?.includes(entry.word);
                                            return (
                                                <button
                                                    onClick={() => onToggleIgnoreWord(entry.word)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all shadow-sm ml-2 ${isIgnored
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-600 hover:border-slate-300'
                                                        }`}
                                                    title={isIgnored ? `Reativar erro de "${entry.word}" na revisão` : `Desativar erro de "${entry.word}" na revisão`}
                                                >
                                                    <Icon name={isIgnored ? "eye" : "eye-off"} size={14} />
                                                    <span>{isIgnored ? 'Ativar' : 'Desativar'}</span>
                                                </button>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    }
                </div>
                <div className="p-4 border-t border-slate-100 bg-white space-y-2">
                    {onOpenDetailedStats && (
                        <button onClick={() => { onClose(); onOpenDetailedStats(); }} className="w-full py-3 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                            <Icon name="bar-chart-3" size={18} /> Ver Detalhes Completos
                        </button>
                    )}
                    <button onClick={onClear} className="w-full py-2 text-sm text-slate-400 hover:text-red-500 font-medium transition-colors flex items-center justify-center gap-2">
                        <Icon name="trash-2" size={16} /> Limpar Histórico Curto
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StatsModal;