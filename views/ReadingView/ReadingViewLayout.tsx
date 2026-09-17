import React from 'react';
import ReadingChrome from './ReadingChrome';
import StudySentenceCard from './StudySentenceCard';
import ReadingModals from './ReadingModals';
import { proposeSentenceSplit } from './newWordsUtils';

export default function ReadingViewLayout(vm: any) {
    const {
        filteredData, studyList, activeFolderFilters, onUpdateFolderFilters,
        readingMode, setReadingMode, readingPrefs, setReadingPrefs,
        focusNewWords, setFocusNewWords, difficultyFilter, setDifficultyFilter,
        difficultyCounts, selectionMode, reorderMode, selectedIds,
        showColorPopover, isCorrectingColors, isColorHighlightEnabled,
        colorBtnRef, colorPopoverRef, colorCorrections, selectedStudyFolder,
        nativeLessonId, nativeAudio, splitAudioCue, attachingAudio, introSkip,
        lessonAlignment, commentsApi, speakText, stopAllSpeech, playingId,
        onAttachFolderAudio, handleAttachFolderAudio, handleCorrectColors,
        setShowColorPopover, setIsColorHighlightEnabled, setSelectionMode,
        setReorderMode, setLocalReorderData, cancelSelection, cancelReorder,
        saveReorder, selectAll, handleEditSelected, handleDeleteSelected,
        openMoveModal, setShowExportModal, setShowNativeAudioModal, setShowAlignmentModal,
        onDeleteText, onDeleteMany, sentenceAnalysisMap, savedWordsMap, wordColorMap,
        meaningPool, completedQuizzes, loadingWord, commentedWords, commentedSentences,
        localReorderData, voiceRecording, onSplitSentence, onResult, stop,
        handleReorder, setSplitPreview, markQuizCompleted, onOpenRepository, onOpenImport,
        splitPreview, splitBusy, confirmSplit, confirmModal,
        setConfirmModal, confirmGeneration, moveModal, setMoveModal, moveTargetFolder,
        setMoveTargetFolder, existingFolders, confirmMove, showExportModal, handleExport,
        editModal, setEditModal, handleSaveEdit, commentTarget, setCommentTarget,
        showNativeAudioModal, showAlignmentModal, alignedLessonId, pdfContainerRef,
        toggleSelection, handleTokenClick, cueForId,
    } = vm;

    return (
        <div className="p-4 space-y-4 pb-24 relative min-h-full">
            <ReadingChrome
                filteredData={filteredData}
                studyListLength={studyList.length}
                activeFolderFilters={activeFolderFilters}
                onUpdateFolderFilters={onUpdateFolderFilters}
                readingMode={readingMode}
                setReadingMode={setReadingMode}
                readingPrefs={readingPrefs}
                setReadingPrefs={setReadingPrefs}
                focusNewWords={focusNewWords}
                setFocusNewWords={setFocusNewWords}
                difficultyFilter={difficultyFilter}
                setDifficultyFilter={setDifficultyFilter}
                difficultyCounts={difficultyCounts}
                selectionMode={selectionMode}
                reorderMode={reorderMode}
                selectedIds={selectedIds}
                showColorPopover={showColorPopover}
                isCorrectingColors={isCorrectingColors}
                isColorHighlightEnabled={isColorHighlightEnabled}
                colorBtnRef={colorBtnRef}
                colorPopoverRef={colorPopoverRef}
                colorCorrections={colorCorrections}
                selectedStudyFolder={selectedStudyFolder}
                nativeLessonId={nativeLessonId}
                nativeAudio={nativeAudio}
                splitAudioCue={splitAudioCue}
                attachingAudio={attachingAudio}
                introSkip={introSkip}
                alignmentCount={lessonAlignment.alignment?.cues.length || 0}
                commentsApi={commentsApi}
                speakText={speakText}
                stopAllSpeech={stopAllSpeech}
                playingId={playingId}
                onAttachFolderAudio={onAttachFolderAudio}
                handleAttachFolderAudio={handleAttachFolderAudio}
                onCorrectColors={(ids) => handleCorrectColors(ids)}
                setShowColorPopover={setShowColorPopover}
                setIsColorHighlightEnabled={setIsColorHighlightEnabled}
                setSelectionMode={setSelectionMode}
                setReorderMode={setReorderMode}
                setLocalReorderData={setLocalReorderData}
                cancelSelection={cancelSelection}
                cancelReorder={cancelReorder}
                saveReorder={saveReorder}
                selectAll={selectAll}
                handleEditSelected={handleEditSelected}
                handleDeleteSelected={handleDeleteSelected}
                openMoveModal={openMoveModal}
                setShowExportModal={setShowExportModal}
                setShowNativeAudioModal={setShowNativeAudioModal}
                setShowAlignmentModal={setShowAlignmentModal}
                onDeleteText={onDeleteText}
                onDeleteMany={onDeleteMany}
            />

            {readingMode === 'simple' && !selectionMode && !reorderMode ? null : studyList.map((item, index) => {
                const analysis = sentenceAnalysisMap.get(item.id.toString());
                const difficulty = analysis?.difficulty || 'easy';
                const canSplit = difficulty === 'hard' && !!onSplitSentence
                    ? proposeSentenceSplit(item, savedWordsMap)
                    : null;
                return (
                    <StudySentenceCard
                        key={item.id}
                        item={item}
                        index={index}
                        savedWordsMap={savedWordsMap}
                        wordColorMap={wordColorMap}
                        colorCorrections={colorCorrections}
                        meaningPool={meaningPool}
                        analysis={analysis}
                        isColorHighlightEnabled={isColorHighlightEnabled}
                        focusNewWords={focusNewWords}
                        selectionMode={selectionMode}
                        reorderMode={reorderMode}
                        isSelected={selectedIds.has(item.id.toString())}
                        quizDone={completedQuizzes.has(item.id.toString())}
                        loadingWord={loadingWord}
                        commentedWords={commentedWords}
                        commentedSentences={commentedSentences}
                        playingId={playingId}
                        playingSegmentId={nativeAudio.playingSegmentId}
                        localReorderLength={localReorderData.length}
                        canSplit={canSplit}
                        voiceRecording={voiceRecording}
                        onDeleteText={onDeleteText}
                        onSplitSentence={onSplitSentence}
                        onResult={onResult}
                        speakText={speakText}
                        stop={stop}
                        nativeStop={nativeAudio.stop}
                        cueForId={cueForId}
                        onToggleSelection={toggleSelection}
                        onTokenClick={handleTokenClick}
                        onComment={setCommentTarget}
                        onReorder={handleReorder}
                        onSplitPreview={(it, proposal) => setSplitPreview({ item: it, proposal })}
                        onQuizCompleted={markQuizCompleted}
                    />
                );
            })}

            <ReadingModals
                onOpenRepository={onOpenRepository}
                onOpenImport={onOpenImport}
                splitPreview={splitPreview}
                splitBusy={splitBusy}
                savedWordsMap={savedWordsMap}
                onCancelSplit={() => !splitBusy && setSplitPreview(null)}
                onConfirmSplit={confirmSplit}
                confirmModal={confirmModal}
                setConfirmModal={setConfirmModal}
                confirmGeneration={confirmGeneration}
                moveModal={moveModal}
                setMoveModal={setMoveModal}
                moveTargetFolder={moveTargetFolder}
                setMoveTargetFolder={setMoveTargetFolder}
                existingFolders={existingFolders}
                confirmMove={confirmMove}
                showExportModal={showExportModal}
                setShowExportModal={setShowExportModal}
                handleExport={handleExport}
                selectedCount={selectedIds.size}
                editModal={editModal}
                setEditModal={setEditModal}
                handleSaveEdit={handleSaveEdit}
                commentTarget={commentTarget}
                setCommentTarget={setCommentTarget}
                commentsApi={commentsApi}
                showNativeAudioModal={showNativeAudioModal}
                setShowNativeAudioModal={setShowNativeAudioModal}
                showAlignmentModal={showAlignmentModal}
                alignedLessonId={alignedLessonId}
                nativeMatch={nativeAudio.match}
                filteredData={filteredData}
                nativeAudio={nativeAudio}
                alignmentDuration={lessonAlignment.alignment?.duration}
                setShowAlignmentModal={setShowAlignmentModal}
                pdfContainerRef={pdfContainerRef}
            />
        </div>
    );
}
