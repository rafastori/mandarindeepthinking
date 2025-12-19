import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem, SupportedLanguage } from '../types';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { usePuterSpeech } from '../hooks/usePuterSpeech';

interface PronunciaViewProps {
    data: StudyItem[];
    savedIds: string[];
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

    // Levenshtein simplificado para strings curtas
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

const PronunciaView: React.FC<PronunciaViewProps> = ({ data, savedIds }) => {
    const { speak } = usePuterSpeech();
    const { isListening, isSupported, transcript, startListening, stopListening, resetTranscript } = useSpeechRecognition();

    const [mode, setMode] = useState<'frases' | 'palavras'>('frases');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [score, setScore] = useState(0);
    const [attempts, setAttempts] = useState(0);

    // Preparar dados baseado no modo
    const items = useMemo(() => {
        if (mode === 'frases') {
            // Frases da aba Leitura
            return data.map(item => ({
                id: item.id,
                text: item.chinese,
                translation: item.translation,
                language: item.language || 'zh' as SupportedLanguage
            }));
        } else {
            // Palavras favoritadas
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
            if (similarity >= 70) {
                setScore(prev => prev + 1);
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
        <div className="flex flex-col h-full p-4 pb-24">
            {/* Header com modo e score */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                    <button
                        onClick={() => { setMode('frases'); setCurrentIndex(0); resetTranscript(); setShowResult(false); }}
                        className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${mode === 'frases'
                                ? 'bg-brand-600 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        📖 Frases
                    </button>
                    <button
                        onClick={() => { setMode('palavras'); setCurrentIndex(0); resetTranscript(); setShowResult(false); }}
                        className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${mode === 'palavras'
                                ? 'bg-brand-600 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        ⭐ Palavras
                    </button>
                </div>
                <div className="text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                    ✅ {score}/{attempts}
                </div>
            </div>

            {/* Card Principal */}
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 w-full max-w-md text-center">
                    {/* Badge de idioma */}
                    <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase mb-4">
                        {currentItem?.language}
                    </span>

                    {/* Texto a pronunciar */}
                    <h2 className={`text-3xl font-bold text-slate-800 mb-4 ${currentItem?.language === 'zh' || currentItem?.language === 'ja'
                            ? 'font-chinese'
                            : 'font-sans'
                        }`}>
                        {currentItem?.text}
                    </h2>

                    {/* Tradução */}
                    <p className="text-slate-500 text-sm mb-6 italic">
                        {currentItem?.translation}
                    </p>

                    {/* Botão Ouvir */}
                    <button
                        onClick={handleListen}
                        className="mb-6 flex items-center gap-2 mx-auto px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-semibold hover:bg-blue-100 transition-colors"
                    >
                        <Icon name="volume-2" size={20} />
                        Ouvir pronúncia
                    </button>

                    {/* Área de Resultado */}
                    {showResult && transcript && (
                        <div className={`p-4 rounded-xl mb-4 ${similarity >= 70
                                ? 'bg-emerald-50 border border-emerald-200'
                                : 'bg-orange-50 border border-orange-200'
                            }`}>
                            <p className="text-sm font-semibold mb-1">Você disse:</p>
                            <p className={`text-lg font-bold ${similarity >= 70 ? 'text-emerald-700' : 'text-orange-700'
                                }`}>
                                "{transcript}"
                            </p>
                            <div className="mt-2 flex items-center justify-center gap-2">
                                <div className={`text-2xl ${similarity >= 70 ? 'text-emerald-600' : 'text-orange-600'}`}>
                                    {similarity >= 70 ? '✅' : '🔄'}
                                </div>
                                <span className="font-bold text-slate-700">{similarity}% similar</span>
                            </div>
                        </div>
                    )}

                    {/* Botão Gravar */}
                    <button
                        onClick={handleRecord}
                        className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${isListening
                                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
                                : 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-md hover:shadow-lg'
                            }`}
                    >
                        {isListening ? (
                            <span className="flex items-center justify-center gap-2">
                                <Icon name="mic" size={24} />
                                Gravando... (Toque para parar)
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <Icon name="mic" size={24} />
                                🎤 Iniciar Gravação
                            </span>
                        )}
                    </button>
                </div>

                {/* Navegação */}
                <div className="flex items-center gap-4 mt-6">
                    <button
                        onClick={handlePrev}
                        className="p-3 bg-white rounded-full shadow-md hover:shadow-lg transition-all"
                    >
                        ←
                    </button>
                    <span className="text-slate-600 font-semibold">
                        {currentIndex + 1} / {items.length}
                    </span>
                    <button
                        onClick={handleNext}
                        className="p-3 bg-white rounded-full shadow-md hover:shadow-lg transition-all"
                    >
                        →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PronunciaView;
