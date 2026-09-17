import React from 'react';
import Icon from '../../components/Icon';
import ExportModal from '../../components/ExportModal';
import NativeAudioLibraryModal from '../../components/NativeAudioLibraryModal';
import AlignmentEditorModal from '../../components/AlignmentEditorModal';
import CommentDialog from './CommentDialog';
import SplitSentenceModal from './SplitSentenceModal';
import { StudyItem, Keyword } from '../../types';
import { ExportConfig } from '../../components/ExportModal';
import { SplitProposal } from './newWordsUtils';
import { useReadingComments } from './useReadingComments';
import { PDF_STYLES } from './readingPdfStyles';

interface EditModal {
    item: StudyItem;
    chinese: string;
    pinyin: string;
    translation: string;
}

interface Props {
    onOpenRepository: () => void;
    onOpenImport: () => void;
    splitPreview: { item: StudyItem; proposal: SplitProposal } | null;
    splitBusy: boolean;
    savedWordsMap: Map<string, Keyword>;
    onCancelSplit: () => void;
    onConfirmSplit: () => void;
    confirmModal: { word: string; sentence: StudyItem } | null;
    setConfirmModal: (v: { word: string; sentence: StudyItem } | null) => void;
    confirmGeneration: () => void;
    moveModal: { itemIds: string[]; currentFolder?: string } | null;
    setMoveModal: (v: { itemIds: string[]; currentFolder?: string } | null) => void;
    moveTargetFolder: string;
    setMoveTargetFolder: (v: string) => void;
    existingFolders: string[];
    confirmMove: () => void;
    showExportModal: boolean;
    setShowExportModal: (v: boolean) => void;
    handleExport: (config: ExportConfig) => void;
    selectedCount: number;
    editModal: EditModal | null;
    setEditModal: (v: EditModal | null) => void;
    handleSaveEdit: () => void;
    commentTarget: { type: 'word' | 'sentence'; key: string; preview: string } | null;
    setCommentTarget: (v: { type: 'word' | 'sentence'; key: string; preview: string } | null) => void;
    commentsApi: ReturnType<typeof useReadingComments>;
    showNativeAudioModal: boolean;
    setShowNativeAudioModal: (v: boolean) => void;
    showAlignmentModal: boolean;
    alignedLessonId: string | null;
    nativeMatch: any;
    filteredData: StudyItem[];
    nativeAudio: {
        currentTime: number;
        duration: number;
        isPlaying: boolean;
        playingSegmentId?: string | null;
        ensureAudio: () => Promise<unknown>;
        play: (start?: number) => void;
        pause: () => void;
        stop: () => void;
        seekTo: (seconds: number) => void;
        playSegment: (start: number, end: number, id?: string) => void;
    };
    alignmentDuration?: number;
    setShowAlignmentModal: (v: boolean) => void;
    pdfContainerRef: React.RefObject<HTMLDivElement | null>;
}

const ReadingModals: React.FC<Props> = (p) => (
    <>
        <div className="fixed bottom-24 right-6 z-40 flex flex-col gap-3">
            <button
                onClick={p.onOpenRepository}
                className="bg-white text-brand-600 p-4 rounded-full shadow-lg border border-brand-100 hover:bg-brand-50 active:scale-95 transition-all text-sm font-bold flex items-center justify-center transform hover:-translate-y-1"
                title="Explorar Biblioteca App"
            >
                <Icon name="library" size={24} />
            </button>
            <button
                onClick={p.onOpenImport}
                className="bg-brand-600 text-white p-4 rounded-full shadow-lg hover:bg-brand-700 active:scale-95 transition-all transform hover:-translate-y-1"
                title="Importar Texto Personalizado"
            >
                <Icon name="plus" size={24} />
            </button>
        </div>

        {p.splitPreview && (
            <SplitSentenceModal
                item={p.splitPreview.item}
                proposal={p.splitPreview.proposal}
                savedWordsMap={p.savedWordsMap}
                busy={p.splitBusy}
                onCancel={p.onCancelSplit}
                onConfirm={p.onConfirmSplit}
            />
        )}

        {p.confirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl animate-pop">
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Traduzir e Salvar?</h3>
                    <p className="text-slate-600 mb-6">
                        Deseja gerar o card para a palavra: <br />
                        <span className="font-bold text-brand-600 text-xl block mt-2">{p.confirmModal.word}</span>
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => p.setConfirmModal(null)} className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-100 rounded-xl">Cancelar</button>
                        <button onClick={p.confirmGeneration} className="flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 shadow-md">Traduzir</button>
                    </div>
                </div>
            </div>
        )}

        {p.moveModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Icon name="folder-input" size={20} className="text-amber-500" />
                        Mover {p.moveModal.itemIds.length} item(s)
                    </h3>
                    <div className="mb-4">
                        <label className="text-sm font-medium text-slate-600 mb-2 block">Pasta de destino:</label>
                        <input
                            type="text"
                            value={p.moveTargetFolder}
                            onChange={(e) => p.setMoveTargetFolder(e.target.value)}
                            placeholder="Digite ou selecione uma pasta"
                            className="w-full p-3 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                        />
                    </div>
                    {p.existingFolders.length > 0 && (
                        <div className="mb-4 max-h-40 overflow-y-auto border border-slate-100 rounded-lg">
                            {p.existingFolders.map(folder => (
                                <button
                                    key={folder}
                                    onClick={() => p.setMoveTargetFolder(folder)}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 flex items-center gap-2 ${p.moveTargetFolder === folder ? 'bg-brand-100' : ''}`}
                                >
                                    <Icon name="folder" size={14} className="text-brand-500" />
                                    {folder}
                                </button>
                            ))}
                        </div>
                    )}
                    <p className="text-xs text-slate-400 mb-4">Deixe vazio para mover para "Sem Categoria"</p>
                    <div className="flex gap-3">
                        <button onClick={() => p.setMoveModal(null)} className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-100 rounded-xl">Cancelar</button>
                        <button onClick={p.confirmMove} className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-md">Mover</button>
                    </div>
                </div>
            </div>
        )}

        <ExportModal
            isOpen={p.showExportModal}
            onClose={() => p.setShowExportModal(false)}
            onConfirm={p.handleExport}
            count={p.selectedCount}
        />

        {p.editModal && (
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
                                value={p.editModal.chinese}
                                onChange={(e) => p.setEditModal({ ...p.editModal!, chinese: e.target.value })}
                                className="w-full p-3 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 min-h-[80px] resize-y"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600 mb-1 block">Pronúncia / Pinyin</label>
                            <input
                                type="text"
                                value={p.editModal.pinyin}
                                onChange={(e) => p.setEditModal({ ...p.editModal!, pinyin: e.target.value })}
                                className="w-full p-3 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600 mb-1 block">Tradução</label>
                            <textarea
                                value={p.editModal.translation}
                                onChange={(e) => p.setEditModal({ ...p.editModal!, translation: e.target.value })}
                                className="w-full p-3 border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 min-h-[60px] resize-y"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => p.setEditModal(null)} className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-100 rounded-xl">Cancelar</button>
                        <button onClick={p.handleSaveEdit} className="flex-1 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 shadow-md">Salvar</button>
                    </div>
                </div>
            </div>
        )}

        {p.commentTarget && (
            <CommentDialog
                target={p.commentTarget}
                existing={p.commentsApi.comments.filter(c => c.targetType === p.commentTarget!.type && c.targetKey === p.commentTarget!.key)}
                onClose={() => p.setCommentTarget(null)}
                onAdd={(text) => p.commentsApi.addComment(p.commentTarget!.type, p.commentTarget!.key, text)}
                onUpdate={p.commentsApi.updateComment}
                onDelete={p.commentsApi.deleteComment}
            />
        )}

        {p.showNativeAudioModal && (
            <NativeAudioLibraryModal onClose={() => p.setShowNativeAudioModal(false)} />
        )}

        {p.showAlignmentModal && p.alignedLessonId && p.nativeMatch && (
            <AlignmentEditorModal
                lessonId={p.alignedLessonId}
                audioFileId={p.nativeMatch.file.id}
                items={p.filteredData}
                language={p.filteredData[0]?.language}
                currentTime={p.nativeAudio.currentTime}
                duration={p.nativeAudio.duration || p.alignmentDuration || 0}
                isPlaying={p.nativeAudio.isPlaying}
                playingSegmentId={p.nativeAudio.playingSegmentId}
                onPlay={(startAt) => { p.nativeAudio.ensureAudio().then(() => p.nativeAudio.play(startAt)); }}
                onPause={p.nativeAudio.pause}
                onStop={p.nativeAudio.stop}
                onSeekTo={(seconds) => { p.nativeAudio.ensureAudio().then(() => p.nativeAudio.seekTo(seconds)); }}
                onPlaySegment={p.nativeAudio.playSegment}
                onClose={() => p.setShowAlignmentModal(false)}
            />
        )}

        <div ref={p.pdfContainerRef} style={PDF_STYLES.container as any}></div>
    </>
);

export default ReadingModals;
