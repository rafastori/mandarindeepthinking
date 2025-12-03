import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem } from '../types';
import { useSpeech } from '../hooks/useSpeech';

interface PracticeViewProps {
    data: StudyItem[];
    savedIds: string[];
    onResult: (correct: boolean, word: string) => void;
}

const PracticeView: React.FC<PracticeViewProps> = ({ data, savedIds, onResult }) => {
    const speak = useSpeech();
    
    // Estados do Jogo
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [sessionKey, setSessionKey] = useState(0); // Usado para forçar o re-embaralhamento

    // Lógica para criar questões
    const questions = useMemo(() => {
        const list: any[] = [];
        
        data.forEach(item => {
            // CASO 1: Item do Firebase
            if (savedIds.includes(item.id.toString()) && item.originalSentence) {
                list.push({
                    id: item.id,
                    word: item.chinese,
                    sentence: item.originalSentence,
                    translation: item.translation,
                    pinyin: item.pinyin,
                    language: item.language
                });
            }

            // CASO 2: Item estático
            if (item.keywords) {
                item.keywords.forEach(k => {
                    if (savedIds.includes(k.id)) {
                        list.push({
                            id: k.id,
                            word: k.word,
                            sentence: item.chinese,
                            translation: item.translation,
                            pinyin: k.pinyin,
                            language: item.language
                        });
                    }
                });
            }
        });

        // Embaralha sempre que o sessionKey mudar (Nova Sessão)
        return list.sort(() => 0.5 - Math.random());
    }, [data, savedIds, sessionKey]);

    // Opções de resposta
    const options = useMemo(() => {
        if (!questions[currentIndex]) return [];
        const correct = questions[currentIndex].word;
        
        const distractors = questions
            .map(q => q.word)
            .filter(w => w !== correct)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);
        
        return [...distractors, correct].sort(() => 0.5 - Math.random());
    }, [questions, currentIndex]);

    const handleAnswer = (option: string) => {
        if (showResult) return;
        
        const currentQ = questions[currentIndex];
        const isCorrect = option === currentQ.word;
        
        setSelectedOption(option);
        setShowResult(true);
        
        if (isCorrect) {
            speak(currentQ.sentence, currentQ.language || 'zh');
        }
        
        setTimeout(() => {
            onResult(isCorrect, currentQ.word);
            setSelectedOption(null);
            setShowResult(false);

            // Lógica de Progressão (Linear)
            if (currentIndex < questions.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setIsFinished(true); // Fim da sessão
            }
        }, 2000);
    };

    const handleRestart = () => {
        setIsFinished(false);
        setCurrentIndex(0);
        setSessionKey(prev => prev + 1); // Força novo embaralhamento
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
        <div className="p-6 h-full flex flex-col justify-center max-w-md mx-auto pb-24">
            {/* Barra de Progresso */}
            <div className="w-full bg-slate-100 h-2 rounded-full mb-6 overflow-hidden">
                <div 
                    className="bg-brand-500 h-full transition-all duration-500 ease-out" 
                    style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
                />
            </div>

            <div className="mb-8">
                <span className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-2 block flex justify-between">
                    <span>Complete a frase</span>
                    <span>{currentIndex + 1} / {questions.length}</span>
                </span>
                
                {/* Frase com buraco (Cloze) */}
                <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-xl text-slate-800 leading-relaxed ${isGerman ? 'font-sans' : 'font-chinese'}`}>
                    {parts[0]}
                    <span className={`inline-block min-w-[60px] border-b-2 mx-1 text-center font-bold transition-colors ${
                        showResult 
                            ? (selectedOption === currentQ.word ? 'text-green-600 border-green-500' : 'text-red-500 border-red-400')
                            : 'text-brand-600 border-brand-500'
                    }`}>
                        {showResult ? currentQ.word : "____"}
                    </span>
                    {parts.length > 1 ? parts[1] : ""}
                </div>
                
                <p className="text-center text-slate-400 text-sm mt-4 italic">{currentQ.translation}</p>
            </div>

            <div className="grid gap-3">
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
                            className={`p-4 rounded-xl border-2 font-bold text-lg transition-all active:scale-95 ${btnClass} ${isGerman ? 'font-sans' : 'font-chinese'}`}
                            disabled={showResult}
                        >
                            {opt}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default PracticeView;