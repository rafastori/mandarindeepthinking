import { StudyItem, Keyword, SupportedLanguage } from '../../types';
import { generateWordCard, generateWordCardWithColor } from '../../services/gemini';
import { moveItemsToFolder } from '../../services/folderService';
import { ExportConfig } from '../../components/ExportModal';
import { SplitProposal } from './newWordsUtils';
import { HIGHLIGHT_COLORS, cleanPunctuation } from './shared';
import { exportSelectedTexts } from './readingExport';
import { applyColorCorrectionPatch } from '../../services/colorCorrectionJob';

export function createReadingViewHandlers(d: {
    filteredData: StudyItem[];
    selectedIds: Set<string>;
    setSelectedIds: (v: Set<string>) => void;
    setSelectionMode: (v: boolean) => void;
    setShowExportModal: (v: boolean) => void;
    onAttachFolderAudio?: (file: File) => Promise<void>;
    setAttachingAudio: (v: boolean) => void;
    onDeleteMany?: (ids: (string | number)[]) => Promise<void>;
    onDeleteText?: (id: string | number) => void;
    setEditModal: (v: { item: StudyItem; chinese: string; pinyin: string; translation: string } | null) => void;
    editModal: { item: StudyItem; chinese: string; pinyin: string; translation: string } | null;
    onUpdateItem?: (id: string, data: Partial<StudyItem>) => void;
    localReorderData: StudyItem[];
    setLocalReorderData: (fn: StudyItem[] | ((prev: StudyItem[]) => StudyItem[])) => void;
    setReorderMode: (v: boolean) => void;
    onReorderItems?: (updates: { id: string | number; createdAt?: string }[]) => Promise<void>;
    setCompletedQuizzes: (fn: (prev: Set<string>) => Set<string>) => void;
    splitPreview: { item: StudyItem; proposal: SplitProposal } | null;
    onSplitSentence?: (originalId: string | number, chunks: Omit<StudyItem, 'id'>[]) => Promise<void>;
    setSplitBusy: (v: boolean) => void;
    setSplitPreview: (v: { item: StudyItem; proposal: SplitProposal } | null) => void;
    loadingWord: string | null;
    savedWordsMap: Map<string, Keyword>;
    wordColorMap: Map<string, number>;
    speakText: (text: string, language: SupportedLanguage, id?: string) => Promise<void>;
    setConfirmModal: (v: { word: string; sentence: StudyItem } | null) => void;
    confirmModal: { word: string; sentence: StudyItem } | null;
    setLoadingWord: (v: string | null) => void;
    onSaveGeneratedCard: (card: Keyword, context: string) => void;
    isColorHighlightEnabled: boolean;
    setIsColorHighlightEnabled: (v: boolean) => void;
    userId?: string;
    moveModal: { itemIds: string[]; currentFolder?: string } | null;
    setMoveModal: (v: { itemIds: string[]; currentFolder?: string } | null) => void;
    moveTargetFolder: string;
    setMoveTargetFolder: (v: string) => void;
}) {
    const handleAttachFolderAudio = async (file: File) => {
        if (!d.onAttachFolderAudio) return;
        d.setAttachingAudio(true);
        try {
            await d.onAttachFolderAudio(file);
        } catch (error: any) {
            alert(error?.message || 'Falha ao adicionar o áudio.');
        } finally {
            d.setAttachingAudio(false);
        }
    };

    const handleExport = async (config: ExportConfig) => {
        d.setShowExportModal(false);
        await exportSelectedTexts({
            filteredData: d.filteredData,
            selectedIds: d.selectedIds,
            config,
            onDone: () => {
                d.setSelectedIds(new Set());
                d.setSelectionMode(false);
            },
        });
    };

    const toggleSelection = (id: string) => {
        const next = new Set(d.selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        d.setSelectedIds(next);
    };
    const selectAll = () => {
        if (d.selectedIds.size === d.filteredData.length) d.setSelectedIds(new Set());
        else d.setSelectedIds(new Set(d.filteredData.map(i => i.id.toString())));
    };
    const cancelSelection = () => { d.setSelectionMode(false); d.setSelectedIds(new Set()); };

    const handleDeleteSelected = async () => {
        if (d.selectedIds.size === 0) return;
        if (!window.confirm(`Tem certeza que deseja excluir ${d.selectedIds.size} item(s)?`)) return;
        const ids = Array.from(d.selectedIds);
        if (d.onDeleteMany) await d.onDeleteMany(ids);
        else if (d.onDeleteText) for (const id of ids) d.onDeleteText(id);
        d.setSelectedIds(new Set());
        d.setSelectionMode(false);
    };

    const handleEditSelected = () => {
        if (d.selectedIds.size !== 1) return;
        const item = d.filteredData.find(i => i.id.toString() === Array.from(d.selectedIds)[0]);
        if (!item) return;
        d.setEditModal({ item, chinese: item.chinese, pinyin: item.pinyin || '', translation: item.translation || '' });
    };

    const handleSaveEdit = () => {
        if (!d.editModal || !d.onUpdateItem) return;
        d.onUpdateItem(d.editModal.item.id.toString(), {
            chinese: d.editModal.chinese,
            pinyin: d.editModal.pinyin,
            translation: d.editModal.translation,
            tokens: d.editModal.chinese.split(/\s+/),
        });
        d.setEditModal(null);
        d.setSelectedIds(new Set());
        d.setSelectionMode(false);
    };

    const handleReorder = (currentIndex: number, direction: 'up' | 'down') => {
        if (d.localReorderData.length < 2) return;
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= d.localReorderData.length) return;
        d.setLocalReorderData(prev => {
            const next = [...prev];
            const temp = next[currentIndex];
            next[currentIndex] = next[targetIndex];
            next[targetIndex] = temp;
            return next;
        });
    };

    const saveReorder = async () => {
        if (!d.onReorderItems || d.localReorderData.length === 0) {
            d.setReorderMode(false);
            d.setLocalReorderData([]);
            return;
        }
        try {
            await d.onReorderItems(d.localReorderData.map(item => ({ id: item.id })));
        } catch (error) {
            console.error('[saveReorder] Erro:', error);
            alert('Erro ao salvar a sequência. Verifique o console.');
        } finally {
            d.setReorderMode(false);
            d.setLocalReorderData([]);
        }
    };
    const cancelReorder = () => { d.setReorderMode(false); d.setLocalReorderData([]); };

    const markQuizCompleted = (sentenceId: string) => {
        d.setCompletedQuizzes(prev => {
            if (prev.has(sentenceId)) return prev;
            const next = new Set(prev);
            next.add(sentenceId);
            return next;
        });
    };

    const confirmSplit = async () => {
        if (!d.splitPreview || !d.onSplitSentence) return;
        d.setSplitBusy(true);
        try {
            const id = d.splitPreview.item.id;
            await d.onSplitSentence(id, d.splitPreview.proposal.chunks);
            await applyColorCorrectionPatch({ deleteIds: [String(id)] });
            d.setSplitPreview(null);
        } catch (e) {
            console.error('[SplitSentence]', e);
            alert('Erro ao dividir a frase. Tente novamente.');
        } finally {
            d.setSplitBusy(false);
        }
    };

    const handleTokenClick = (token: string, contextSentence: StudyItem) => {
        if (d.loadingWord) return;
        const cleanToken = cleanPunctuation(token);
        if (!cleanToken) return;
        const savedKw = d.savedWordsMap.get(cleanToken.toLowerCase());
        if (savedKw) {
            d.speakText(savedKw.word, (savedKw.language || 'zh') as 'zh' | 'de' | 'pt' | 'en');
            return;
        }
        d.setConfirmModal({ word: cleanToken, sentence: contextSentence });
    };

    const confirmGeneration = async () => {
        if (!d.confirmModal) return;
        const { word, sentence } = d.confirmModal;
        d.setConfirmModal(null);
        d.setLoadingWord(word);
        try {
            const lang = sentence.language || 'zh';
            const translation = (sentence.translation || '').trim();
            const newCard = await generateWordCard(word, sentence.chinese, lang);
            d.onSaveGeneratedCard(newCard, sentence.chinese);
            d.speakText(newCard.word, lang as 'zh' | 'de' | 'pt' | 'en');
            if (!translation) return;
            const sentenceSavedWords: { word: string; meaning: string; colorIndex: number }[] = [];
            const seen = new Set<string>();
            sentence.tokens.forEach(token => {
                const clean = cleanPunctuation(token).toLowerCase();
                const kw = d.savedWordsMap.get(clean);
                const colorIdx = d.wordColorMap.get(clean);
                if (kw && colorIdx !== undefined && kw.meaning && !seen.has(kw.word)) {
                    seen.add(kw.word);
                    sentenceSavedWords.push({ word: kw.word, meaning: kw.meaning, colorIndex: colorIdx });
                }
            });
            const newWordColorIndex = d.wordColorMap.size % HIGHLIGHT_COLORS.length;
            sentenceSavedWords.push({ word: newCard.word, meaning: newCard.meaning, colorIndex: newWordColorIndex });
            generateWordCardWithColor(word, sentence.chinese, translation, lang, sentenceSavedWords, newWordColorIndex)
                .then(async result => {
                    if (result.coloredTranslation.length > 0) {
                        await applyColorCorrectionPatch({ set: { [sentence.id.toString()]: result.coloredTranslation } });
                        if (!d.isColorHighlightEnabled) d.setIsColorHighlightEnabled(true);
                    }
                })
                .catch(err => console.error('[Color after translate]', err));
        } catch (error) {
            console.error(error);
            alert('Erro ao processar. Verifique sua conexão.');
        } finally {
            d.setLoadingWord(null);
        }
    };

    const openMoveModal = () => {
        if (d.selectedIds.size === 0) return;
        d.setMoveModal({ itemIds: Array.from(d.selectedIds) });
        d.setMoveTargetFolder('');
    };

    const confirmMove = async () => {
        if (!d.userId || !d.moveModal) return;
        const result = await moveItemsToFolder(d.userId, d.moveModal.itemIds, d.moveTargetFolder.trim() || null);
        if (result.success) {
            alert(`${result.movedCount} item(s) movido(s)!`);
            d.setMoveModal(null);
            d.setSelectedIds(new Set());
            d.setSelectionMode(false);
        } else {
            alert(`Erro: ${result.error}`);
        }
    };

    return {
        handleAttachFolderAudio,
        handleExport,
        toggleSelection,
        selectAll,
        cancelSelection,
        handleDeleteSelected,
        handleEditSelected,
        handleSaveEdit,
        handleReorder,
        saveReorder,
        cancelReorder,
        markQuizCompleted,
        confirmSplit,
        handleTokenClick,
        confirmGeneration,
        openMoveModal,
        confirmMove,
    };
}
