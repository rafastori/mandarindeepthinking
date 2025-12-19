import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem, SupportedLanguage } from '../types';
import { usePuterSpeech } from '../hooks/usePuterSpeech';

const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string }[] = [
    { code: 'zh', label: '中文 (Chinês)' },
    { code: 'de', label: 'Deutsch (Alemão)' },
    { code: 'ja', label: '日本語 (Japonês)' },
    { code: 'ko', label: '한국어 (Coreano)' },
    { code: 'fr', label: 'Français (Francês)' },
    { code: 'es', label: 'Español (Espanhol)' },
    { code: 'it', label: 'Italiano' },
    { code: 'en', label: 'English (Inglês)' },
    { code: 'pt', label: 'Português' },
];

interface ReviewViewProps {
    data: StudyItem[];
    savedIds: string[];
    onRemove: (id: string) => void;
    onUpdateLanguage?: (id: string, data: Partial<StudyItem>) => void;
}

const ReviewView: React.FC<ReviewViewProps> = ({ data, savedIds, onRemove, onUpdateLanguage }) => {
    const { speak } = usePuterSpeech();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingLangId, setEditingLangId] = useState<string | null>(null);
    const [editingContextId, setEditingContextId] = useState<string | null>(null);
    const [editedContext, setEditedContext] = useState('');

    // LÓGICA NOVA (Compatível com Firebase e HSK)
    const savedItems = useMemo(() => {
        let items: {
            id: string;
            word: string;
            pinyin: string;
            meaning: string;
            sourceId: string;
            language?: SupportedLanguage;
            sentence: { chinese: string; translation: string; language?: SupportedLanguage };
        }[] = [];

        data.forEach(item => {
            // CASO 1: A palavra é um item importado (Novo sistema Firebase)
            if (savedIds.includes(item.id.toString())) {
                items.push({
                    id: item.id.toString(),
                    word: item.chinese,
                    pinyin: item.pinyin,
                    meaning: item.translation,
                    sourceId: item.id.toString(),
                    language: item.language,
                    sentence: {
                        chinese: item.originalSentence || item.chinese,
                        translation: "Contexto original",
                        language: item.language
                    }
                });
            }

            // CASO 2: A palavra está dentro de um texto (Sistema antigo HSK)
            if (item.keywords) {
                item.keywords.forEach(k => {
                    if (savedIds.includes(k.id)) {
                        items.push({
                            ...k,
                            sourceId: k.id,
                            sentence: item
                        });
                    }
                });
            }
        });

        return items.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i).reverse();
    }, [savedIds, data]);

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
        if (selectedIds.size === savedItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(savedItems.map(i => i.sourceId)));
        }
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;

        const count = selectedIds.size;
        if (window.confirm(`Deseja excluir ${count} palavra${count > 1 ? 's' : ''}?`)) {
            selectedIds.forEach(id => onRemove(id));
            setSelectedIds(new Set());
            setSelectionMode(false);
        }
    };

    const cancelSelection = () => {
        setSelectionMode(false);
        setSelectedIds(new Set());
        setShowBulkLangDropdown(false);
    };

    const handleLanguageChange = (itemId: string, newLang: SupportedLanguage) => {
        if (onUpdateLanguage) {
            onUpdateLanguage(itemId, { language: newLang });
        }
        setEditingLangId(null);
    };

    const [showBulkLangDropdown, setShowBulkLangDropdown] = useState(false);

    const handleBulkLanguageChange = (newLang: SupportedLanguage) => {
        if (!onUpdateLanguage || selectedIds.size === 0) return;

        selectedIds.forEach(id => {
            onUpdateLanguage(id, { language: newLang });
        });

        setShowBulkLangDropdown(false);
        setSelectedIds(new Set());
        setSelectionMode(false);
    };

    if (savedItems.length === 0) return <EmptyState msg="Marque palavras na Leitura para revisar aqui." icon="bookmark" />;

    return (
        <div className="p-4 space-y-3 pb-24">
            {/* Header com botão de seleção */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <Icon name="bookmark" size={20} className="text-brand-600" />
                    Revisão ({savedItems.length})
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
                <div className="flex flex-col gap-2 p-3 bg-slate-100 rounded-xl mb-4 animate-in slide-in-from-top-2 overflow-visible">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={selectAll}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white rounded-lg transition-colors"
                        >
                            {selectedIds.size === savedItems.length ? '☑️ Desmarcar tudo' : '☐ Selecionar tudo'}
                        </button>
                        <span className="text-sm text-slate-500">
                            {selectedIds.size} selecionada{selectedIds.size !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Botões de ação */}
                    <div className="flex items-center gap-2 justify-end">
                        {/* Botão Trocar Idioma */}
                        <div className="relative">
                            <button
                                onClick={() => setShowBulkLangDropdown(!showBulkLangDropdown)}
                                disabled={selectedIds.size === 0}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedIds.size > 0
                                    ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    }`}
                            >
                                🌐 Idioma ▼
                            </button>

                            {/* Dropdown de idiomas */}
                            {showBulkLangDropdown && selectedIds.size > 0 && (
                                <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-[100] py-2 min-w-[180px] max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-1">
                                    <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase">Aplicar idioma a {selectedIds.size} itens</p>
                                    {SUPPORTED_LANGUAGES.map(lang => (
                                        <button
                                            key={lang.code}
                                            onClick={() => handleBulkLanguageChange(lang.code)}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-slate-600"
                                        >
                                            {lang.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Botão Excluir */}
                        <button
                            onClick={handleDeleteSelected}
                            disabled={selectedIds.size === 0}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedIds.size > 0
                                ? 'bg-red-500 text-white shadow-md hover:bg-red-600'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                        >
                            <Icon name="trash-2" size={16} />
                            Excluir
                        </button>
                    </div>
                </div>
            )}

            {savedItems.map(item => {
                const isGerman = item.language === 'de' || item.sentence.language === 'de';
                const isSelected = selectedIds.has(item.sourceId);

                return (
                    <div
                        key={item.id}
                        className={`bg-white rounded-lg shadow-sm border-2 overflow-hidden transition-all duration-200 ${isSelected ? 'border-red-400 bg-red-50' : 'border-slate-100'
                            }`}
                    >
                        {/* CABEÇALHO */}
                        <div
                            className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${selectionMode ? 'hover:bg-slate-100' : 'hover:bg-slate-50'
                                }`}
                            onClick={() => {
                                if (selectionMode) {
                                    toggleSelection(item.sourceId);
                                } else {
                                    setExpandedId(expandedId === item.id ? null : item.id);
                                }
                            }}
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {/* Checkbox no modo seleção */}
                                {selectionMode && (
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected
                                        ? 'bg-red-500 border-red-500 text-white'
                                        : 'border-slate-300 bg-white'
                                        }`}>
                                        {isSelected && <Icon name="check-circle" size={16} />}
                                    </div>
                                )}


                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <h3 className={`${isGerman ? 'font-sans' : 'font-chinese'} text-xl font-bold text-brand-700 truncate`}>
                                        {item.word}
                                    </h3>
                                    <div className="flex items-center gap-1 relative">
                                        {/* Tag de idioma clicável */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingLangId(editingLangId === item.sourceId ? null : item.sourceId);
                                            }}
                                            className="text-[10px] font-bold text-slate-400 uppercase hover:text-brand-600 hover:bg-brand-50 px-1.5 py-0.5 rounded transition-colors"
                                            title="Clique para alterar idioma"
                                        >
                                            {item.language || item.sentence.language || 'zh'} ▼
                                        </button>

                                        {/* Dropdown de idiomas */}
                                        {editingLangId === item.sourceId && (
                                            <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-[100] py-2 min-w-[160px] max-h-[250px] overflow-y-auto animate-in fade-in slide-in-from-top-1">
                                                {SUPPORTED_LANGUAGES.map(lang => (
                                                    <button
                                                        key={lang.code}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleLanguageChange(item.sourceId, lang.code);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${(item.language || 'zh') === lang.code ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600'
                                                            }`}
                                                    >
                                                        {lang.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {!selectionMode && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    speak(item.word, (item.language || item.sentence.language || 'zh') as SupportedLanguage);
                                                }}
                                                className="p-1.5 rounded-full text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors flex-shrink-0"
                                                title="Ouvir pronúncia"
                                            >
                                                <Icon name="volume-2" size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {!selectionMode && (
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="text-xs text-slate-400 hover:text-brand-600 font-medium uppercase tracking-wide">
                                        {expandedId === item.id ? 'Recolher' : 'Detalhes'}
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRemove(item.sourceId); }}
                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors"
                                    >
                                        <Icon name="trash-2" size={18} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* DETALHES (Expansível) - só mostra fora do modo seleção */}
                        {!selectionMode && expandedId === item.id && (
                            <div className="bg-slate-50 p-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-1">
                                <div className="mb-4">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                                        {isGerman ? 'Pronúncia' : 'Pinyin'}
                                    </span>
                                    <p className="font-medium text-brand-600 text-lg">{item.pinyin}</p>
                                    <p className="text-slate-700 mt-2 font-medium">{item.meaning}</p>
                                </div>

                                {item.sentence.chinese && item.sentence.chinese !== item.word && (
                                    <div className="bg-white p-3 rounded border border-slate-200">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Contexto</span>
                                            {editingContextId !== item.sourceId ? (
                                                <button
                                                    onClick={() => {
                                                        setEditingContextId(item.sourceId);
                                                        setEditedContext(item.sentence.chinese);
                                                    }}
                                                    className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                                                    title="Editar contexto"
                                                >
                                                    <Icon name="edit-3" size={14} />
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => {
                                                            if (onUpdateLanguage && editedContext.trim()) {
                                                                onUpdateLanguage(item.sourceId, { originalSentence: editedContext.trim() });
                                                            }
                                                            setEditingContextId(null);
                                                        }}
                                                        className="p-1 rounded text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                        title="Confirmar"
                                                    >
                                                        <Icon name="check-circle" size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingContextId(null)}
                                                        className="p-1 rounded text-red-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                        title="Cancelar"
                                                    >
                                                        <Icon name="x" size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {editingContextId === item.sourceId ? (
                                            <textarea
                                                value={editedContext}
                                                onChange={(e) => setEditedContext(e.target.value)}
                                                className={`w-full p-2 border border-slate-300 rounded-lg text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none ${isGerman ? 'font-sans' : 'font-chinese'}`}
                                                rows={3}
                                                autoFocus
                                            />
                                        ) : (
                                            <p className={`${isGerman ? 'font-sans' : 'font-chinese'} text-slate-800 mb-1 leading-relaxed`}>
                                                {item.sentence.chinese}
                                            </p>
                                        )}

                                        {item.sentence.translation && item.sentence.translation !== "Contexto original" && (
                                            <p className="text-xs text-slate-500 italic mt-1">{item.sentence.translation}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ReviewView;