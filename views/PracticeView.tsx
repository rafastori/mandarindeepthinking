import React, { useState, useMemo, useRef, useEffect } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem, Keyword } from '../types';
import { usePuterSpeech } from '../hooks/usePuterSpeech';
import { Star } from 'lucide-react';

interface PracticeViewProps {
    data: StudyItem[];
    savedIds: string[];
    onResult: (correct: boolean, word: string) => void;
    activeFolderFilters?: string[];
    studyMoreIds?: string[];
    onToggleStudyMore?: (wordId: string) => void;
    showOnlyErrors?: boolean;
    wordCounts?: Record<string, any>;
}

const PracticeView: React.FC<PracticeViewProps> = ({ data, savedIds, onResult, activeFolderFilters = [], studyMoreIds = [], onToggleStudyMore, showOnlyErrors = false, wordCounts = {} }) => {
    const { speak, stop, playingId } = usePuterSpeech();

    // Estados do Jogo
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [sessionKey, setSessionKey] = useState(0); // Usado para forçar o re-embaralhamento
    const [invertPractice, setInvertPractice] = useState(false); // Estado para inverter (PT -> ZH)

    // Ref para armazenar snapshot estável dos dados (evita re-render causar re-shuffle)
    const dataSnapshotRef = useRef<{ data: StudyItem[]; savedIds: string[] } | null>(null);

    useEffect(() => {
        dataSnapshotRef.current = { data, savedIds };
    }, [data, savedIds]); // Mantém sempre atualizado quando dados mudam

    // Função para limpar pontuação (mesma do ReadingView)
    const cleanPunctuation = (text: string) => text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'´。，！？；：）】」』、]/g, "").trim();

    // Chave estável para filtros (evita re-shuffle quando stats mudam)
    const filtersKey = useMemo(() => activeFolderFilters.sort().join(','), [activeFolderFilters]);

    // Mapa de palavras salvas - MESMA LÓGICA DO ReadingView
    const savedWordsMap = useMemo(() => {
        const snapshot = dataSnapshotRef.current || { data, savedIds };
        const currentData = snapshot.data;
        const currentSavedIds = snapshot.savedIds;

        // 1. Identifica palavras permitidas (que aparecem nos textos das pastas selecionadas)
        const allowedWords = new Set<string>();

        if (activeFolderFilters.length > 0) {
            currentData.forEach(item => {
                if (item.type !== 'word') {
                    // Verifica se o TEXTO está na pasta
                    const inFolder = activeFolderFilters.some(filterPath => {
                        if (filterPath === '__uncategorized__' && !item.folderPath) return true;
                        return item.folderPath === filterPath || item.folderPath?.startsWith(filterPath + '/');
                    });

                    if (inFolder) {
                        item.tokens?.forEach(t => allowedWords.add(cleanPunctuation(t).toLowerCase()));
                        item.keywords?.forEach(k => allowedWords.add(cleanPunctuation(k.word).toLowerCase()));
                    }
                }
            });
        }

        const map = new Map<string, Keyword>();

        currentData.forEach(item => {
            // Verifica se o item deve ser incluído (Lógica de União)
            let isVisible = false;
            if (activeFolderFilters.length === 0) {
                isVisible = true;
            } else {
                // Check 1: Pasta explícita
                const explicitMatch = activeFolderFilters.some(filterPath => {
                    if (filterPath === '__uncategorized__' && !item.folderPath) return true;
                    return item.folderPath === filterPath || item.folderPath?.startsWith(filterPath + '/');
                });

                if (explicitMatch) isVisible = true;

                // Check 2: Associação dinâmica (palavra dentro de texto da pasta)
                if (!isVisible && item.type === 'word' && allowedWords.has(cleanPunctuation(item.chinese).toLowerCase())) {
                    isVisible = true;
                }
            }

            if (!isVisible) return;

            // Keywords internas (dados legados/estáticos)
            item.keywords?.forEach(k => {
                if (currentSavedIds.includes(k.id)) {
                    // FILTRO DE ERROS LIFTED
                    if (showOnlyErrors && (wordCounts[k.word] || 0) <= 0) return;
                    map.set(k.word.toLowerCase().trim(), k);
                }
            });

            // Itens que são palavras (word cards salvos)
            const isWordCard = item.type === 'word' || (item.tokens?.length === 1 && currentSavedIds.includes(item.id.toString()));

            if (isWordCard && currentSavedIds.includes(item.id.toString())) {
                const chinese = item.chinese || '';
                // FILTRO DE ERROS LIFTED
                if (showOnlyErrors && (wordCounts[chinese] || 0) <= 0) return;

                map.set(chinese.toLowerCase().trim(), {
                    id: item.id.toString(),
                    word: item.chinese,
                    pinyin: item.pinyin,
                    meaning: item.translation,
                    language: item.language
                });
            }
        });

        return map;
    }, [sessionKey, filtersKey, showOnlyErrors]); // Estável: só muda com sessão, filtros ou toggle de Erros

    // Gera questões baseadas nas frases da Leitura que contêm palavras salvas
    const questions = useMemo(() => {
        const snapshot = dataSnapshotRef.current || { data, savedIds };
        const currentData = snapshot.data;

        const list: any[] = [];

        // Usa TODOS os textos da biblioteca como fonte de frases (contexto expandido)
        // Isso permite praticar palavras de uma lista usando frases de outras lições
        currentData.forEach(item => {
            if (item.type === 'word') return; // Pula itens de palavra individual
            if (!item.tokens || item.tokens.length === 0) return; // Precisa ter tokens

            const sentence = item.chinese;

            // Verifica cada token da frase
            item.tokens.forEach(token => {
                const cleanToken = cleanPunctuation(token).toLowerCase();
                if (!cleanToken) return;

                const savedWord = savedWordsMap.get(cleanToken);
                if (savedWord) {
                    list.push({
                        id: savedWord.id,
                        word: savedWord.word, // Palavra salva (original case)
                        wordMeaning: savedWord.meaning, // Tradução da palavra
                        sentence: sentence, // Frase completa da Leitura
                        translation: item.translation, // Tradução da frase
                        pinyin: savedWord.pinyin,
                        language: item.language || savedWord.language
                    });
                }
            });
        });

        // Boost: duplicate study-more questions for 2x frequency
        const withBoost = list.flatMap(q =>
            studyMoreIds.includes(q.id) ? [q, { ...q }] : [q]
        );

        // Embaralha sempre que o sessionKey mudar (Nova Sessão)
        return withBoost.sort(() => 0.5 - Math.random());
    }, [sessionKey, savedWordsMap, filtersKey]);

    // Recarrega sessão se os dados chegarem depois (evita tela branca inicial)
    useEffect(() => {
        if (questions.length === 0 && data.length > 0) {
            setSessionKey(prev => prev + 1);
        }
    }, [data.length]);

    // Opções de resposta - distratores vêm do savedWordsMap
    const options = useMemo(() => {
        if (!questions[currentIndex]) return [];
        const correct = questions[currentIndex].word;

        // Pega todas as palavras salvas como potenciais distratores
        const allSavedWords = Array.from(savedWordsMap.values()).map(k => k.word);

        const distractors = allSavedWords
            .filter(w => w !== correct)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);

        return [...distractors, correct].sort(() => 0.5 - Math.random());
    }, [questions, currentIndex, savedWordsMap]);

    const handleAnswer = (option: string) => {
        if (showResult) return;

        const currentQ = questions[currentIndex];
        const isCorrect = option === currentQ.word;

        setSelectedOption(option);
        setShowResult(true);

        // Removido: Não reproduz automaticamente. Usuário precisa clicar no botão de áudio.

        // Registra o resultado imediatamente, mas NÃO avança automaticamente
        onResult(isCorrect, currentQ.word);
    };


    const handleRestart = () => {
        setIsFinished(false);
        setCurrentIndex(0);
        setSessionKey(prev => prev + 1); // Força novo embaralhamento
    };

    // Navegação manual
    const handleNext = () => {
        stop(); // Para qualquer áudio em reprodução
        setSelectedOption(null);
        setShowResult(false);
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setIsFinished(true);
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setSelectedOption(null);
            setShowResult(false);
            setCurrentIndex(prev => prev - 1);
        }
    };


    // --- TELA DE ERRO (Poucos itens) ---
    if (questions.length < 4) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <EmptyState msg="Prática indisponível" icon="edit-3" />
                <p className="text-slate-400 text-sm mt-2">Salve pelo menos 4 palavras com frases de contexto para liberar a prática.</p>
            </div>
        );
    }

    // --- TELA DE CONCLUSÃO ---
    if (isFinished) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 animate-in fade-in zoom-in duration-300">
                <div className="bg-green-100 p-6 rounded-full mb-6 shadow-sm">
                    <Icon name="check-circle" size={64} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Sessão Concluída!</h2>
                <p className="text-slate-500 mb-8 max-w-xs">
                    Você praticou <span className="font-bold text-slate-700">{questions.length} frases</span> hoje. Continue assim para fixar o vocabulário!
                </p>
                <button
                    onClick={handleRestart}
                    className="bg-brand-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-brand-700 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Icon name="rotate-ccw" size={20} />
                    Praticar Novamente
                </button>
            </div>
        );
    }

    // --- TELA DO JOGO ---
    const currentQ = questions[currentIndex];
    // Proteção contra crash se a frase não contiver a palavra exata (acontece em algumas tokenizações)
    const parts = currentQ.sentence.includes(currentQ.word)
        ? currentQ.sentence.split(currentQ.word)
        : [currentQ.sentence, ""];

    const isGerman = currentQ.language === 'de';

    return (
        <div className="p-4 h-full fl-upex flex-col max-w-md mx-auto pb-20">
            {/* Barra de Progresso */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full mb-3 overflow-hidden">
                <div
                    className="bg-brand-500 h-full transition-all duration-500 ease-out"
                    style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
                />
            </div>

            <div className="mb-4 flex-shrink-0">
                <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider mb-1 block flex justify-between items-center">
                    <span>{invertPractice ? 'Traduza a palavra' : 'Complete a frase'}</span>

                    <button
                        onClick={() => setInvertPractice(!invertPractice)}
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border transition-colors ${invertPractice ? 'bg-brand-100 text-brand-600 border-brand-200' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                        title="Inverter (Português -> Estrangeiro)"
                    >
                        <Icon name="arrow-left-right" size={12} />
                        <span>{invertPractice ? 'PT ➔ ' + (isGerman ? 'DE' : 'ZH') : 'Normal'}</span>
                    </button>

                    <span>{currentIndex + 1} / {questions.length}</span>
                </span>

                {/* ÁREA DE PERGUNTA (CONDICIONAL) */}
                {invertPractice && !showResult ? (
                    // MODO INVERTIDO (Apenas exibe PT)
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[160px] animate-in fade-in slide-in-from-bottom-2">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Traduza</p>

                        <h3 className="text-xl font-bold text-slate-800 text-center mb-2 leading-snug">
                            {currentQ.translation}
                        </h3>

                        <div className="h-px w-16 bg-brand-200 my-3"></div>

                        <p className="text-brand-600 font-medium text-center">
                            {currentQ.wordMeaning}
                        </p>

                        <div className="mt-4 p-2 bg-slate-50 rounded-lg text-xs text-slate-400 italic">
                            Selecione a palavra em {isGerman ? 'Alemão' : 'Chinês'} abaixo
                        </div>
                    </div>
                ) : (
                    // MODO NORMAL (ou Resultado do Invertido)
                    <div className={`bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-base text-slate-800 leading-relaxed ${isGerman ? 'font-sans' : 'font-chinese'}`}>
                        {parts[0]}
                        {showResult ? (
                            // Palavra clicável para TTS (só após responder)
                            <button
                                onClick={() => {
                                    const audioId = `practice-word-${currentIndex}`;
                                    if (playingId === audioId) {
                                        stop();
                                    } else {
                                        speak(currentQ.word, (currentQ.language || 'zh') as 'zh' | 'de' | 'pt' | 'en', audioId);
                                    }
                                }}
                                className={`inline-block min-w-[40px] border-b-2 mx-0.5 text-center font-bold transition-colors cursor-pointer hover:opacity-80 active:scale-95 ${selectedOption === currentQ.word ? 'text-green-600 border-green-500' : 'text-red-500 border-red-400'} ${playingId === `practice-word-${currentIndex}` ? 'animate-pulse' : ''}`}
                                title="Clique para ouvir a palavra"
                            >
                                {currentQ.word}
                            </button>
                        ) : (
                            <span className="inline-block min-w-[40px] border-b-2 mx-0.5 text-center font-bold text-brand-600 border-brand-500">
                                ____
                            </span>
                        )}
                        {parts.length > 1 ? parts[1] : ""}

                        {/* Se for resultado do invertido, destaca que a frase foi revelada */}
                        {invertPractice && showResult && (
                            <div className="mt-2 text-xs text-green-600 font-bold block text-center animate-in fade-in">
                                Frase Original Revelada!
                            </div>
                        )}
                    </div>
                )}

                {/* Botões de Apoio (Áudio/Tradução) - Só mostra no modo Normal ou quando Invertido JÁ RESPONDEU */}
                {(!invertPractice || showResult) && (
                    <>
                        {/* Botão de áudio para frase completa */}
                        <button
                            onClick={() => {
                                const audioId = `practice-sentence-${currentIndex}`;
                                if (playingId === audioId) {
                                    stop();
                                } else {
                                    speak(currentQ.sentence, (currentQ.language || 'zh') as 'zh' | 'de' | 'pt' | 'en', audioId);
                                }
                            }}
                            className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-brand-600 transition-colors mx-auto"
                        >
                            <Icon name={playingId === `practice-sentence-${currentIndex}` ? 'square' : 'volume-2'} size={14} />
                            <span>{playingId === `practice-sentence-${currentIndex}` ? 'Parar' : 'Ouvir frase'}</span>
                        </button>

                        {/* Tradução da palavra + Tradução da frase */}
                        <p className="text-center text-brand-600 text-xs font-medium mt-2">{currentQ.wordMeaning}</p>
                        <p className="text-center text-slate-400 text-xs mt-1 italic">{currentQ.translation}</p>

                        {/* Study More toggle - visible after answering */}
                        {showResult && onToggleStudyMore && (
                            <button
                                onClick={() => onToggleStudyMore(currentQ.id)}
                                className={`mt-2 mx-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${studyMoreIds.includes(currentQ.id)
                                    ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                    }`}
                                title={studyMoreIds.includes(currentQ.id) ? 'Remover de Estudar Mais' : 'Marcar para Estudar Mais'}
                            >
                                <Star className={`w-3.5 h-3.5 ${studyMoreIds.includes(currentQ.id) ? 'fill-current text-amber-500' : ''}`} />
                                {studyMoreIds.includes(currentQ.id) ? 'Estudar Mais ✓' : 'Estudar Mais'}
                            </button>
                        )}
                    </>
                )}
            </div>

            <div className="grid gap-2 flex-1">
                {options.map((opt, i) => {
                    let btnClass = "bg-white border-slate-200 text-slate-700 hover:border-brand-300";
                    if (showResult) {
                        if (opt === currentQ.word) btnClass = "bg-green-100 border-green-500 text-green-700 shadow-md";
                        else if (opt === selectedOption) btnClass = "bg-red-100 border-red-500 text-red-700";
                        else btnClass = "opacity-50";
                    }

                    return (
                        <button
                            key={i}
                            onClick={() => handleAnswer(opt)}
                            className={`py-2.5 px-3 rounded-lg border-2 font-bold text-sm transition-all active:scale-95 ${btnClass} ${isGerman ? 'font-sans' : 'font-chinese'}`}
                            disabled={showResult}
                        >
                            {opt}
                        </button>
                    );
                })}
            </div>

            {/* Botões de Navegação - Sempre visíveis */}
            <div className="flex gap-2 mt-3 flex-shrink-0">
                <button
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className="flex-1 py-2.5 text-sm text-slate-500 font-bold bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    Voltar
                </button>
                <button
                    onClick={handleNext}
                    disabled={!showResult}
                    className={`flex-[2] py-2.5 text-sm font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 ${showResult
                        ? 'bg-brand-600 text-white hover:bg-brand-700'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    {currentIndex < questions.length - 1 ? 'Próximo' : 'Concluir'}
                    <Icon name="arrow-right" size={14} />
                </button>
            </div>
        </div>
    );
};

export default PracticeView;