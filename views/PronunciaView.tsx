import React, { useState, useMemo, useCallback } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import AudioVisualizer from '../components/AudioVisualizer';
import { StudyItem, SupportedLanguage } from '../types';
import { usePuterSpeech } from '../hooks/usePuterSpeech';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface PronunciaViewProps {
    data: StudyItem[];
    savedIds: string[];
    onResult?: (isCorrect: boolean, word: string, type: 'pronunciation') => void;
    activeFolderFilters?: string[];
}

interface PracticeItem {
    id: string;
    text: string;
    pinyin: string;
    translation: string;
    language: SupportedLanguage;
}

// Verifica se é idioma CJK
const isCJKLanguage = (lang: SupportedLanguage): boolean => {
    return ['zh', 'ja', 'ko'].includes(lang);
};

const PronunciaView: React.FC<PronunciaViewProps> = ({ data, savedIds, onResult, activeFolderFilters = [] }) => {
    const { speak } = usePuterSpeech();
    const {
        isRecording,
        recordingTime,
        audioUrl,
        analyserNode,
        startRecording,
        stopRecording,
        resetRecording,
        error: recorderError
    } = useAudioRecorder();

    // Speech recognition (secondary feature)
    const {
        isListening: isRecognizing,
        isProcessing,
        transcript,
        error: recognitionError,
        isModelLoading,
        modelProgress,
        startListening,
        stopListening,
        resetTranscript
    } = useSpeechRecognition();

    const [mode, setMode] = useState<'frases' | 'palavras'>('frases');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showAICheck, setShowAICheck] = useState(false);
    const [selfEvaluation, setSelfEvaluation] = useState<'correct' | 'wrong' | null>(null);

    // Preparar dados baseado no modo
    const items: PracticeItem[] = useMemo(() => {
        const clean = (text: string) => text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'´]/g, "").trim();
        const allowedWords = new Set<string>();

        if (activeFolderFilters.length > 0) {
            data.forEach(item => {
                if (item.type !== 'word') {
                    const inFolder = activeFolderFilters.some(filterPath => {
                        if (filterPath === '__uncategorized__' && !item.folderPath) return true;
                        return item.folderPath === filterPath;
                    });

                    if (inFolder) {
                        item.tokens?.forEach(t => allowedWords.add(clean(t)));
                        item.keywords?.forEach(k => allowedWords.add(clean(k.word)));
                    }
                }
            });
        }

        const filteredData = activeFolderFilters.length === 0 ? data : data.filter(item => {
            const explicitMatch = activeFolderFilters.some(filterPath => {
                if (filterPath === '__uncategorized__' && !item.folderPath) return true;
                return item.folderPath === filterPath;
            });

            if (explicitMatch) return true;
            if (item.type === 'word' && allowedWords.has(clean(item.chinese))) return true;
            return false;
        });

        if (mode === 'frases') {
            return filteredData.filter(item => item.type !== 'word').map(item => ({
                id: item.id.toString(),
                text: item.chinese,
                pinyin: item.pinyin || '',
                translation: item.translation,
                language: (item.language || 'zh') as SupportedLanguage
            }));
        } else {
            const words: PracticeItem[] = [];
            filteredData.forEach(item => {
                const itemId = item.id.toString();
                if (savedIds.includes(itemId) && item.type === 'word') {
                    words.push({
                        id: itemId,
                        text: item.chinese,
                        pinyin: item.pinyin || '',
                        translation: item.translation,
                        language: (item.language || 'zh') as SupportedLanguage
                    });
                }
                if (item.keywords) {
                    item.keywords.forEach(k => {
                        if (savedIds.includes(k.id)) {
                            words.push({
                                id: k.id,
                                text: k.word,
                                pinyin: k.pinyin || '',
                                translation: k.meaning,
                                language: (k.language || item.language || 'zh') as SupportedLanguage
                            });
                        }
                    });
                }
            });
            return words;
        }
    }, [data, savedIds, mode, activeFolderFilters]);

    const currentItem = items[currentIndex];

    const handleListen = useCallback(() => {
        if (!currentItem) return;
        speak(currentItem.text, currentItem.language);
    }, [currentItem, speak]);

    const handleRecord = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            resetRecording();
            setSelfEvaluation(null);
            setShowAICheck(false);
            resetTranscript();
            startRecording();
        }
    }, [isRecording, stopRecording, resetRecording, startRecording, resetTranscript]);

    const handleNext = () => {
        setCurrentIndex(prev => (prev + 1) % items.length);
        resetRecording();
        setSelfEvaluation(null);
        setShowAICheck(false);
        resetTranscript();
    };

    const handlePrev = () => {
        setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
        resetRecording();
        setSelfEvaluation(null);
        setShowAICheck(false);
        resetTranscript();
    };

    const handleSelfEvaluate = (correct: boolean) => {
        setSelfEvaluation(correct ? 'correct' : 'wrong');
        if (onResult) {
            onResult(correct, currentItem.text, 'pronunciation');
        }
    };

    const handleAICheck = useCallback(() => {
        if (!currentItem) return;
        setShowAICheck(true);
        resetTranscript();
        startListening(currentItem.language, currentItem.text);
    }, [currentItem, startListening, resetTranscript]);

    const handleStopAICheck = useCallback(() => {
        stopListening();
    }, [stopListening]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (items.length === 0) {
        return <EmptyState msg={mode === 'frases' ? "Importe textos na aba Leitura." : "Salve palavras para praticar."} icon="mic" />;
    }

    return (
        <div className="flex flex-col h-full p-4 pb-24 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                    <button
                        onClick={() => { setMode('frases'); setCurrentIndex(0); resetRecording(); }}
                        className={`px-3 py-1.5 rounded-xl font-semibold text-sm transition-all ${mode === 'frases' ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        📖 Frases
                    </button>
                    <button
                        onClick={() => { setMode('palavras'); setCurrentIndex(0); resetRecording(); }}
                        className={`px-3 py-1.5 rounded-xl font-semibold text-sm transition-all ${mode === 'palavras' ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        ⭐ Palavras
                    </button>
                </div>
                <span className="text-sm text-slate-400 font-medium">
                    {currentIndex + 1} / {items.length}
                </span>
            </div>

            {/* Card Principal */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 w-full max-w-md mx-auto">
                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase mb-3">
                    {currentItem?.language}
                </span>

                <h2 className={`text-2xl font-bold text-slate-800 mb-2 text-center ${isCJKLanguage(currentItem?.language) ? 'font-chinese' : ''}`}>
                    {currentItem?.text}
                </h2>

                {isCJKLanguage(currentItem?.language) && currentItem?.pinyin && (
                    <p className="text-brand-600 text-sm font-medium mb-2 text-center">{currentItem.pinyin}</p>
                )}

                <p className="text-slate-500 text-sm mb-6 italic text-center">{currentItem?.translation}</p>

                {/* Two-Column Layout: Listen vs Record */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Listen Column */}
                    <div className="flex flex-col items-center">
                        <p className="text-xs font-semibold text-slate-400 mb-2 uppercase">Referência</p>
                        <button
                            onClick={handleListen}
                            className="w-16 h-16 rounded-full flex items-center justify-center transition-all bg-blue-100 text-blue-600 hover:bg-blue-200 active:bg-blue-500 active:text-white"
                        >
                            <Icon name="volume-2" size={28} />
                        </button>
                        <p className="text-xs text-slate-400 mt-2">Ouvir</p>
                    </div>

                    {/* Record Column */}
                    <div className="flex flex-col items-center">
                        <p className="text-xs font-semibold text-slate-400 mb-2 uppercase">Sua Voz</p>
                        <button
                            onClick={handleRecord}
                            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isRecording
                                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
                                : 'bg-gradient-to-br from-brand-500 to-brand-600 text-white hover:shadow-lg'
                                }`}
                        >
                            <Icon name="mic" size={28} />
                        </button>
                        <p className="text-xs text-slate-400 mt-2">
                            {isRecording ? formatTime(recordingTime) : 'Gravar'}
                        </p>
                    </div>
                </div>

                {/* Visualizer - shown during recording */}
                {isRecording && (
                    <div className="mb-4">
                        <AudioVisualizer
                            analyserNode={analyserNode}
                            isActive={isRecording}
                            width={300}
                            height={50}
                            barColor="#22c55e"
                            backgroundColor="#f1f5f9"
                        />
                    </div>
                )}

                {/* Playback - shown after recording */}
                {audioUrl && !isRecording && (
                    <div className="bg-slate-50 rounded-xl p-4 mb-4">
                        <p className="text-xs font-semibold text-slate-500 mb-2">Sua gravação:</p>
                        <audio src={audioUrl} controls className="w-full" />

                        {/* Self Evaluation Buttons */}
                        {!selfEvaluation && (
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={() => handleSelfEvaluate(true)}
                                    className="flex-1 py-2 rounded-lg bg-emerald-100 text-emerald-700 font-semibold hover:bg-emerald-200 transition-all"
                                >
                                    ✅ Acertei
                                </button>
                                <button
                                    onClick={() => handleSelfEvaluate(false)}
                                    className="flex-1 py-2 rounded-lg bg-orange-100 text-orange-700 font-semibold hover:bg-orange-200 transition-all"
                                >
                                    🔄 Tentar de novo
                                </button>
                            </div>
                        )}

                        {selfEvaluation && (
                            <div className={`mt-3 p-2 rounded-lg text-center font-semibold ${selfEvaluation === 'correct' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                {selfEvaluation === 'correct' ? '✅ Ótimo trabalho!' : '🔄 Continue praticando!'}
                            </div>
                        )}
                    </div>
                )}

                {/* Secondary: AI Check */}
                {audioUrl && !isRecording && (
                    <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs text-slate-400 mb-2 text-center">Opcional: Verificar com IA</p>
                        <button
                            onClick={isRecognizing ? handleStopAICheck : handleAICheck}
                            disabled={isProcessing}
                            className={`w-full py-2 rounded-xl font-semibold text-sm transition-all ${isRecognizing
                                ? 'bg-purple-500 text-white animate-pulse'
                                : isProcessing
                                    ? 'bg-slate-200 text-slate-500 cursor-wait'
                                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                }`}
                        >
                            {isRecognizing ? '🎤 Gravando para IA...' : isProcessing ? '⏳ Processando...' : '🤖 Verificar Pronúncia'}
                        </button>

                        {/* AI Result */}
                        {showAICheck && transcript && !isRecognizing && !isProcessing && (
                            <div className="mt-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
                                <p className="text-xs font-semibold text-purple-600 mb-1">IA entendeu:</p>
                                <p className="text-sm font-medium text-purple-800">"{transcript}"</p>
                            </div>
                        )}

                        {/* Model Loading Progress */}
                        {isModelLoading && !isNaN(modelProgress) && (
                            <div className="mt-3">
                                <div className="flex justify-between mb-1">
                                    <span className="text-xs text-purple-600">Carregando modelo...</span>
                                    <span className="text-xs font-bold text-purple-700">{Math.round(modelProgress)}%</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-1.5">
                                    <div
                                        className="bg-purple-500 h-full rounded-full transition-all"
                                        style={{ width: `${modelProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Errors */}
                {(recorderError || recognitionError) && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs">
                        <Icon name="alert-circle" size={14} className="inline mr-1" />
                        {recorderError || recognitionError}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4 mt-4">
                <button onClick={handlePrev} className="p-3 bg-white rounded-full shadow-md hover:shadow-lg transition-all">
                    <Icon name="arrow-left" size={20} className="text-slate-600" />
                </button>
                <button onClick={handleNext} className="p-3 bg-white rounded-full shadow-md hover:shadow-lg transition-all rotate-180">
                    <Icon name="arrow-left" size={20} className="text-slate-600" />
                </button>
            </div>
        </div>
    );
};

export default PronunciaView;
