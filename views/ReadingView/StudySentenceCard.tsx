import React from 'react';
import Icon from '../../components/Icon';
import VoiceMicButton from '../../components/VoiceMicButton';
import SentenceMicroQuiz from './SentenceMicroQuiz';
import { StudyItem, Keyword, SupportedLanguage } from '../../types';
import { ColorCorrectionToken } from '../../services/localDB';
import { renderStudyTokens, renderColoredTranslation } from './sentenceRender';
import { DIFFICULTY_META, proposeSentenceSplit, SentenceWordAnalysis } from './newWordsUtils';
import type { useVoiceRecording } from '../../hooks/useVoiceRecording';

interface Props {
    item: StudyItem;
    index: number;
    savedWordsMap: Map<string, Keyword>;
    wordColorMap: Map<string, number>;
    colorCorrections: Map<string, ColorCorrectionToken[]>;
    meaningPool: string[];
    analysis?: SentenceWordAnalysis;
    isColorHighlightEnabled: boolean;
    focusNewWords: boolean;
    selectionMode: boolean;
    reorderMode: boolean;
    isSelected: boolean;
    quizDone: boolean;
    loadingWord: string | null;
    commentedWords: Set<string>;
    commentedSentences: Set<string>;
    playingId?: string | null;
    playingSegmentId?: string | null;
    localReorderLength: number;
    canSplit: ReturnType<typeof proposeSentenceSplit> | null;
    voiceRecording?: ReturnType<typeof useVoiceRecording>;
    onDeleteText?: (id: string | number) => void;
    onSplitSentence?: Function;
    onResult?: (isCorrect: boolean, word: string) => void;
    speakText: (text: string, language: SupportedLanguage, id?: string) => Promise<void>;
    stop: () => void;
    nativeStop: () => void;
    cueForId: (id?: string) => unknown;
    onToggleSelection: (id: string) => void;
    onTokenClick: (token: string, sentence: StudyItem) => void;
    onComment: (target: { type: 'word' | 'sentence'; key: string; preview: string }) => void;
    onReorder: (index: number, direction: 'up' | 'down') => void;
    onSplitPreview: (item: StudyItem, proposal: NonNullable<ReturnType<typeof proposeSentenceSplit>>) => void;
    onQuizCompleted: (sentenceId: string) => void;
}

const StudySentenceCard: React.FC<Props> = (props) => {
    const {
        item, index, analysis, isSelected, quizDone, canSplit,
        selectionMode, reorderMode, localReorderLength,
        playingId, playingSegmentId, voiceRecording, onDeleteText,
    } = props;
    const isImported = typeof item.id === 'string';
    const isGerman = item.language === 'de';
    const difficulty = analysis?.difficulty || 'easy';
    const diffMeta = DIFFICULTY_META[difficulty];
    const audioId = `reading-${item.id}`;
    const sentenceId = item.id.toString();
    const isThis = playingId === audioId || playingSegmentId === sentenceId;

    return (
        <div
            className={`bg-white rounded-xl p-3 shadow-sm border-2 w-full transition-all duration-200 ${isSelected ? 'border-emerald-400 bg-emerald-50' : reorderMode ? 'border-brand-200 bg-slate-50/50' : quizDone ? 'border-emerald-200' : 'border-slate-100'}`}
            onClick={() => { if (selectionMode) props.onToggleSelection(sentenceId); }}
        >
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0 flex-1 flex-wrap">
                        {analysis && !selectionMode && !reorderMode && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${diffMeta.className}`} title={diffMeta.hint}>
                                {analysis.newCount === 0 ? '0 novas' : `${analysis.newCount} nova${analysis.newCount === 1 ? '' : 's'}`}
                                <span className="opacity-70 font-semibold">· {diffMeta.label}</span>
                            </span>
                        )}
                        {item.folderPath && (
                            <>
                                <Icon name="folder" size={12} className="flex-shrink-0" />
                                <span className="truncate">{item.folderPath}</span>
                            </>
                        )}
                    </div>

                    {!selectionMode && !reorderMode && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{item.language || 'zh'}</span>
                            <button
                                onClick={() => {
                                    if (isThis) {
                                        props.nativeStop();
                                        props.stop();
                                    } else {
                                        props.speakText(item.chinese, (item.language || 'zh') as SupportedLanguage, audioId);
                                    }
                                }}
                                className={`p-1.5 rounded-full transition-all ${isThis ? 'text-white bg-brand-600 animate-pulse' : 'text-brand-600 bg-brand-50'}`}
                                title={props.cueForId(sentenceId) ? 'Ouvir trecho nativo' : 'Ouvir (TTS ou aula nativa)'}
                            >
                                <Icon name={isThis ? 'square' : 'volume-2'} size={16} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    props.onComment({ type: 'sentence', key: sentenceId, preview: item.chinese.slice(0, 60) });
                                }}
                                className={`p-1.5 rounded-full transition-all ${props.commentedSentences.has(sentenceId) ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                                title="Comentar esta frase"
                            >
                                <Icon name="message-circle" size={16} />
                            </button>
                            {voiceRecording && (
                                <VoiceMicButton
                                    wordId={sentenceId}
                                    hasRecording={voiceRecording.hasRecording(sentenceId)}
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

                    {reorderMode && (
                        <div className="flex items-center gap-2 flex-shrink-0 bg-white rounded-lg border border-slate-200 p-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); props.onReorder(index, 'up'); }}
                                disabled={index === 0}
                                className={`p-1.5 rounded-md transition-all ${index === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-brand-600 hover:bg-brand-50'}`}
                                title="Mover para Cima"
                            >
                                <Icon name="arrow-up" size={18} />
                            </button>
                            <div className="w-px h-4 bg-slate-200"></div>
                            <button
                                onClick={(e) => { e.stopPropagation(); props.onReorder(index, 'down'); }}
                                disabled={index === localReorderLength - 1}
                                className={`p-1.5 rounded-md transition-all ${index === localReorderLength - 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-brand-600 hover:bg-brand-50'}`}
                                title="Mover para Baixo"
                            >
                                <Icon name="arrow-down" size={18} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-start gap-3 w-full">
                    {selectionMode && (
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 mt-1 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                            {isSelected && <Icon name="check-circle" size={16} />}
                        </div>
                    )}
                    <div className={`flex-1 min-w-0 text-left ${isGerman ? 'font-sans text-lg' : 'font-chinese text-xl'} text-slate-800 leading-loose break-words whitespace-normal ${selectionMode ? 'pointer-events-none' : ''}`}>
                        {renderStudyTokens(item, props)}
                    </div>
                </div>
                <div className="pt-2 border-t border-slate-50">
                    <p className="text-slate-500 text-sm italic text-left">
                        {renderColoredTranslation(item, props)}
                    </p>
                    {!selectionMode && !reorderMode && (
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            {canSplit && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); props.onSplitPreview(item, canSplit); }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                                    title="Dividir em pedaços com poucas palavras novas"
                                >
                                    <Icon name="scissors" size={12} />
                                    Dividir frase
                                </button>
                            )}
                        </div>
                    )}
                    {!selectionMode && !reorderMode && (
                        <SentenceMicroQuiz
                            item={item}
                            savedWordsMap={props.savedWordsMap}
                            meaningPool={props.meaningPool}
                            completed={quizDone}
                            onCompleted={props.onQuizCompleted}
                            onResult={props.onResult}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudySentenceCard;
