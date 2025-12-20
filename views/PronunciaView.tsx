import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem, SupportedLanguage } from '../types';
import { usePuterSpeech } from '../hooks/usePuterSpeech';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { pinyin } from 'pinyin-pro';

interface PronunciaViewProps {
    data: StudyItem[];
    savedIds: string[];
    onResult?: (isCorrect: boolean, word: string, type: 'pronunciation') => void;
}

interface MissedWord {
    text: string;
    spoken: string;
    similarity: number;
    language: SupportedLanguage;
}

interface PracticeItem {
    id: string;
    text: string;
    pinyin: string;
    translation: string;
    language: SupportedLanguage;
}

// Converte hanzi para pinyin sem tons usando pinyin-pro
const hanziToPinyin = (text: string): string => {
    try {
        return pinyin(text, { toneType: 'none', type: 'string' }).replace(/\s+/g, '').toLowerCase();
    } catch {
        return text.toLowerCase();
    }
};

// Remove tons do pinyin (números 1-5) e normaliza
const normalizePinyin = (pinyinText: string): string => {
    return pinyinText
        .toLowerCase()
        .replace(/[1-5]/g, '')
        .replace(/[.,!?;:'"()，。！？、；：""''（）\-]/g, '')
        .replace(/\s+/g, '')
        .trim();
};

// Normaliza texto para comparação geral
const normalizeText = (text: string): string => {
    return text
        .toLowerCase()
        .replace(/[.,!?;:'"()，。！？、；：""''（）\-]/g, '')
        .replace(/\s+/g, '')
        .trim();
};

// Calcula similaridade entre duas strings (Levenshtein)
const calculateSimilarity = (str1: string, str2: string): number => {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 100;

    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 100;

    const matrix: number[][] = [];
    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    const distance = matrix[len1][len2];
    return Math.round(((maxLen - distance) / maxLen) * 100);
};

// Verifica se é idioma CJK
const isCJKLanguage = (lang: SupportedLanguage): boolean => {
    return ['zh', 'ja', 'ko'].includes(lang);
};

// Verifica se contém caracteres CJK
const containsCJKCharacters = (text: string): boolean => {
    return /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(text);
};

const PronunciaView: React.FC<PronunciaViewProps> = ({ data, savedIds, onResult }) => {
    const { speak } = usePuterSpeech();
    const {
        isListening,
        isProcessing,
        isSupported,
        transcript,
        error,
        isModelLoading,
        modelProgress,
        startListening,
        stopListening,
        resetTranscript
    } = useSpeechRecognition();

    const [mode, setMode] = useState<'frases' | 'palavras'>('frases');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [score, setScore] = useState(0);
    const [attempts, setAttempts] = useState(0);
    const [missedWords, setMissedWords] = useState<MissedWord[]>([]);
    const [hasSaved, setHasSaved] = useState(false);
    const [lastTranscript, setLastTranscript] = useState('');
    const [lastSimilarity, setLastSimilarity] = useState(0);
    const [comparisonInfo, setComparisonInfo] = useState('');

    // Preparar dados baseado no modo
    const items: PracticeItem[] = useMemo(() => {
        if (mode === 'frases') {
            return data.map(item => ({
                id: item.id.toString(),
                text: item.chinese,
                pinyin: item.pinyin || '',
                translation: item.translation,
                language: (item.language || 'zh') as SupportedLanguage
            }));
        } else {
            const words: PracticeItem[] = [];
            data.forEach(item => {
                const itemId = item.id.toString();
                if (savedIds.includes(itemId)) {
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
    }, [data, savedIds, mode]);

    const currentItem = items[currentIndex];

    // Calcula similaridade - converte hanzi→pinyin se necessário
    const computeSimilarity = useCallback((item: PracticeItem, spoken: string): { similarity: number; info: string } => {
        if (!item) return { similarity: 0, info: '' };

        if (isCJKLanguage(item.language)) {
            const expectedPinyin = item.pinyin ? normalizePinyin(item.pinyin) : hanziToPinyin(item.text);
            const spokenPinyin = containsCJKCharacters(spoken) ? hanziToPinyin(spoken) : normalizeText(spoken);
            const similarity = calculateSimilarity(expectedPinyin, spokenPinyin);
            return {
                similarity,
                info: `${expectedPinyin} vs ${spokenPinyin}`
            };
        }

        const normalizedText = normalizeText(item.text);
        const normalizedSpoken = normalizeText(spoken);
        const similarity = calculateSimilarity(normalizedText, normalizedSpoken);
        return { similarity, info: `${normalizedText} vs ${normalizedSpoken}` };
    }, []);

    const handleListen = () => {
        if (!currentItem) return;
        speak(currentItem.text, currentItem.language);
    };

    const startRecording = useCallback(() => {
        if (!isSupported || !currentItem) return;

        resetTranscript();
        startListening(currentItem.language, currentItem.text);
        setShowResult(false);
        setLastTranscript('');
        setLastSimilarity(0);
        setComparisonInfo('');
    }, [isSupported, currentItem, startListening, resetTranscript]);

    const stopRecording = useCallback(() => {
        stopListening();
    }, [stopListening]);

    // Efeito para processar o resultado quando o reconhecimento para
    useEffect(() => {
        if (!isListening && transcript && !showResult) {
            const result = computeSimilarity(currentItem, transcript);

            setLastTranscript(transcript);
            setLastSimilarity(result.similarity);
            setComparisonInfo(result.info);
            setShowResult(true);
            setAttempts(prev => prev + 1);

            if (result.similarity >= 70) {
                setScore(prev => prev + 1);
            } else {
                setMissedWords(prev => {
                    const exists = prev.some(w => w.text === currentItem.text);
                    if (exists) return prev;
                    return [...prev, {
                        text: currentItem.text,
                        spoken: transcript,
                        similarity: result.similarity,
                        language: currentItem.language
                    }];
                });
            }
        }
    }, [isListening, transcript, currentItem, computeSimilarity, showResult]);

    const handleRecord = () => {
        if (isListening) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const handleNext = () => {
        setCurrentIndex(prev => (prev + 1) % items.length);
        setShowResult(false);
        setLastTranscript('');
        setLastSimilarity(0);
        setComparisonInfo('');
        resetTranscript();
    };

    const handlePrev = () => {
        setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
        setShowResult(false);
        setLastTranscript('');
        setLastSimilarity(0);
        setComparisonInfo('');
        resetTranscript();
    };

    const handleSaveProgress = () => {
        if (!onResult || hasSaved) return;
        missedWords.forEach(word => onResult(false, word.text, 'pronunciation'));
        for (let i = 0; i < score; i++) onResult(true, 'pronúncia', 'pronunciation');
        setHasSaved(true);
    };

    const handleReset = () => {
        setScore(0);
        setAttempts(0);
        setMissedWords([]);
        setHasSaved(false);
        setCurrentIndex(0);
        setShowResult(false);
        setLastTranscript('');
        setLastSimilarity(0);
        setComparisonInfo('');
        resetTranscript();
    };

    const handleRemoveMissed = (text: string) => {
        setMissedWords(prev => prev.filter(w => w.text !== text));
    };

    if (!isSupported) {
        return (
            <div className="p-6 text-center">
                <div className="bg-red-50 text-red-700 p-4 rounded-xl">
                    <Icon name="x" size={32} className="mx-auto mb-2" />
                    <p className="font-semibold">Seu navegador não suporta reconhecimento de fala.</p>
                    <p className="text-sm mt-2">Use Chrome, Edge ou Safari.</p>
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return <EmptyState msg={mode === 'frases' ? "Importe textos na aba Leitura." : "Salve palavras para praticar."} icon="mic" />;
    }

    return (
        <div className="flex flex-col h-full p-4 pb-24 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                    <button
                        onClick={() => { setMode('frases'); setCurrentIndex(0); setShowResult(false); }}
                        className={`px-3 py-1.5 rounded-xl font-semibold text-sm transition-all ${mode === 'frases' ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        📖 Frases
                    </button>
                    <button
                        onClick={() => { setMode('palavras'); setCurrentIndex(0); setShowResult(false); }}
                        className={`px-3 py-1.5 rounded-xl font-semibold text-sm transition-all ${mode === 'palavras' ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        ⭐ Palavras
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <div className={`text-sm font-bold px-3 py-1.5 rounded-lg ${attempts > 0 && score / attempts >= 0.7 ? 'bg-emerald-100 text-emerald-700'
                        : attempts > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                        ✅ {score}/{attempts}
                    </div>

                    {attempts > 0 && onResult && (
                        <button onClick={handleSaveProgress} disabled={hasSaved}
                            className={`p-2 rounded-lg transition-all ${hasSaved ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                            title={hasSaved ? "Salvo!" : "Salvar"}>
                            <Icon name={hasSaved ? "check-circle" : "save"} size={20} />
                        </button>
                    )}

                    {attempts > 0 && (
                        <button onClick={handleReset} className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200" title="Reset">
                            <Icon name="refresh-cw" size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Card Principal */}
            <div className="flex flex-col items-center">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 w-full max-w-md text-center">
                    <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase mb-3">
                        {currentItem?.language}
                    </span>

                    <h2 className={`text-2xl font-bold text-slate-800 mb-2 ${currentItem?.language === 'zh' || currentItem?.language === 'ja' ? 'font-chinese' : ''}`}>
                        {currentItem?.text}
                    </h2>

                    {isCJKLanguage(currentItem?.language) && currentItem?.pinyin && (
                        <p className="text-brand-600 text-sm font-medium mb-2">{currentItem.pinyin}</p>
                    )}

                    <p className="text-slate-500 text-sm mb-4 italic">{currentItem?.translation}</p>

                    <button onClick={handleListen} className="mb-4 flex items-center gap-2 mx-auto px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-semibold hover:bg-blue-100">
                        <Icon name="volume-2" size={18} /> Ouvir
                    </button>

                    {showResult && lastTranscript && (
                        <div className={`p-3 rounded-xl mb-4 ${lastSimilarity >= 70 ? 'bg-emerald-50 border border-emerald-200' : 'bg-orange-50 border border-orange-200'}`}>
                            <p className="text-xs font-semibold mb-1 text-slate-500">Você disse:</p>
                            <p className={`text-base font-bold ${lastSimilarity >= 70 ? 'text-emerald-700' : 'text-orange-700'}`}>"{lastTranscript}"</p>
                            {comparisonInfo && <p className="text-xs text-slate-400 mt-1">Comparação: {comparisonInfo}</p>}
                            <div className="mt-1 flex items-center justify-center gap-2">
                                <span className="text-lg">{lastSimilarity >= 70 ? '✅' : '🔄'}</span>
                                <span className="font-bold text-slate-700 text-sm">{lastSimilarity}%</span>
                            </div>
                        </div>
                    )}

                    <button onClick={handleRecord}
                        disabled={isProcessing}
                        className={`w-full py-3 rounded-xl font-bold text-base transition-all ${isListening ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200' : isProcessing ? 'bg-slate-200 text-slate-500 cursor-wait' : 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-md hover:shadow-lg'}`}>
                        <span className="flex items-center justify-center gap-2">
                            <Icon name={isListening ? "mic" : isProcessing ? "refresh-cw" : "mic"} size={20} className={isProcessing ? 'animate-spin' : ''} />
                            {isListening ? 'Gravando... (Toque para parar)' : isProcessing ? 'Aguardando conferência...' : '🎤 Gravar'}
                        </span>
                    </button>

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[10px] sm:text-xs flex items-center gap-2 text-left">
                            <Icon name="x" size={14} className="flex-shrink-0" />
                            <span>Erro: {error}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 mt-4">
                    <button onClick={handlePrev} className="p-2 bg-white rounded-full shadow-md hover:shadow-lg">←</button>
                    <span className="text-slate-600 font-semibold text-sm">{currentIndex + 1} / {items.length}</span>
                    <button onClick={handleNext} className="p-2 bg-white rounded-full shadow-md hover:shadow-lg">→</button>
                </div>

                {isModelLoading && !isNaN(modelProgress) && (
                    <div className="mt-6 w-full max-w-sm px-4">
                        <div className="flex justify-between mb-2">
                            <span className="text-xs font-bold text-brand-600 animate-pulse">Iniciando motor Whisper Local...</span>
                            <span className="text-xs font-bold text-brand-700">{Math.round(modelProgress)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                            <div
                                className="bg-gradient-to-r from-brand-400 to-brand-600 h-full rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${modelProgress}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 text-center">Isso acontece apenas na primeira vez (~77MB)</p>
                    </div>
                )}
            </div>

            {/* Lista de erros */}
            {missedWords.length > 0 && (
                <div className="mt-6 bg-orange-50 rounded-xl p-4 border border-orange-200">
                    <h3 className="font-bold text-orange-700 text-sm mb-3 flex items-center gap-2">
                        <Icon name="alert-circle" size={16} /> Revisar ({missedWords.length})
                    </h3>
                    <div className="space-y-2">
                        {missedWords.map((word, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-orange-100">
                                <div className="flex-1">
                                    <span className={`font-bold text-slate-800 ${word.language === 'zh' || word.language === 'ja' ? 'font-chinese' : ''}`}>
                                        {word.text}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase ml-2">{word.language}</span>
                                    <p className="text-xs text-slate-500 mt-0.5">Você: "{word.spoken}" ({word.similarity}%)</p>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => speak(word.text, word.language)} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50">
                                        <Icon name="volume-2" size={16} />
                                    </button>
                                    <button onClick={() => handleRemoveMissed(word.text)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50">
                                        <Icon name="x" size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PronunciaView;
