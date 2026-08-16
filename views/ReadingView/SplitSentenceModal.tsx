import React from 'react';
import Icon from '../../components/Icon';
import { Keyword, StudyItem } from '../../types';
import { analyzeSentenceWords, SplitProposal } from './newWordsUtils';
import { formatTokensToText } from './shared';

interface Props {
    item: StudyItem;
    proposal: SplitProposal;
    savedWordsMap: Map<string, Keyword>;
    onConfirm: () => void;
    onCancel: () => void;
    busy?: boolean;
}

const SplitSentenceModal: React.FC<Props> = ({
    item,
    proposal,
    savedWordsMap,
    onConfirm,
    onCancel,
    busy = false,
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-sm">
            <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Icon name="scissors" size={18} className="text-rose-500" />
                            Dividir frase pesada
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {proposal.chunks.length} pedaços leves · menos palavras novas por vez
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="p-2 rounded-full text-slate-400 hover:bg-slate-100"
                        disabled={busy}
                    >
                        <Icon name="x" size={20} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto space-y-3 flex-1">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Original</p>
                        <p className="text-slate-700 text-sm leading-relaxed">{item.chinese}</p>
                        {item.translation && (
                            <p className="text-slate-400 text-xs italic mt-1">{item.translation}</p>
                        )}
                    </div>

                    {proposal.chunks.map((chunk, i) => {
                        const analysis = analyzeSentenceWords(
                            { ...item, ...chunk, id: `preview-${i}`, tokens: chunk.tokens },
                            savedWordsMap
                        );
                        return (
                            <div key={i} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                        Pedaço {i + 1}
                                    </span>
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-white/80 border border-emerald-100 px-2 py-0.5 rounded-full">
                                        {analysis.newCount} nova{analysis.newCount === 1 ? '' : 's'} · {analysis.difficulty === 'easy' ? 'Leve' : analysis.difficulty === 'medium' ? 'Médio' : 'Pesado'}
                                    </span>
                                </div>
                                <p className="text-slate-800 text-sm font-medium leading-relaxed">
                                    {formatTokensToText(chunk.tokens)}
                                </p>
                                {chunk.translation && (
                                    <p className="text-slate-500 text-xs italic mt-1">{chunk.translation}</p>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-slate-100 flex gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="flex-1 py-3 rounded-xl font-medium text-slate-500 hover:bg-slate-100"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className="flex-1 py-3 rounded-xl font-bold bg-rose-500 text-white hover:bg-rose-600 shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {busy ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Dividindo…
                            </>
                        ) : (
                            <>
                                <Icon name="check" size={16} />
                                Confirmar divisão
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SplitSentenceModal;
