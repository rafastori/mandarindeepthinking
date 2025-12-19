import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem, SupportedLanguage } from '../types';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { usePuterSpeech } from '../hooks/usePuterSpeech';

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

// Função para normalizar texto para comparação
const normalizeText = (text: string): string => {
    return text
        .toLowerCase()
        .replace(/[.,!?;:'"()，。！？、；：""''（）]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

// Função para calcular similaridade entre textos
const calculateSimilarity = (original: string, spoken: string): number => {
    const norm1 = normalizeText(original);
    const norm2 = normalizeText(spoken);

    if (norm1 === norm2) return 100;
    if (!norm2) return 0;

    const len1 = norm1.length;
    const len2 = norm2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 100;

    let matches = 0;
    const minLen = Math.min(len1, len2);

    for (let i = 0; i < minLen; i++) {
        if (norm1[i] === norm2[i]) matches++;
    }

    return Math.round((matches / maxLen) * 100);
};

const PronunciaView: React.FC<PronunciaViewProps> = ({ data, savedIds, onResult }) => {
    const { speak } = usePuterSpeech();
    const { isListening, isSupported, transcript, startListening, stopListening, resetTranscript } = useSpeechRecognition();

    const [mode, setMode] = useState<'frases' | 'palavras'>('frases');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [score, setScore] = useState(0);
    const [attempts, setAttempts] = useState(0);
    const [missedWords, setMissedWords] = useState<MissedWord[]>([]);
    const [hasSaved, setHasSaved] = useState(false);

    // Preparar dados baseado no modo
    const items = useMemo(() => {
        if (mode === 'frases') {
            return data.map(item => ({
                id: item.id,
                text: item.chinese,
                translation: item.translation,
                language: item.language || 'zh' as SupportedLanguage
            }));
        } else {
            const words: { id: string; text: string; translation: string; language: SupportedLanguage }[] = [];
            data.forEach(item => {
                if (savedIds.includes(item.id.toString())) {
                    words.push({
                        id: item.id.toString(),
                        text: item.chinese,
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
    const similarity = transcript ? calculateSimilarity(currentItem?.text || '', transcript) : 0;

    const handleListen = () => {
        if (!currentItem) return;
        speak(currentItem.text, currentItem.language);
    };

    const handleRecord = () => {
        if (!currentItem) return;

        if (isListening) {
            stopListening();
            setShowResult(true);
            setAttempts(prev => prev + 1);

            const currentSimilarity = calculateSimilarity(currentItem.text, transcript);

            if (currentSimilarity >= 70) {
                setScore(prev => prev + 1);
            } else if (transcript) {
                // Adicionar à lista de erros
                setMissedWords(prev => {
                    // Evitar duplicatas
                    const exists = prev.some(w => w.text === currentItem.text);
                    if (exists) return prev;
                    return [...prev, {
                        text: currentItem.text,
                        spoken: transcript,
                        similarity: currentSimilarity,
                        language: currentItem.language
                    }];
                });
            }
        } else {
            resetTranscript();
            setShowResult(false);
            startListening(currentItem.language);
        }
    };

    const handleNext = () => {
        setCurrentIndex(prev => (prev + 1) % items.length);
        resetTranscript();
        setShowResult(false);
    };

    const handlePrev = () => {
        setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
        resetTranscript();
        setShowResult(false);
    };

    const handleSaveProgress = () => {
        if (!onResult || hasSaved) return;

        // Salvar erros nas estatísticas
        missedWords.forEach(word => {
            onResult(false, word.text, 'pronunciation');
        });

        // Salvar acertos (score vezes)
        for (let i = 0; i < score; i++) {
            onResult(true, 'pronúncia', 'pronunciation');
        }

        setHasSaved(true);
    };

    const handleReset = () => {
        setScore(0);
        setAttempts(0);
        setMissedWords([]);
        setHasSaved(false);
        setCurrentIndex(0);
        resetTranscript();
        setShowResult(false);
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
                    <p className="text-sm mt-2">Use Chrome, Edge ou Safari para esta funcionalidade.</p>
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return <EmptyState msg={mode === 'frases' ? "Importe textos na aba Leitura para praticar." : "Salve palavras para praticar pronúncia."} icon="mic" />;
    }

    return (
        <div className="flex flex-col h-full p-4 pb-24 overflow-y-auto">
            {/* Header com modo e score */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                    <button
                        onClick={() => { setMode('frases'); setCurrentIndex(0); resetTranscript(); setShowResult(false); }}
                        className={`px-3 py-1.5 rounded-xl font-semibold text-sm transition-all ${mode === 'frases'
                            ? 'bg-brand-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        📖 Frases
                    </button>
                    <button
                        onClick={() => { setMode('palavras'); setCurrentIndex(0); resetTranscript(); setShowResult(false); }}
                        className={`px-3 py-1.5 rounded-xl font-semibold text-sm transition-all ${mode === 'palavras'
                            ? 'bg-brand-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        ⭐ Palavras
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Score */}
                    <div className={`text-sm font-bold px-3 py-1.5 rounded-lg ${attempts > 0 && score / attempts >= 0.7
                            ? 'bg-emerald-100 text-emerald-700'
                            : attempts > 0
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-slate-100 text-slate-600'
                        }`}>
                        ✅ {score}/{attempts}
                    </div>

                    {/* Botão Salvar */}
                    {attempts > 0 && onResult && (
                        <button
                            onClick={handleSaveProgress}
                            disabled={hasSaved}
                            className={`p-2 rounded-lg transition-all ${hasSaved
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                }`}
                            title={hasSaved ? "Progresso salvo!" : "Salvar nas estatísticas"}
                        >
                            <Icon name={hasSaved ? "check-circle" : "save"} size={20} />
                        </button>
                    )}

                    {/* Botão Reset */}
                    {attempts > 0 && (
                        <button
                            onClick={handleReset}
                            className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                            title="Recomeçar"
                        >
                            <Icon name="refresh-cw" size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Card Principal */}
            <div className="flex flex-col items-center">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 w-full max-w-md text-center">
                    {/* Badge de idioma */}
                    <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase mb-3">
                        {currentItem?.language}
                    </span>

                    {/* Texto a pronunciar */}
                    <h2 className={`text-2xl font-bold text-slate-800 mb-3 ${currentItem?.language === 'zh' || currentItem?.language === 'ja'
                        ? 'font-chinese'
                        : 'font-sans'
                        }`}>
                        {currentItem?.text}
                    </h2>

                    {/* Tradução */}
                    <p className="text-slate-500 text-sm mb-4 italic">
                        {currentItem?.translation}
                    </p>

                    {/* Botão Ouvir */}
                    <button
                        onClick={handleListen}
                        className="mb-4 flex items-center gap-2 mx-auto px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-semibold hover:bg-blue-100 transition-colors"
                    >
                        <Icon name="volume-2" size={18} />
                        Ouvir
                    </button>

                    {/* Área de Resultado */}
                    {showResult && transcript && (
                        <div className={`p-3 rounded-xl mb-4 ${similarity >= 70
                            ? 'bg-emerald-50 border border-emerald-200'
                            : 'bg-orange-50 border border-orange-200'
                            }`}>
                            <p className="text-xs font-semibold mb-1 text-slate-500">Você disse:</p>
                            <p className={`text-base font-bold ${similarity >= 70 ? 'text-emerald-700' : 'text-orange-700'
                                }`}>
                                "{transcript}"
                            </p>
                            <div className="mt-1 flex items-center justify-center gap-2">
                                <span className="text-lg">{similarity >= 70 ? '✅' : '🔄'}</span>
                                <span className="font-bold text-slate-700 text-sm">{similarity}%</span>
                            </div>
                        </div>
                    )}

                    {/* Botão Gravar */}
                    <button
                        onClick={handleRecord}
                        className={`w-full py-3 rounded-xl font-bold text-base transition-all ${isListening
                            ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
                            : 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-md hover:shadow-lg'
                            }`}
                    >
                        {isListening ? (
                            <span className="flex items-center justify-center gap-2">
                                <Icon name="mic" size={20} />
                                Gravando... (Toque para parar)
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <Icon name="mic" size={20} />
                                🎤 Gravar
                            </span>
                        )}
                    </button>
                </div>

                {/* Navegação */}
                <div className="flex items-center gap-4 mt-4">
                    <button
                        onClick={handlePrev}
                        className="p-2 bg-white rounded-full shadow-md hover:shadow-lg transition-all"
                    >
                        ←
                    </button>
                    <span className="text-slate-600 font-semibold text-sm">
                        {currentIndex + 1} / {items.length}
                    </span>
                    <button
                        onClick={handleNext}
                        className="p-2 bg-white rounded-full shadow-md hover:shadow-lg transition-all"
                    >
                        →
                    </button>
                </div>
            </div>

            {/* Lista de Palavras Erradas */}
            {missedWords.length > 0 && (
                <div className="mt-6 bg-orange-50 rounded-xl p-4 border border-orange-200">
                    <h3 className="font-bold text-orange-700 text-sm mb-3 flex items-center gap-2">
                        <Icon name="alert-circle" size={16} />
                        Palavras para revisar ({missedWords.length})
                    </h3>
                    <div className="space-y-2">
                        {missedWords.map((word, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-orange-100">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold text-slate-800 ${word.language === 'zh' || word.language === 'ja' ? 'font-chinese' : ''
                                            }`}>
                                            {word.text}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{word.language}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Você disse: <span className="italic">"{word.spoken}"</span> ({word.similarity}%)
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => speak(word.text, word.language)}
                                        className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                                        title="Ouvir"
                                    >
                                        <Icon name="volume-2" size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleRemoveMissed(word.text)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        title="Remover"
                                    >
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
