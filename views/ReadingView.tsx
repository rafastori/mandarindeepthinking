import React, { useMemo, useState } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import FolderTree from '../components/FolderTree';
import { StudyItem, Keyword, SupportedLanguage } from '../types';
import { usePuterSpeech } from '../hooks/usePuterSpeech';
import { generateWordCard } from '../services/gemini';
import { renameFolder, deleteFolderWithItems, uncategorizeFolder, moveItemsToFolder, extractFolderPaths } from '../services/folderService';

interface ReadingViewProps {
    data: StudyItem[];
    savedIds: string[];
    onToggleSave: (id: string) => void;
    onOpenImport: () => void;
    onOpenImportInFolder?: (folderPath: string) => void;
    onDeleteText?: (id: string | number) => void;
    onSaveGeneratedCard: (card: Keyword, context: string) => void;
    onUpdateItem?: (id: string, data: Partial<StudyItem>) => void;
    activeFolderFilters: string[];
    onUpdateFolderFilters: (filters: string[]) => void;
    userId?: string;
}

const ReadingView: React.FC<ReadingViewProps> = ({
    data,
    savedIds,
    onToggleSave,
    onOpenImport,
    onOpenImportInFolder,
    onDeleteText,
    onSaveGeneratedCard,
    onUpdateItem,
    activeFolderFilters,
    onUpdateFolderFilters,
    userId
}) => {
    const { speak } = usePuterSpeech();
    const [loadingWord, setLoadingWord] = useState<string | null>(null);

    // Estados para modo de seleção
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Estado do FolderTree
    const [showFolderTree, setShowFolderTree] = useState(false);

    // Modal de confirmação para cards
    const [confirmModal, setConfirmModal] = useState<{
        word: string;
        sentence: StudyItem;
    } | null>(null);

    // Modal para mover itens
    const [moveModal, setMoveModal] = useState<{
        itemIds: string[];
        currentFolder?: string;
    } | null>(null);
    const [moveTargetFolder, setMoveTargetFolder] = useState('');

    // Lista de pastas para o modal de mover
    const existingFolders = useMemo(() => extractFolderPaths(data), [data]);

    // FILTRO: Aplica filtros de pasta se houver seleção
    const filteredData = useMemo(() => {
        let result = data.filter(item => item.type !== 'word');

        if (activeFolderFilters.length > 0) {
            result = result.filter(item => {
                // Verifica se o item está em alguma das pastas selecionadas
                if (activeFolderFilters.includes('__uncategorized__')) {
                    if (!item.folderPath) return true;
                }

                return activeFolderFilters.some(filterPath => {
                    if (item.folderPath === filterPath) return true;
                    if (item.folderPath?.startsWith(filterPath + '/')) return true;
                    return false;
                });
            });
        }

        return result;
    }, [data, activeFolderFilters]);

    // Função para formatar tokens em texto legível
    const formatTokensToText = (tokens: string[]): string => {
        if (!tokens || tokens.length === 0) return '';

        const punctuationNoBefore = /^[,.\-!?;:)\]}"'»›…。，！？；：）】」』、]/;
        const punctuationNoAfter = /[(\[{"'«‹（【「『]$/;

        let result = '';
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const prevToken = i > 0 ? tokens[i - 1] : '';

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

        const selectedItems = filteredData.filter(item => selectedIds.has(item.id.toString()));

        let content = '═══════════════════════════════════════\n';
        content += '   TEXTOS EXPORTADOS - MemorizaTudo\n';
        content += '   ' + new Date().toLocaleDateString('pt-BR') + '\n';
        content += '═══════════════════════════════════════\n\n';

        selectedItems.forEach((item, index) => {
            const formattedText = formatTokensToText(item.tokens);
            content += `[${index + 1}] PASTA: ${item.folderPath || 'Sem Categoria'}\n`;
            content += `TEXTO ORIGINAL (${item.language?.toUpperCase() || 'ZH'}):\n`;
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
        if (selectedIds.size === filteredData.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredData.map(i => i.id.toString())));
        }
    };

    const cancelSelection = () => {
        setSelectionMode(false);
        setSelectedIds(new Set());
    };

    // Mapa Global de Palavras
    const savedWordsMap = useMemo(() => {
        const map = new Map<string, Keyword>();
        data.forEach(item => {
            item.keywords?.forEach(k => {
                if (savedIds.includes(k.id)) map.set(k.word.toLowerCase().trim(), k);
            });

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
            speak(savedKw.word, (savedKw.language || 'zh') as 'zh' | 'de' | 'pt' | 'en');
            return;
        }

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
            onSaveGeneratedCard(newCard, sentence.chinese);
            speak(newCard.word, lang as 'zh' | 'de' | 'pt' | 'en');
        } catch (error) {
            console.error(error);
            alert("Erro ao processar. Verifique sua conexão.");
        } finally {
            setLoadingWord(null);
        }
    };

    // Handlers para FolderTree
    const handleImportInFolder = (folderPath: string) => {
        if (onOpenImportInFolder) {
            onOpenImportInFolder(folderPath);
        }
        setShowFolderTree(false);
    };

    const handleRenameFolder = async (oldPath: string, newPath: string) => {
        if (!userId) return alert("Você precisa estar logado.");

        const result = await renameFolder(userId, oldPath, newPath);
        if (result.success) {
            alert(`Pasta renomeada! ${result.updatedCount} item(s) atualizado(s).`);
        } else {
            alert(`Erro ao renomear: ${result.error}`);
        }
    };

    const handleDeleteFolder = async (path: string) => {
        if (!userId) return alert("Você precisa estar logado.");

        const action = window.confirm(
            `Deseja excluir todos os itens da pasta "${path}"?\n\n` +
            `Clique "OK" para excluir tudo, ou "Cancelar" para mover para "Sem Categoria".`
        );

        if (action) {
            const result = await deleteFolderWithItems(userId, path);
            if (result.success) {
                alert(`${result.deletedCount} item(s) excluído(s).`);
            } else {
                alert(`Erro: ${result.error}`);
            }
        } else {
            const result = await uncategorizeFolder(userId, path);
            if (result.success) {
                alert(`${result.movedCount} item(s) movido(s) para "Sem Categoria".`);
            } else {
                alert(`Erro: ${result.error}`);
            }
        }
    };

    // Mover itens selecionados
    const openMoveModal = () => {
        if (selectedIds.size === 0) return;
        setMoveModal({ itemIds: Array.from(selectedIds) });
        setMoveTargetFolder('');
    };

    const confirmMove = async () => {
        if (!userId || !moveModal) return;

        const targetPath = moveTargetFolder.trim() || null;
        const result = await moveItemsToFolder(userId, moveModal.itemIds, targetPath);

        if (result.success) {
            alert(`${result.movedCount} item(s) movido(s)!`);
            setMoveModal(null);
            setSelectedIds(new Set());
            setSelectionMode(false);
        } else {
            alert(`Erro: ${result.error}`);
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
            {/* FolderTree Sidebar */}
            <FolderTree
                data={data}
                selectedPaths={activeFolderFilters}
                onSelect={onUpdateFolderFilters}
                onImportInFolder={handleImportInFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                isOpen={showFolderTree}
                onClose={() => setShowFolderTree(false)}
            />

            {filteredData.length === 0 && activeFolderFilters.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                    <EmptyState msg="Biblioteca vazia." icon="book-open" />
                    <p className="text-slate-400 text-sm mt-2">Importe um texto para começar.</p>
                </div>
            ) : (
                <>
                    {/* Header com botões */}
                    <div className="flex items-center justify-between mb-4 gap-2">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowFolderTree(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
                            >
                                <Icon name="folder-tree" size={16} />
                                Pastas
                                {activeFolderFilters.length > 0 && (
                                    <span className="bg-brand-500 text-white text-xs px-1.5 rounded-full">
                                        {activeFolderFilters.length}
                                    </span>
                                )}
                            </button>

                            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                <Icon name="book-open" size={20} className="text-brand-600" />
                                Leitura ({filteredData.length})
                            </h2>
                        </div>

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

                    {/* Indicador de filtro ativo */}
                    {activeFolderFilters.length > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-brand-50 rounded-lg text-sm text-brand-700 mb-4">
                            <Icon name="filter" size={14} />
                            <span>Filtrando por: {activeFolderFilters.join(', ')}</span>
                            <button
                                onClick={() => onUpdateFolderFilters([])}
                                className="ml-auto text-brand-500 hover:text-brand-700"
                            >
                                <Icon name="x" size={14} />
                            </button>
                        </div>
                    )}

                    {/* Barra de ações quando em modo seleção */}
                    {selectionMode && (
                        <div className="flex flex-col gap-2 p-3 bg-slate-100 rounded-xl mb-4 animate-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={selectAll}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white rounded-lg transition-colors"
                                >
                                    {selectedIds.size === filteredData.length ? '☑️ Desmarcar tudo' : '☐ Selecionar tudo'}
                                </button>
                                <span className="text-sm text-slate-500">
                                    {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 justify-end">
                                <button
                                    onClick={openMoveModal}
                                    disabled={selectedIds.size === 0}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedIds.size > 0
                                        ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    <Icon name="folder-input" size={16} />
                                    Mover
                                </button>
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

                    {/* Empty state quando filtro não retorna resultados */}
                    {filteredData.length === 0 && activeFolderFilters.length > 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Icon name="folder-open" size={48} className="text-slate-300 mb-4" />
                            <p className="text-slate-500">Nenhum texto nesta pasta.</p>
                            <button
                                onClick={() => onUpdateFolderFilters([])}
                                className="mt-3 text-brand-600 font-medium hover:underline"
                            >
                                Ver todos os textos
                            </button>
                        </div>
                    )}

                    {filteredData.map((item) => {
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
                                    {/* Folder badge */}
                                    {item.folderPath && (
                                        <div className="flex items-center gap-1 text-xs text-slate-400">
                                            <Icon name="folder" size={12} />
                                            <span>{item.folderPath}</span>
                                        </div>
                                    )}

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

            {/* MODAL CONFIRMAÇÃO TRADUÇÃO */}
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

            {/* MODAL MOVER ITENS */}
            {moveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Icon name="folder-input" size={20} className="text-amber-500" />
                            Mover {moveModal.itemIds.length} item(s)
                        </h3>

                        <div className="mb-4">
                            <label className="text-sm font-medium text-slate-600 mb-2 block">
                                Pasta de destino:
                            </label>
                            <input
                                type="text"
                                value={moveTargetFolder}
                                onChange={(e) => setMoveTargetFolder(e.target.value)}
                                placeholder="Digite ou selecione uma pasta"
                                className="w-full p-3 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                            />
                        </div>

                        {existingFolders.length > 0 && (
                            <div className="mb-4 max-h-40 overflow-y-auto border border-slate-100 rounded-lg">
                                {existingFolders.map(folder => (
                                    <button
                                        key={folder}
                                        onClick={() => setMoveTargetFolder(folder)}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 flex items-center gap-2 ${moveTargetFolder === folder ? 'bg-brand-100' : ''}`}
                                    >
                                        <Icon name="folder" size={14} className="text-brand-500" />
                                        {folder}
                                    </button>
                                ))}
                            </div>
                        )}

                        <p className="text-xs text-slate-400 mb-4">
                            Deixe vazio para mover para "Sem Categoria"
                        </p>

                        <div className="flex gap-3">
                            <button onClick={() => setMoveModal(null)} className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-100 rounded-xl">
                                Cancelar
                            </button>
                            <button onClick={confirmMove} className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-md">
                                Mover
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReadingView;