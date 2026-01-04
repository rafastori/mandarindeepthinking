import React, { useState, useMemo, useRef, useEffect } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem, Keyword } from '../types';
import { usePuterSpeech } from '../hooks/usePuterSpeech';

interface PracticeViewProps {
    data: StudyItem[];
    savedIds: string[];
    onResult: (correct: boolean, word: string) => void;
}

const PracticeView: React.FC<PracticeViewProps> = ({ data, savedIds, onResult }) => {
    const { speak, stop } = usePuterSpeech();

    // Estados do Jogo
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [sessionKey, setSessionKey] = useState(0); // Usado para forçar o re-embaralhamento

    // Ref para armazenar snapshot estável dos dados (evita re-render causar re-shuffle)
    const dataSnapshotRef = useRef<{ data: StudyItem[]; savedIds: string[] } | null>(null);

    // Atualiza o snapshot apenas quando sessionKey muda (início de nova sessão)
    useEffect(() => {
        dataSnapshotRef.current = { data, savedIds };
    }, [sessionKey]); // Propositalmente NÃO inclui data/savedIds

    // Função para limpar pontuação (mesma do ReadingView)
    const cleanPunctuation = (text: string) => text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'´。，！？；：）】」』、]/g, "").trim();

    // Mapa de palavras salvas - MESMA LÓGICA DO ReadingView
    const savedWordsMap = useMemo(() => {
        const snapshot = dataSnapshotRef.current || { data, savedIds };
        const currentData = snapshot.data;
        const currentSavedIds = snapshot.savedIds;

        const map = new Map<string, Keyword>();

        currentData.forEach(item => {
            // Keywords internas (dados legados/estáticos)
            item.keywords?.forEach(k => {
                if (currentSavedIds.includes(k.id)) {
                    map.set(k.word.toLowerCase().trim(), k);
                }
            });

            // Itens que são palavras (word cards salvos)
            const isWordCard = item.type === 'word' || (item.tokens?.length === 1 && currentSavedIds.includes(item.id.toString()));

            if (isWordCard && currentSavedIds.includes(item.id.toString())) {
                map.set(item.chinese.toLowerCase().trim(), {
                    id: item.id.toString(),
                    word: item.chinese,
                    pinyin: item.pinyin,
                    meaning: item.translation,
                    language: item.language
                });
            }
        });

        return map;
    }, [sessionKey]);

    // Gera questões baseadas nas frases da Leitura que contêm palavras salvas
    const questions = useMemo(() => {
        const snapshot = dataSnapshotRef.current || { data, savedIds };
        const currentData = snapshot.data;

        const list: any[] = [];

        // Para cada texto na aba Leitura (type !== 'word')
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

        // Embaralha sempre que o sessionKey mudar (Nova Sessão)
        return list.sort(() => 0.5 - Math.random());
    }, [sessionKey, savedWordsMap]);

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
        <div className="p-4 h-full flex flex-col max-w-md mx-auto pb-20">
            {/* Barra de Progresso */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full mb-3 overflow-hidden">
                <div
                    className="bg-brand-500 h-full transition-all duration-500 ease-out"
                    style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
                />
            </div>

            <div className="mb-4 flex-shrink-0">
                <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider mb-1 block flex justify-between">
                    <span>Complete a frase</span>
                    <span>{currentIndex + 1} / {questions.length}</span>
                </span>

                {/* Frase com buraco (Cloze) */}
                <div className={`bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-base text-slate-800 leading-relaxed ${isGerman ? 'font-sans' : 'font-chinese'}`}>
                    {parts[0]}
                    {showResult ? (
                        // Palavra clicável para TTS (só após responder)
                        <button
                            onClick={() => speak(currentQ.word, (currentQ.language || 'zh') as 'zh' | 'de' | 'pt' | 'en')}
                            className={`inline-block min-w-[40px] border-b-2 mx-0.5 text-center font-bold transition-colors cursor-pointer hover:opacity-80 active:scale-95 ${selectedOption === currentQ.word ? 'text-green-600 border-green-500' : 'text-red-500 border-red-400'}`}
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
                </div>

                {/* Botão de áudio para frase completa */}
                <button
                    onClick={() => speak(currentQ.sentence, (currentQ.language || 'zh') as 'zh' | 'de' | 'pt' | 'en')}
                    className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-brand-600 transition-colors mx-auto"
                >
                    <Icon name="volume-2" size={14} />
                    <span>Ouvir frase</span>
                </button>

                {/* Tradução da palavra + Tradução da frase */}
                <p className="text-center text-brand-600 text-xs font-medium mt-2">{currentQ.wordMeaning}</p>
                <p className="text-center text-slate-400 text-xs mt-1 italic">{currentQ.translation}</p>
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