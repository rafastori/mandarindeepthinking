import React, { useState, useRef, useEffect } from 'react';
import { StudyItem, Keyword } from '../../types';
import { usePuterSpeech } from '../../hooks/usePuterSpeech';
import type { useVoiceRecording } from '../../hooks/useVoiceRecording';
import { localDB } from '../../services/localDB';
import { useReadingComments } from './useReadingComments';
import { useReadingViewAudio } from './useReadingViewAudio';
import { DifficultyLevel, SplitProposal } from './newWordsUtils';
import { cleanPunctuation } from './shared';
import { useReadingColorJob } from './useReadingColorJob';
import { useReadingStudyData } from './useReadingStudyData';
import { createReadingViewHandlers } from './useReadingViewHandlers';
import ReadingViewLayout from './ReadingViewLayout';

interface ReadingViewProps {
    data: StudyItem[];
    savedIds: string[];
    onToggleSave: (id: string) => void;
    onOpenImport: () => void;
    onOpenRepository: () => void;
    onOpenImportInFolder?: (folderPath: string) => void;
    onDeleteText?: (id: string | number) => void;
    onDeleteMany?: (ids: (string | number)[]) => Promise<void>;
    onSaveGeneratedCard: (card: Keyword, context: string) => void;
    onUpdateItem?: (id: string, data: Partial<StudyItem>) => void;
    onReorderItems?: (updates: { id: string | number; createdAt?: string }[]) => Promise<void>;
    onSplitSentence?: (originalId: string | number, chunks: Omit<StudyItem, 'id'>[]) => Promise<void>;
    activeFolderFilters: string[];
    onUpdateFolderFilters: (filters: string[]) => void;
    userId?: string;
    voiceRecording?: ReturnType<typeof useVoiceRecording>;
    isColorHighlightEnabled: boolean;
    setIsColorHighlightEnabled: (enabled: boolean) => void;
    onResult?: (isCorrect: boolean, word: string) => void;
    splitAudioCue?: { audioLessonId: string; start: number; end: number } | null;
    onAttachFolderAudio?: (file: File) => Promise<void>;
}

const ReadingView: React.FC<ReadingViewProps> = (props) => {
    const {
        data, savedIds, onOpenImport, onOpenRepository, onDeleteText, onDeleteMany,
        onSaveGeneratedCard, onUpdateItem, onReorderItems, onSplitSentence,
        activeFolderFilters, onUpdateFolderFilters, userId, voiceRecording,
        isColorHighlightEnabled, setIsColorHighlightEnabled, onResult,
        splitAudioCue = null, onAttachFolderAudio,
    } = props;

    const { speak, stop, playingId } = usePuterSpeech();
    const [showNativeAudioModal, setShowNativeAudioModal] = useState(false);
    const [showAlignmentModal, setShowAlignmentModal] = useState(false);
    const [attachingAudio, setAttachingAudio] = useState(false);
    const [loadingWord, setLoadingWord] = useState<string | null>(null);
    const [showColorPopover, setShowColorPopover] = useState(false);
    const [readingMode, setReadingMode] = useState<'study' | 'simple'>('study');
    const [readingPrefs, setReadingPrefs] = useState<{ showTranslation: boolean; fontSize: 'sm' | 'md' | 'lg' | 'xl' }>({
        showTranslation: true, fontSize: 'md',
    });
    const [focusNewWords, setFocusNewWords] = useState(true);
    const [difficultyFilter, setDifficultyFilter] = useState<DifficultyLevel | 'all'>('all');
    const [completedQuizzes, setCompletedQuizzes] = useState<Set<string>>(() => new Set());
    const [splitPreview, setSplitPreview] = useState<{ item: StudyItem; proposal: SplitProposal } | null>(null);
    const [splitBusy, setSplitBusy] = useState(false);
    const readingPrefsHydrated = useRef(false);
    const commentsApi = useReadingComments();
    const [commentTarget, setCommentTarget] = useState<{ type: 'word' | 'sentence'; key: string; preview: string } | null>(null);
    const colorPopoverRef = useRef<HTMLDivElement>(null);
    const colorBtnRef = useRef<HTMLButtonElement>(null);
    const [editModal, setEditModal] = useState<{ item: StudyItem; chinese: string; pinyin: string; translation: string } | null>(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [reorderMode, setReorderMode] = useState(false);
    const [localReorderData, setLocalReorderData] = useState<StudyItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showExportModal, setShowExportModal] = useState(false);
    const pdfContainerRef = React.useRef<HTMLDivElement>(null);
    const [confirmModal, setConfirmModal] = useState<{ word: string; sentence: StudyItem } | null>(null);
    const [moveModal, setMoveModal] = useState<{ itemIds: string[]; currentFolder?: string } | null>(null);
    const [moveTargetFolder, setMoveTargetFolder] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const profile = await localDB.getProfile();
                if (cancelled) return;
                if (profile.readingMode) setReadingMode(profile.readingMode);
                if (profile.readingPrefs) setReadingPrefs(profile.readingPrefs);
            } catch (e) {
                console.error('Erro ao hidratar prefs de leitura:', e);
            } finally {
                readingPrefsHydrated.current = true;
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!readingPrefsHydrated.current) return;
        localDB.updateProfile({ readingMode, readingPrefs }).catch(e => {
            console.error('Erro ao salvar prefs de leitura:', e);
        });
    }, [readingMode, readingPrefs]);

    const commentedWords = React.useMemo(() => {
        const set = new Set<string>();
        commentsApi.comments.forEach(c => { if (c.targetType === 'word') set.add(c.targetKey); });
        return set;
    }, [commentsApi.comments]);
    const commentedSentences = React.useMemo(() => {
        const set = new Set<string>();
        commentsApi.comments.forEach(c => { if (c.targetType === 'sentence') set.add(c.targetKey); });
        return set;
    }, [commentsApi.comments]);

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

    const study = useReadingStudyData({
        data, savedIds, activeFolderFilters, reorderMode, localReorderData, difficultyFilter, selectionMode,
    });
    const {
        wordColorMap, existingFolders, filteredData, savedWordsMap,
        meaningPool, sentenceAnalysisMap, difficultyCounts, studyList,
    } = study;

    const audio = useReadingViewAudio({ filteredData, activeFolderFilters, splitAudioCue, stop, speak });
    const {
        selectedStudyFolder, nativeLessonId, nativeAudio, alignedLessonId,
        lessonAlignment, cueForId, introSkip, speakText, stopAllSpeech,
    } = audio;

    const { isCorrectingColors, colorCorrections, handleCorrectColors } = useReadingColorJob({
        filteredData, savedWordsMap, wordColorMap, isColorHighlightEnabled, setIsColorHighlightEnabled, cleanPunctuation,
    });

    const handlers = createReadingViewHandlers({
        filteredData, selectedIds, setSelectedIds, setSelectionMode, setShowExportModal,
        onAttachFolderAudio, setAttachingAudio, onDeleteMany, onDeleteText, setEditModal, editModal,
        onUpdateItem, localReorderData, setLocalReorderData, setReorderMode, onReorderItems,
        setCompletedQuizzes, splitPreview, onSplitSentence, setSplitBusy, setSplitPreview,
        loadingWord, savedWordsMap, wordColorMap, speakText, setConfirmModal, confirmModal,
        setLoadingWord, onSaveGeneratedCard, isColorHighlightEnabled, setIsColorHighlightEnabled,
        userId, moveModal, setMoveModal, moveTargetFolder, setMoveTargetFolder,
    });

    return (
        <ReadingViewLayout vm={{
            filteredData, studyList, activeFolderFilters, onUpdateFolderFilters,
            readingMode, setReadingMode, readingPrefs, setReadingPrefs,
            focusNewWords, setFocusNewWords, difficultyFilter, setDifficultyFilter,
            difficultyCounts, selectionMode, reorderMode, selectedIds,
            showColorPopover, isCorrectingColors, isColorHighlightEnabled,
            colorBtnRef, colorPopoverRef, colorCorrections, selectedStudyFolder,
            nativeLessonId, nativeAudio, splitAudioCue, attachingAudio, introSkip,
            lessonAlignment, commentsApi, speakText, stopAllSpeech, playingId,
            onAttachFolderAudio, handleCorrectColors,
            setShowColorPopover, setIsColorHighlightEnabled, setSelectionMode,
            setReorderMode, setLocalReorderData, setShowExportModal, setShowNativeAudioModal, setShowAlignmentModal,
            onDeleteText, onDeleteMany, sentenceAnalysisMap, savedWordsMap, wordColorMap,
            meaningPool, completedQuizzes, loadingWord, commentedWords, commentedSentences,
            localReorderData, voiceRecording, onSplitSentence, onResult, stop,
            setSplitPreview, onOpenRepository, onOpenImport,
            splitPreview, splitBusy, confirmModal, setConfirmModal,
            moveModal, setMoveModal, moveTargetFolder, setMoveTargetFolder,
            existingFolders, showExportModal, editModal, setEditModal,
            commentTarget, setCommentTarget, showNativeAudioModal, showAlignmentModal,
            alignedLessonId, pdfContainerRef, cueForId,
            ...handlers,
        }} />
    );
};

export default ReadingView;
