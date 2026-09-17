import React from 'react';
import Icon from '../../components/Icon';
import EmptyState from '../../components/EmptyState';
import ColorPopover from './ColorPopover';
import ReadingStudyToolbar from './ReadingStudyToolbar';
import { ReadingChromeProps } from './readingChromeTypes';

const ReadingChrome: React.FC<ReadingChromeProps> = (p) => {
    const emptyLibrary = p.filteredData.length === 0 && p.activeFolderFilters.length === 0;
    if (emptyLibrary) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <EmptyState msg="Biblioteca vazia." icon="book-open" />
                <p className="text-slate-400 text-sm mt-2">Importe um texto para começar.</p>
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                    <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <Icon name="book-open" size={20} className="text-brand-600" />
                        Leitura ({p.filteredData.length})
                    </h2>
                    <ColorPopover
                        show={p.showColorPopover}
                        isCorrectingColors={p.isCorrectingColors}
                        isColorHighlightEnabled={p.isColorHighlightEnabled}
                        colorBtnRef={p.colorBtnRef}
                        colorPopoverRef={p.colorPopoverRef}
                        onTogglePopover={() => p.setShowColorPopover(!p.showColorPopover)}
                        onToggleColors={() => {
                            p.setShowColorPopover(false);
                            p.setIsColorHighlightEnabled(!p.isColorHighlightEnabled);
                        }}
                        onCorrectColors={() => {
                            p.setShowColorPopover(false);
                            p.onCorrectColors();
                        }}
                    />
                </div>

                {!p.selectionMode && !p.reorderMode ? (
                    <div className="flex gap-1.5 items-center shrink-0">
                        <button
                            onClick={() => p.setReadingMode(p.readingMode === 'study' ? 'simple' : 'study')}
                            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 border shrink-0 ${p.readingMode === 'simple'
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                            }`}
                            title={p.readingMode === 'study' ? 'Modo leitura simples' : 'Modo estudo'}
                        >
                            <Icon name="book-open" size={14} />
                            {p.readingMode === 'simple' ? 'Estudo' : 'Leitura'}
                        </button>
                        {p.readingMode === 'study' && (
                            <button
                                onClick={() => p.setFocusNewWords(v => !v)}
                                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 border shrink-0 ${p.focusNewWords
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                }`}
                                title="Destacar só palavras novas"
                            >
                                <Icon name="sparkles" size={14} />
                                Novas
                            </button>
                        )}
                        {p.activeFolderFilters.length === 1 && p.activeFolderFilters[0] !== '__uncategorized__' && p.filteredData.length > 1 && (
                            <button
                                onClick={() => {
                                    p.setLocalReorderData([...p.filteredData]);
                                    p.setReorderMode(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                                title="Reordenar textos"
                            >
                                <Icon name="arrow-up-down" size={18} />
                            </button>
                        )}
                        <button
                            onClick={() => p.setSelectionMode(true)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                            title="Selecionar textos"
                        >
                            <Icon name="list-checks" size={18} />
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        {p.selectionMode && (
                            <button onClick={p.cancelSelection} className="px-3 py-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                Cancelar Seleção
                            </button>
                        )}
                        {p.reorderMode && (
                            <>
                                <button onClick={p.cancelReorder} className="px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                                <button onClick={p.saveReorder} className="px-3 py-1.5 text-sm font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors border border-brand-200">Concluir Reordenação</button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <ReadingStudyToolbar {...p} />
        </>
    );
};

export default ReadingChrome;
