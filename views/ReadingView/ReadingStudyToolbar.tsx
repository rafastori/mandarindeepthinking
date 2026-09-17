import React from 'react';
import Icon from '../../components/Icon';
import NativeLessonPlayer from '../../components/NativeLessonPlayer';
import SimpleReadingMode from './SimpleReadingMode';
import { DIFFICULTY_META, DifficultyLevel } from './newWordsUtils';
import { ReadingChromeProps } from './readingChromeTypes';

type Props = ReadingChromeProps;

const ReadingStudyToolbar: React.FC<Props> = (p) => (
    <>
            {p.activeFolderFilters.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-brand-50 rounded-lg text-sm text-brand-700 mb-4">
                    <Icon name="filter" size={14} />
                    <span>Filtrando por: {p.activeFolderFilters.join(', ')}</span>
                    <button onClick={() => p.onUpdateFolderFilters([])} className="ml-auto text-brand-500 hover:text-brand-700">
                        <Icon name="x" size={14} />
                    </button>
                </div>
            )}

            {(p.selectedStudyFolder || p.nativeLessonId) && !p.selectionMode && !p.reorderMode && (
                <NativeLessonPlayer
                    match={p.nativeAudio.match}
                    hasLibrary={(p.nativeAudio.summary?.fileCount || 0) > 0}
                    canSuggestLink={!!p.nativeLessonId}
                    folderLabel={p.selectedStudyFolder || undefined}
                    clipStart={p.splitAudioCue?.start}
                    clipEnd={p.splitAudioCue?.end}
                    attachingAudio={p.attachingAudio}
                    onAttachAudio={p.onAttachFolderAudio ? p.handleAttachFolderAudio : undefined}
                    isPlaying={p.nativeAudio.isPlaying}
                    isLooping={p.nativeAudio.isLooping}
                    currentTime={p.nativeAudio.currentTime}
                    duration={p.nativeAudio.duration}
                    onPlay={() => {
                        if (p.splitAudioCue) {
                            void p.nativeAudio.playSegment(p.splitAudioCue.start, p.splitAudioCue.end);
                            return;
                        }
                        p.nativeAudio.play(p.introSkip);
                    }}
                    onPause={p.nativeAudio.pause}
                    onStop={p.nativeAudio.stop}
                    onReplay={() => {
                        if (p.splitAudioCue) {
                            void p.nativeAudio.playSegment(p.splitAudioCue.start, p.splitAudioCue.end);
                            return;
                        }
                        p.nativeAudio.replay(p.introSkip);
                    }}
                    onToggleLoop={() => p.nativeAudio.setLooping(!p.nativeAudio.isLooping)}
                    onSeek={(ratio) => {
                        if (p.splitAudioCue && p.nativeAudio.duration > 0) {
                            const span = Math.max(0.01, p.splitAudioCue.end - p.splitAudioCue.start);
                            p.nativeAudio.seek((p.splitAudioCue.start + ratio * span) / p.nativeAudio.duration);
                            return;
                        }
                        p.nativeAudio.seek(ratio);
                    }}
                    onOpenLibrary={() => p.setShowNativeAudioModal(true)}
                    onOpenAlignment={() => {
                        p.nativeAudio.ensureAudio();
                        p.setShowAlignmentModal(true);
                    }}
                    alignmentCount={p.alignmentCount}
                />
            )}

            {p.readingMode === 'study' && !p.selectionMode && !p.reorderMode && p.filteredData.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-4 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mr-1">Carga</span>
                    <button
                        type="button"
                        onClick={() => p.setDifficultyFilter('all')}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${p.difficultyFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                        Todas ({p.filteredData.length})
                    </button>
                    {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map(level => {
                        const meta = DIFFICULTY_META[level];
                        const count = p.difficultyCounts[level];
                        const active = p.difficultyFilter === level;
                        return (
                            <button
                                key={level}
                                type="button"
                                onClick={() => p.setDifficultyFilter(active ? 'all' : level)}
                                disabled={count === 0}
                                title={meta.hint}
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors disabled:opacity-40 ${active ? meta.className + ' ring-2 ring-offset-1 ring-slate-300' : meta.className + ' opacity-80 hover:opacity-100'}`}
                            >
                                {meta.label} · {count}
                            </button>
                        );
                    })}
                    {p.focusNewWords && (
                        <span className="text-[11px] text-slate-400 ml-auto hidden sm:inline">Novas em destaque</span>
                    )}
                </div>
            )}

            {p.selectionMode && (
                <div className="flex flex-col gap-2 p-3 bg-slate-100 rounded-xl mb-4 animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between">
                        <button onClick={p.selectAll} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white rounded-lg transition-colors">
                            {p.selectedIds.size === p.filteredData.length ? '☑️ Desmarcar tudo' : '☐ Selecionar tudo'}
                        </button>
                        <span className="text-sm text-slate-500">
                            {p.selectedIds.size} selecionado{p.selectedIds.size !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                        <button onClick={p.handleEditSelected} disabled={p.selectedIds.size !== 1} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${p.selectedIds.size === 1 ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`} title="Selecione exatamente 1 item">
                            <Icon name="edit-3" size={16} /> Editar
                        </button>
                        <button onClick={p.handleDeleteSelected} disabled={p.selectedIds.size === 0 || (!p.onDeleteMany && !p.onDeleteText)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${p.selectedIds.size > 0 ? 'bg-red-500 text-white shadow-md hover:bg-red-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                            <Icon name="trash-2" size={16} /> Excluir
                        </button>
                        <button onClick={p.openMoveModal} disabled={p.selectedIds.size === 0} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${p.selectedIds.size > 0 ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                            <Icon name="folder-input" size={16} /> Mover
                        </button>
                        <button onClick={() => p.setShowExportModal(true)} disabled={p.selectedIds.size === 0} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${p.selectedIds.size > 0 ? 'bg-emerald-500 text-white shadow-md hover:bg-emerald-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                            <Icon name="download" size={16} /> Exportar
                        </button>
                    </div>
                </div>
            )}

            {p.filteredData.length === 0 && p.activeFolderFilters.length > 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Icon name="folder" size={48} className="text-slate-300 mb-4" />
                    <p className="text-slate-500">Nenhum texto nesta pasta.</p>
                    <button onClick={() => p.onUpdateFolderFilters([])} className="mt-3 text-brand-600 font-medium hover:underline">Ver todos os textos</button>
                </div>
            )}

            {p.readingMode === 'study' && !p.selectionMode && !p.reorderMode && p.filteredData.length > 0 && p.studyListLength === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Icon name="sparkles" size={36} className="text-slate-300 mb-3" />
                    <p className="text-slate-500 text-sm">Nenhuma frase neste nível de carga.</p>
                    <button onClick={() => p.setDifficultyFilter('all')} className="mt-3 text-brand-600 font-medium hover:underline text-sm">Ver todas as frases</button>
                </div>
            )}

            {p.readingMode === 'simple' && !p.selectionMode && !p.reorderMode ? (
                <SimpleReadingMode
                    items={p.filteredData}
                    prefs={p.readingPrefs}
                    onPrefsChange={p.setReadingPrefs}
                    colorCorrections={p.colorCorrections}
                    isCorrectingColors={p.isCorrectingColors}
                    onRequestColorCorrection={(ids) => p.onCorrectColors(ids)}
                    speak={p.speakText}
                    stopSpeak={p.stopAllSpeech}
                    playingId={p.playingId || p.nativeAudio.playingSegmentId}
                    comments={p.commentsApi.comments}
                    onAddComment={p.commentsApi.addComment}
                    onUpdateComment={p.commentsApi.updateComment}
                    onDeleteComment={p.commentsApi.deleteComment}
                    nativeAudio={p.nativeAudio.match ? {
                        available: true,
                        hasAlignment: p.alignmentCount > 0,
                        isPlaying: p.nativeAudio.isPlaying,
                        onPlay: () => p.nativeAudio.play(p.introSkip),
                        onStop: p.nativeAudio.stop,
                    } : undefined}
                />
            ) : null}

    </>
);

export default ReadingStudyToolbar;
