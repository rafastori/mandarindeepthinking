import React, { useMemo, useState } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem, Keyword, SupportedLanguage } from '../types';
import { usePuterSpeech } from '../hooks/usePuterSpeech';
import { generateWordCard } from '../services/gemini';

interface ReadingViewProps {
    data: StudyItem[];
    savedIds: string[];
    onToggleSave: (id: string) => void;
    onOpenImport: () => void;
    onDeleteText?: (id: string | number) => void;
    // ATUALIZADO: Agora aceita o contexto (string)
    onSaveGeneratedCard: (card: Keyword, context: string) => void;
}

const ReadingView: React.FC<ReadingViewProps> = ({
    data,
    savedIds,
    onToggleSave,
    onOpenImport,
    onDeleteText,
    onSaveGeneratedCard
}) => {
    const { speak } = usePuterSpeech();
    const [loadingWord, setLoadingWord] = useState<string | null>(null);

    // Estados para modo de seleção
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Modal de confirmação
    const [confirmModal, setConfirmModal] = useState<{
        word: string;
        sentence: StudyItem;
    } | null>(null);

    // FILTRO VISUAL: Mostra apenas textos, esconde palavras soltas salvas
    const visibleData = useMemo(() => {
        return data.filter(item => item.type !== 'word');
    }, [data]);

    // Função para formatar tokens em texto legível (tratando pontuação)
    const formatTokensToText = (tokens: string[]): string => {
        if (!tokens || tokens.length === 0) return '';

        const punctuationNoBefore = /^[,.\-!?;:)\]}"'»›…。，！？；：）】」』、]/;
        const punctuationNoAfter = /[(\[{"'«‹（【「『]$/;

        let result = '';
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const prevToken = i > 0 ? tokens[i - 1] : '';

            // Adiciona espaço se:
            // - Não é o primeiro token
            // - Token atual não começa com pontuação que não aceita espaço antes
            // - Token anterior não termina com pontuação que não aceita espaço depois
            if (i > 0 && !punctuationNoBefore.test(token) && !punctuationNoAfter.test(prevToken)) {
                result += ' ';
            }
            result += token;
        }
        return result;
    };

    // Função para exportar textos selecionados como TXT
    const exportSelectedAsText = () => {
        if (selectedIds.size === 0) return;

        const selectedItems = visibleData.filter(item => selectedIds.has(item.id.toString()));

        let content = '═══════════════════════════════════════\n';
        content += '   TEXTOS EXPORTADOS - MemorizaTudo\n';
        content += '   ' + new Date().toLocaleDateString('pt-BR') + '\n';
        content += '═══════════════════════════════════════\n\n';

        selectedItems.forEach((item, index) => {
            const formattedText = formatTokensToText(item.tokens);
            content += `[${index + 1}] TEXTO ORIGINAL (${item.language?.toUpperCase() || 'ZH'}):\n`;
            content += formattedText + '\n\n';
            content += `TRADUÇÃO:\n`;
            content += item.translation + '\n';
            content += '\n───────────────────────────────────────\n\n';
        });

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `textos-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Limpa seleção após exportar
        setSelectedIds(new Set());
        setSelectionMode(false);
    };

    // Funções de seleção
    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const selectAll = () => {
        if (selectedIds.size === visibleData.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(visibleData.map(i => i.id.toString())));
        }
    };

    const cancelSelection = () => {
        setSelectionMode(false);
        setSelectedIds(new Set());
    };

    // Mapa Global de Palavras (considera tudo, inclusive as palavras ocultas)
    const savedWordsMap = useMemo(() => {
        const map = new Map<string, Keyword>();
        data.forEach(item => {
            // Keywords internas
            item.keywords?.forEach(k => {
                if (savedIds.includes(k.id)) map.set(k.word.toLowerCase().trim(), k);
            });

            // Itens que são palavras (cards salvos)
            // Agora verificamos também pelo tipo ou se é um token único salvo
            const isWordCard = item.type === 'word' || (item.tokens.length === 1 && savedIds.includes(item.id.toString()));

            if (isWordCard) {
                map.set(item.chinese.toLowerCase().trim(), {
                    id: item.id.toString(),
                    word: item.chinese,
                    pinyin: item.pinyin,
                    meaning: item.translation,
                    language: item.language
                });
            }
        });
        return map;
    }, [data, savedIds]);

    const cleanPunctuation = (text: string) => text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'´]/g, "").trim();

    const handleTokenClick = (token: string, contextSentence: StudyItem) => {
        if (loadingWord) return;

        const cleanToken = cleanPunctuation(token);
        if (!cleanToken) return;

        const savedKw = savedWordsMap.get(cleanToken.toLowerCase());

        if (savedKw) {
            // Se já existe, apenas fala
            speak(savedKw.word, (savedKw.language || 'zh') as 'zh' | 'de' | 'pt' | 'en');
            return;
        }

        // Abre modal para confirmar
        setConfirmModal({ word: cleanToken, sentence: contextSentence });
    };

    const confirmGeneration = async () => {
        if (!confirmModal) return;
        const { word, sentence } = confirmModal;
        setConfirmModal(null);
        setLoadingWord(word);

        try {
            const lang = sentence.language || 'zh';
            const newCard = await generateWordCard(word, sentence.chinese, lang);

            // ATUALIZADO: Passa a palavra E a frase de contexto para o App.tsx salvar
            onSaveGeneratedCard(newCard, sentence.chinese);

            speak(newCard.word, lang as 'zh' | 'de' | 'pt' | 'en');
        } catch (error) {
            console.error(error);
            alert("Erro ao processar. Verifique sua conexão.");
        } finally {
            setLoadingWord(null);
        }
    };

    const renderSentence = (sentence: StudyItem) => {
        return sentence.tokens.map((token, i) => {
            const cleanToken = cleanPunctuation(token);
            const isSaved = !!savedWordsMap.get(cleanToken.toLowerCase());
            const isLoading = loadingWord === cleanToken;

            return (
                <span
                    key={i}
                    onClick={(e) => { e.stopPropagation(); handleTokenClick(token, sentence); }}
                    className={`
                        inline-block px-1 mx-0.5 rounded transition-all border-b-2 mb-1 relative cursor-pointer
                        ${isSaved
                            ? 'bg-brand-100 text-brand-800 border-brand-500 font-bold'
                            : 'hover:bg-brand-50 border-slate-300 border-dotted hover:border-brand-300 text-slate-700'
                        }
                        ${isLoading ? 'opacity-70 cursor-wait' : ''}
                    `}
                >
                    {isLoading && (
                        <span className="absolute inset-0 flex items-center justify-center">
                            <div className="w-3 h-3 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                        </span>
                    )}
                    <span className={isLoading ? 'opacity-0' : ''}>{token}</span>
                </span>
            );
        });
    };

    return (
        <div className="p-4 space-y-4 pb-24 relative min-h-full">
            {visibleData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                    <EmptyState msg="Biblioteca vazia." icon="book-open" />
                    <p className="text-slate-400 text-sm mt-2">Importe um texto para começar.</p>
                </div>
            ) : (
                <>
                    {/* Header com botão de seleção */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <Icon name="book-open" size={20} className="text-brand-600" />
                            Leitura ({visibleData.length})
                        </h2>

                        {!selectionMode ? (
                            <button
                                onClick={() => setSelectionMode(true)}
                                className="px-3 py-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Selecionar
                            </button>
                        ) : (
                            <button
                                onClick={cancelSelection}
                                className="px-3 py-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>

                    {/* Barra de ações quando em modo seleção */}
                    {selectionMode && (
                        <div className="flex flex-col gap-2 p-3 bg-slate-100 rounded-xl mb-4 animate-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={selectAll}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white rounded-lg transition-colors"
                                >
                                    {selectedIds.size === visibleData.length ? '☑️ Desmarcar tudo' : '☐ Selecionar tudo'}
                                </button>
                                <span className="text-sm text-slate-500">
                                    {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* Botão de ação - Exportar TXT */}
                            <div className="flex items-center gap-2 justify-end">
                                <button
                                    onClick={exportSelectedAsText}
                                    disabled={selectedIds.size === 0}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedIds.size > 0
                                        ? 'bg-emerald-500 text-white shadow-md hover:bg-emerald-600'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    <Icon name="download" size={16} />
                                    Exportar TXT
                                </button>
                            </div>
                        </div>
                    )}

                    {visibleData.map((item) => {
                        const isImported = typeof item.id === 'string';
                        const isGerman = item.language === 'de';
                        const isSelected = selectedIds.has(item.id.toString());

                        return (
                            <div
                                key={item.id}
                                className={`bg-white rounded-xl p-5 shadow-sm border-2 w-full transition-all duration-200 ${isSelected ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100'
                                    }`}
                                onClick={() => {
                                    if (selectionMode) {
                                        toggleSelection(item.id.toString());
                                    }
                                }}
                            >
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-between items-start gap-3 w-full">
                                        {/* Checkbox no modo seleção */}
                                        {selectionMode && (
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 mt-1 ${isSelected
                                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                                    : 'border-slate-300 bg-white'
                                                }`}>
                                                {isSelected && <Icon name="check-circle" size={16} />}
                                            </div>
                                        )}

                                        <div className={`
                                            flex-1 min-w-0 text-left
                                            ${isGerman ? 'font-sans text-lg' : 'font-chinese text-xl'} 
                                            text-slate-800 leading-loose 
                                            break-words whitespace-normal
                                            ${selectionMode ? 'pointer-events-none' : ''}
                                        `}>
                                            {renderSentence(item)}
                                        </div>

                                        {!selectionMode && (
                                            <div className="flex flex-col gap-2 flex-shrink-0 pt-1">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{item.language || 'zh'}</span>
                                                    <button onClick={() => speak(item.chinese, (item.language || 'zh') as SupportedLanguage)} className="text-brand-600 bg-brand-50 p-2 rounded-full">
                                                        <Icon name="volume-2" size={18} />
                                                    </button>
                                                </div>
                                                {isImported && onDeleteText && (
                                                    <button onClick={(e) => { e.stopPropagation(); onDeleteText(item.id); }} className="text-slate-400 bg-slate-50 p-2 rounded-full hover:text-red-500">
                                                        <Icon name="trash-2" size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="pt-3 border-t border-slate-50">
                                        <p className="text-slate-500 text-sm italic text-left">{item.translation}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </>
            )}

            <div className="fixed bottom-24 right-6 z-40">
                <button onClick={onOpenImport} className="bg-brand-600 text-white p-4 rounded-full shadow-lg hover:bg-brand-700 active:scale-95 transition-all">
                    <Icon name="plus" size={24} />
                </button>
            </div>

            {/* MODAL CONFIRMAÇÃO */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl animate-pop">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Traduzir e Salvar?</h3>
                        <p className="text-slate-600 mb-6">
                            Deseja gerar o card para a palavra: <br />
                            <span className="font-bold text-brand-600 text-xl block mt-2">{confirmModal.word}</span>
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-100 rounded-xl">Cancelar</button>
                            <button onClick={confirmGeneration} className="flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 shadow-md">Traduzir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReadingView;