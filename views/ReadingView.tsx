import React, { useMemo, useState, useRef, useEffect } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem, Keyword, SupportedLanguage } from '../types';
import { usePuterSpeech } from '../hooks/usePuterSpeech';
import { generateWordCard, correctColorHighlights, ColorCorrectionOutput } from '../services/gemini';
import { moveItemsToFolder, extractFolderPaths } from '../services/folderService';
import ExportModal, { ExportConfig } from '../components/ExportModal';
import VoiceMicButton from '../components/VoiceMicButton';
import type { useVoiceRecording } from '../hooks/useVoiceRecording';

// Estilos para PDF (invisível na tela)
const PDF_STYLES = {
    container: {
        position: 'fixed' as const,
        top: '-9999px',
        left: '-9999px',
        width: '210mm', // A4
        minHeight: '297mm',
        backgroundColor: 'white',
        padding: '20mm',
        color: 'black',
        fontFamily: 'Arial, sans-serif',
        zIndex: -50
    },
    header: {
        borderBottom: '2px solid #333',
        marginBottom: '20px',
        paddingBottom: '10px'
    },
    title: {
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '5px'
    },
    date: {
        fontSize: '14px',
        color: '#666'
    },
    item: {
        marginBottom: '15px',
        pageBreakInside: 'avoid' as const
    },
    chinese: {
        fontSize: '18px',
        marginBottom: '5px',
        lineHeight: 1.5
    },
    translation: {
        fontSize: '14px',
        color: '#444',
        fontStyle: 'italic'
    },
    divider: {
        borderBottom: '1px solid #eee',
        marginTop: '15px'
    }
};

interface ReadingViewProps {
    data: StudyItem[];
    savedIds: string[];
    onToggleSave: (id: string) => void;
    onOpenImport: () => void;
    onOpenRepository: () => void;
    onOpenImportInFolder?: (folderPath: string) => void;
    onDeleteText?: (id: string | number) => void;
    onSaveGeneratedCard: (card: Keyword, context: string) => void;
    onUpdateItem?: (id: string, data: Partial<StudyItem>) => void;
    activeFolderFilters: string[];
    onUpdateFolderFilters: (filters: string[]) => void;
    userId?: string;
    voiceRecording?: ReturnType<typeof useVoiceRecording>;
    isColorHighlightEnabled: boolean;
    setIsColorHighlightEnabled: (enabled: boolean) => void;
}

const ReadingView: React.FC<ReadingViewProps> = ({
    data,
    savedIds,
    onToggleSave,
    onOpenImport,
    onOpenRepository,
    onOpenImportInFolder,
    onDeleteText,
    onSaveGeneratedCard,
    onUpdateItem,
    activeFolderFilters,
    onUpdateFolderFilters,
    userId,
    voiceRecording,
    isColorHighlightEnabled,
    setIsColorHighlightEnabled
}) => {
    const { speak, stop, playingId } = usePuterSpeech();
    const [loadingWord, setLoadingWord] = useState<string | null>(null);

    // Estados para popover de cores e correção via IA
    const [showColorPopover, setShowColorPopover] = useState(false);
    const [isCorrectingColors, setIsCorrectingColors] = useState(false);
    const [colorCorrections, setColorCorrections] = useState<Map<string, { word: string; colorIndex: number | null }[]>>(() => {
        try {
            const saved = localStorage.getItem('colorCorrections');
            if (saved) {
                // Converte de volta de [chave, valor][] para Map
                return new Map(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Erro ao ler colorCorrections do localStorage:', e);
        }
        return new Map();
    });

    // Persistir correções de cores
    useEffect(() => {
        try {
            // Converte Map para array de pares para serialização JSON
            const arrayFormat = Array.from(colorCorrections.entries());
            localStorage.setItem('colorCorrections', JSON.stringify(arrayFormat));
        } catch (e) {
            console.error('Erro ao salvar colorCorrections no localStorage:', e);
        }
    }, [colorCorrections]);

    const colorPopoverRef = useRef<HTMLDivElement>(null);
    const colorBtnRef = useRef<HTMLButtonElement>(null);

    // Fechar popover de cores ao clicar fora
    useEffect(() => {
        if (!showColorPopover) return;
        const handler = (e: MouseEvent) => {
            if (colorPopoverRef.current && !colorPopoverRef.current.contains(e.target as Node) &&
                colorBtnRef.current && !colorBtnRef.current.contains(e.target as Node)) {
                setShowColorPopover(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showColorPopover]);

    // Paleta de 15 cores vibrantes e bem distintas para destaque de palavras
    const HIGHLIGHT_COLORS = [
        { text: '#b91c1c', bg: '#fee2e2' },   // vermelho
        { text: '#0369a1', bg: '#e0f2fe' },   // azul
        { text: '#15803d', bg: '#dcfce7' },   // verde
        { text: '#7e22ce', bg: '#f3e8ff' },   // roxo
        { text: '#c2410c', bg: '#ffedd5' },   // laranja
        { text: '#0e7490', bg: '#cffafe' },   // ciano
        { text: '#a16207', bg: '#fef9c3' },   // amarelo escuro
        { text: '#be185d', bg: '#fce7f3' },   // rosa
        { text: '#4338ca', bg: '#e0e7ff' },   // indigo
        { text: '#166534', bg: '#d1fae5' },   // verde escuro
        { text: '#9333ea', bg: '#ede9fe' },   // violeta
        { text: '#ea580c', bg: '#fff7ed' },   // laranja queimado
        { text: '#0891b2', bg: '#ecfeff' },   // teal
        { text: '#b45309', bg: '#fffbeb' },   // âmbar
        { text: '#dc2626', bg: '#fef2f2' },   // vermelho vivo
    ];

    // Mapa estável: cada palavra salva recebe um índice de cor único
    const wordColorMap = useMemo(() => {
        const map = new Map<string, number>();
        let colorIndex = 0;
        data.forEach(item => {
            item.keywords?.forEach(k => {
                if (savedIds.includes(k.id)) {
                    const key = k.word.toLowerCase().trim();
                    if (!map.has(key)) {
                        map.set(key, colorIndex % HIGHLIGHT_COLORS.length);
                        colorIndex++;
                    }
                }
            });
            const isWordCard = item.type === 'word' || (item.tokens.length === 1 && savedIds.includes(item.id.toString()));
            if (isWordCard) {
                const key = item.chinese.toLowerCase().trim();
                if (!map.has(key)) {
                    map.set(key, colorIndex % HIGHLIGHT_COLORS.length);
                    colorIndex++;
                }
            }
        });
        return map;
    }, [data, savedIds]);

    // Estado do modal de edição
    const [editModal, setEditModal] = useState<{
        item: StudyItem;
        chinese: string;
        pinyin: string;
        translation: string;
    } | null>(null);

    // Estados para modo de seleção
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Estado do ExportModal
    const [showExportModal, setShowExportModal] = useState(false);
    // Ref para o container de geração de PDF
    const pdfContainerRef = React.useRef<HTMLDivElement>(null);

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

                // MATCH EXATO: apenas mostra itens cuja pasta está explicitamente selecionada
                return activeFolderFilters.includes(item.folderPath || '');
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

    // Função PRINCIPAL de Exportação (Mobile-Safe)
    const handleExport = async (config: ExportConfig) => {
        const { filename, type } = config;
        const selectedItems = filteredData.filter(item => selectedIds.has(item.id.toString()));
        if (selectedItems.length === 0) return;

        // FECHAR modal IMEDIATAMENTE
        setShowExportModal(false);

        try {
            console.log(`[Export] Starting ${type.toUpperCase()} export...`);

            // Prepara os itens para a API
            const exportItems = selectedItems.map(item => ({
                text: formatTokensToText(item.tokens),
                translation: item.translation || ''
            }));
            console.log('[Export] Items to export:', exportItems.length);

            // Chama a API Python (unificada para TXT e PDF)
            const response = await fetch('/api/export-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: exportItems, filename, type })
            });

            console.log('[Export] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Export] Error response:', errorText);
                try {
                    const error = JSON.parse(errorText);
                    throw new Error(error.error || 'Erro ao exportar');
                } catch {
                    throw new Error(`Erro ${response.status}: ${errorText}`);
                }
            }

            // Baixa o arquivo
            const blob = await response.blob();
            console.log('[Export] Blob size:', blob.size, 'bytes');

            await saveBlob(blob, filename, type);
            console.log('[Export] Download triggered!');

            // Limpa seleção após sucesso
            setSelectedIds(new Set());
            setSelectionMode(false);

        } catch (error: any) {
            console.error('[Export] ERRO CAPTURADO:', error);
            alert(`Erro ao exportar: ${error.message || error}`);
        }
    };

    // Salva arquivo de TEXTO (Mobile-Safe)
    const saveFile = async (content: string, filename: string, extension: string, mimeType: string) => {
        // @ts-ignore - File System Access API (Desktop Chrome/Edge)
        if (window.showSaveFilePicker) {
            try {
                // @ts-ignore
                const handle = await window.showSaveFilePicker({
                    suggestedName: `${filename}.${extension}`,
                    types: [{ description: 'Arquivo', accept: { [mimeType]: [`.${extension}`] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();
                return;
            } catch (err: any) {
                if (err.name === 'AbortError') return;
            }
        }

        // Fallback Robusto (Mobile/Safari)
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        await saveBlob(blob, filename, extension);
    };

    // Salva BLOB (PDF ou qualquer binário) - Mobile-Safe
    const saveBlob = async (blob: Blob, filename: string, extension: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${extension}`;

        // TRUQUE MOBILE: Forçar abertura em nova aba para iOS
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            a.target = '_blank';
        }

        a.style.display = 'none';
        document.body.appendChild(a);

        // setTimeout(0) limpa a pilha de execução - mais confiável em mobile
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    resolve();
                }, 100);
            }, 0);
        });
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

    // Excluir itens selecionados
    const handleDeleteSelected = () => {
        if (selectedIds.size === 0 || !onDeleteText) return;
        const count = selectedIds.size;
        if (!window.confirm(`Tem certeza que deseja excluir ${count} item(s)?`)) return;

        selectedIds.forEach(id => onDeleteText(id));
        setSelectedIds(new Set());
        setSelectionMode(false);
    };

    // Abrir modal de edição (apenas 1 item)
    const handleEditSelected = () => {
        if (selectedIds.size !== 1) return;
        const itemId = Array.from(selectedIds)[0];
        const item = filteredData.find(i => i.id.toString() === itemId);
        if (!item) return;

        setEditModal({
            item,
            chinese: item.chinese,
            pinyin: item.pinyin || '',
            translation: item.translation || ''
        });
    };

    // Salvar edição
    const handleSaveEdit = () => {
        if (!editModal || !onUpdateItem) return;
        onUpdateItem(editModal.item.id.toString(), {
            chinese: editModal.chinese,
            pinyin: editModal.pinyin,
            translation: editModal.translation,
            tokens: editModal.chinese.split(/\s+/)
        });
        setEditModal(null);
        setSelectedIds(new Set());
        setSelectionMode(false);
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

    // Função para solicitar correção de cores via IA
    const handleCorrectColors = async () => {
        setShowColorPopover(false);
        setIsCorrectingColors(true);

        try {
            // Coletar segmentos filtrados com palavras salvas
            const sentencesForAI = filteredData
                .filter(item => item.translation) // Apenas itens com tradução
                .map(item => {
                    const savedWords: { word: string; meaning: string; colorIndex: number }[] = [];
                    item.tokens.forEach(token => {
                        const clean = cleanPunctuation(token).toLowerCase();
                        const kw = savedWordsMap.get(clean);
                        const colorIdx = wordColorMap.get(clean);
                        if (kw && colorIdx !== undefined && kw.meaning) {
                            // Evita duplicatas
                            if (!savedWords.some(sw => sw.word === kw.word)) {
                                savedWords.push({ word: kw.word, meaning: kw.meaning, colorIndex: colorIdx });
                            }
                        }
                    });
                    return {
                        sentenceId: item.id.toString(),
                        originalText: item.chinese,
                        translation: item.translation || '',
                        savedWords
                    };
                })
                .filter(s => s.savedWords.length > 0); // Apenas frases com palavras salvas

            if (sentencesForAI.length === 0) {
                alert('Nenhuma palavra salva encontrada nos textos filtrados.');
                setIsCorrectingColors(false);
                return;
            }

            // Detectar idioma predominante
            const langCounts: Record<string, number> = {};
            filteredData.forEach(item => {
                const lang = item.language || 'zh';
                langCounts[lang] = (langCounts[lang] || 0) + 1;
            });
            const predominantLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as SupportedLanguage || 'zh';

            const results = await correctColorHighlights(sentencesForAI, predominantLang);

            // Converter resultado em Map
            const newCorrections = new Map<string, { word: string; colorIndex: number | null }[]>();
            results.forEach((r: ColorCorrectionOutput) => {
                newCorrections.set(r.sentenceId, r.coloredTranslation);
            });
            setColorCorrections(newCorrections);

            // Ativar cores automaticamente se estiver desativado
            if (!isColorHighlightEnabled) {
                setIsColorHighlightEnabled(true);
            }
        } catch (error) {
            console.error('[ColorCorrection] Erro:', error);
            alert('Erro ao corrigir cores. Tente novamente.');
        } finally {
            setIsCorrectingColors(false);
        }
    };

    const renderSentence = (sentence: StudyItem) => {
        return sentence.tokens.map((token, i) => {
            const cleanToken = cleanPunctuation(token);
            const isSaved = !!savedWordsMap.get(cleanToken.toLowerCase());
            const isLoading = loadingWord === cleanToken;
            const colorIdx = wordColorMap.get(cleanToken.toLowerCase());
            const color = colorIdx !== undefined ? HIGHLIGHT_COLORS[colorIdx] : null;

            const useMultiColor = isSaved && isColorHighlightEnabled && color;

            return (
                <span
                    key={i}
                    onClick={(e) => { e.stopPropagation(); handleTokenClick(token, sentence); }}
                    className={`
                        inline-block px-1 mx-0.5 rounded transition-all border-b-2 mb-1 relative cursor-pointer
                        ${isSaved && !useMultiColor
                            ? 'bg-brand-100 text-brand-800 border-brand-500 font-bold'
                            : !isSaved
                                ? 'hover:bg-brand-50 border-slate-300 border-dotted hover:border-brand-300 text-slate-700'
                                : 'font-bold'
                        }
                        ${isLoading ? 'opacity-70 cursor-wait' : ''}
                    `}
                    style={useMultiColor ? { color: color.text, backgroundColor: color.bg, borderBottomColor: color.text } : undefined}
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
                            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                <Icon name="book-open" size={20} className="text-brand-600" />
                                Leitura ({filteredData.length})
                            </h2>
                            <div className="relative inline-flex">
                                <button
                                    ref={colorBtnRef}
                                    onClick={(e) => { e.stopPropagation(); setShowColorPopover(!showColorPopover); }}
                                    className={`p-1.5 rounded-lg transition-colors ml-1 ${isCorrectingColors
                                        ? 'text-amber-500 bg-amber-50 animate-pulse'
                                        : isColorHighlightEnabled
                                            ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                        }`}
                                    title="Opções de cores"
                                >
                                    {isCorrectingColors
                                        ? <div className="w-[18px] h-[18px] border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                        : <Icon name="palette" size={18} />
                                    }
                                </button>

                                {/* Popover de opções de cores */}
                                {showColorPopover && !isCorrectingColors && (
                                    <div
                                        ref={colorPopoverRef}
                                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 min-w-[200px] z-[100] animate-in fade-in slide-in-from-top-2"
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowColorPopover(false);
                                                setIsColorHighlightEnabled(!isColorHighlightEnabled);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700"
                                        >
                                            <Icon name={isColorHighlightEnabled ? 'eye-off' : 'palette'} size={16} className={isColorHighlightEnabled ? 'text-slate-400' : 'text-amber-500'} />
                                            {isColorHighlightEnabled ? 'Desativar cores' : 'Ativar cores'}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCorrectColors();
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700"
                                        >
                                            <Icon name="rotate-ccw" size={16} className="text-brand-500" />
                                            Atualizar correção por cores
                                        </button>

                                        {/* Arrow pointing up */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[-1px]">
                                            <div className="w-2.5 h-2.5 bg-white border-l border-t border-slate-200 transform rotate-45" />
                                        </div>
                                    </div>
                                )}
                            </div>
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

                            <div className="flex items-center gap-2 justify-end flex-wrap">
                                <button
                                    onClick={handleEditSelected}
                                    disabled={selectedIds.size !== 1}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedIds.size === 1
                                        ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                    title="Selecione exatamente 1 item"
                                >
                                    <Icon name="edit-3" size={16} />
                                    Editar
                                </button>
                                <button
                                    onClick={handleDeleteSelected}
                                    disabled={selectedIds.size === 0 || !onDeleteText}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedIds.size > 0
                                        ? 'bg-red-500 text-white shadow-md hover:bg-red-600'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    <Icon name="trash-2" size={16} />
                                    Excluir
                                </button>
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
                                    onClick={() => setShowExportModal(true)}
                                    disabled={selectedIds.size === 0}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedIds.size > 0
                                        ? 'bg-emerald-500 text-white shadow-md hover:bg-emerald-600'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    <Icon name="download" size={16} />
                                    Exportar
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
                                className={`bg-white rounded-xl p-3 shadow-sm border-2 w-full transition-all duration-200 ${isSelected ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100'
                                    }`}
                                onClick={() => {
                                    if (selectionMode) {
                                        toggleSelection(item.id.toString());
                                    }
                                }}
                            >
                                <div className="flex flex-col gap-2">
                                    {/* Top bar: folder + actions */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1 text-xs text-slate-400 min-w-0 flex-1">
                                            {item.folderPath && (
                                                <>
                                                    <Icon name="folder" size={12} className="flex-shrink-0" />
                                                    <span className="truncate">{item.folderPath}</span>
                                                </>
                                            )}
                                        </div>

                                        {!selectionMode && (
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{item.language || 'zh'}</span>
                                                <button
                                                    onClick={() => {
                                                        const audioId = `reading-${item.id}`;
                                                        if (playingId === audioId) {
                                                            stop();
                                                        } else {
                                                            speak(item.chinese, (item.language || 'zh') as SupportedLanguage, audioId);
                                                        }
                                                    }}
                                                    className={`p-1.5 rounded-full transition-all ${playingId === `reading-${item.id}` ? 'text-white bg-brand-600 animate-pulse' : 'text-brand-600 bg-brand-50'}`}
                                                >
                                                    <Icon name={playingId === `reading-${item.id}` ? 'square' : 'volume-2'} size={16} />
                                                </button>
                                                {voiceRecording && (
                                                    <VoiceMicButton
                                                        wordId={item.id.toString()}
                                                        hasRecording={voiceRecording.hasRecording(item.id.toString())}
                                                        isRecording={voiceRecording.isRecording}
                                                        isPlaying={voiceRecording.isPlaying}
                                                        recordingWordId={voiceRecording.recordingWordId}
                                                        playingWordId={voiceRecording.playingWordId}
                                                        recordingTime={voiceRecording.recordingTime}
                                                        onStartRecording={voiceRecording.startRecording}
                                                        onStopRecording={voiceRecording.stopAndSave}
                                                        onPlay={voiceRecording.playRecording}
                                                        onStopPlaying={voiceRecording.stopPlaying}
                                                    />
                                                )}
                                                {isImported && onDeleteText && (
                                                    <button onClick={(e) => { e.stopPropagation(); onDeleteText(item.id); }} className="text-slate-400 p-1.5 rounded-full hover:text-red-500 hover:bg-red-50">
                                                        <Icon name="trash-2" size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-start gap-3 w-full">
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
                                    </div>
                                    <div className="pt-2 border-t border-slate-50">
                                        <p className="text-slate-500 text-sm italic text-left">
                                            {isColorHighlightEnabled ? (() => {
                                                // 1. Verificar se existe correção da IA para esta frase
                                                const aiCorrection = colorCorrections.get(item.id.toString());
                                                if (aiCorrection && aiCorrection.length > 0) {
                                                    return aiCorrection.map((token, wi) => {
                                                        const color = token.colorIndex !== null && token.colorIndex !== undefined
                                                            ? HIGHLIGHT_COLORS[token.colorIndex % HIGHLIGHT_COLORS.length]
                                                            : null;
                                                        return (
                                                            <span key={wi}>
                                                                {wi > 0 ? ' ' : ''}
                                                                <span style={color ? { color: color.text, fontWeight: 600 } : undefined}>
                                                                    {token.word}
                                                                </span>
                                                            </span>
                                                        );
                                                    });
                                                }

                                                // 2. Fallback: matching heurístico original
                                                const sentenceSavedWords: { meaning: string; colorIdx: number }[] = [];
                                                item.tokens.forEach(token => {
                                                    const clean = cleanPunctuation(token).toLowerCase();
                                                    const kw = savedWordsMap.get(clean);
                                                    const colorIdx = wordColorMap.get(clean);
                                                    if (kw && colorIdx !== undefined && kw.meaning) {
                                                        sentenceSavedWords.push({ meaning: kw.meaning, colorIdx });
                                                    }
                                                });

                                                if (sentenceSavedWords.length === 0) return item.translation;

                                                return (item.translation || '').split(/\s+/).map((word, wi) => {
                                                    let matchColor: { text: string; bg: string } | null = null;
                                                    const cleanWord = word.replace(/[.,!?;:()\\[\\]{}"']/g, '').toLowerCase();
                                                    if (cleanWord.length > 1) {
                                                        for (const sw of sentenceSavedWords) {
                                                            const meanings = sw.meaning.toLowerCase().split(/[,;/]/).map(m => m.trim());
                                                            if (meanings.some(m => m.includes(cleanWord) || cleanWord.includes(m))) {
                                                                matchColor = HIGHLIGHT_COLORS[sw.colorIdx];
                                                                break;
                                                            }
                                                        }
                                                    }
                                                    return (
                                                        <span key={wi}>
                                                            {wi > 0 ? ' ' : ''}
                                                            <span style={matchColor ? { color: matchColor.text, fontWeight: 600 } : undefined}>
                                                                {word}
                                                            </span>
                                                        </span>
                                                    );
                                                });
                                            })() : item.translation}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </>
            )}

            <div className="fixed bottom-24 right-6 z-40 flex flex-col gap-3">
                <button
                    onClick={onOpenRepository}
                    className="bg-white text-brand-600 p-4 rounded-full shadow-lg border border-brand-100 hover:bg-brand-50 active:scale-95 transition-all text-sm font-bold flex items-center justify-center transform hover:-translate-y-1"
                    title="Explorar Biblioteca App"
                >
                    <Icon name="library" size={24} />
                </button>
                <button
                    onClick={onOpenImport}
                    className="bg-brand-600 text-white p-4 rounded-full shadow-lg hover:bg-brand-700 active:scale-95 transition-all transform hover:-translate-y-1"
                    title="Importar Texto Personalizado"
                >
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

            <ExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                onConfirm={handleExport}
                count={selectedIds.size}
            />

            {/* MODAL DE EDIÇÃO */}
            {editModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-pop">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Icon name="edit-3" size={20} className="text-blue-500" />
                            Editar Texto
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-600 mb-1 block">Texto Original</label>
                                <textarea
                                    value={editModal.chinese}
                                    onChange={(e) => setEditModal({ ...editModal, chinese: e.target.value })}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 min-h-[80px] resize-y"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-600 mb-1 block">Pronúncia / Pinyin</label>
                                <input
                                    type="text"
                                    value={editModal.pinyin}
                                    onChange={(e) => setEditModal({ ...editModal, pinyin: e.target.value })}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-600 mb-1 block">Tradução</label>
                                <textarea
                                    value={editModal.translation}
                                    onChange={(e) => setEditModal({ ...editModal, translation: e.target.value })}
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 min-h-[60px] resize-y"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setEditModal(null)}
                                className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-100 rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="flex-1 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 shadow-md"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Container Invisível para PDF */}
            <div ref={pdfContainerRef} style={PDF_STYLES.container as any}></div>
        </div>
    );
};

export default ReadingView;