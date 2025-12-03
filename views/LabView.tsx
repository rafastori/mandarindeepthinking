import React, { useState, useMemo, useEffect } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem } from '../types';
import { useSpeech } from '../hooks/useSpeech'; // <--- 1. Importando a fala

interface LabViewProps {
    data: StudyItem[];
    onResult: (correct: boolean, word: string) => void;
}

const LabView: React.FC<LabViewProps> = ({ data, onResult }) => {
    const speak = useSpeech(); // <--- 2. Inicializando
    const [currentIdx, setCurrentIdx] = useState(0);
    const [selectedTokens, setSelectedTokens] = useState<{id: number, text: string}[]>([]);
    const [shuffledTokens, setShuffledTokens] = useState<{id: number, text: string}[]>([]);
    const [status, setStatus] = useState<'playing' | 'correct' | 'wrong'>('playing');

    // Filtra apenas frases longas (com mais de 1 token) para o jogo fazer sentido
    const sentences = useMemo(() => {
        return data.filter(item => item.tokens && item.tokens.length > 1)
                   .sort(() => 0.5 - Math.random());
    }, [data]);

    const currentSentence = sentences[currentIdx];

    // Reinicia o jogo para a frase atual
    const initGame = () => {
        if (!currentSentence) return;
        
        const tokens = currentSentence.tokens.map((t, i) => ({ id: i, text: t }));
        setShuffledTokens([...tokens].sort(() => 0.5 - Math.random()));
        setSelectedTokens([]);
        setStatus('playing');
    };

    useEffect(() => {
        initGame();
    }, [currentSentence]);

    const handleSelect = (tokenObj: {id: number, text: string}) => {
        if (status !== 'playing') return;
        setSelectedTokens([...selectedTokens, tokenObj]);
        setShuffledTokens(shuffledTokens.filter(t => t.id !== tokenObj.id));
    };

    const handleUndo = (tokenObj: {id: number, text: string}) => {
        if (status !== 'playing') return;
        setSelectedTokens(selectedTokens.filter(t => t.id !== tokenObj.id));
        setShuffledTokens([...shuffledTokens, tokenObj]);
    };

    const checkAnswer = () => {
        const normalize = (str: string) => str.replace(/\s+/g, '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase();
        
        const attempt = normalize(selectedTokens.map(t => t.text).join(''));
        const target = normalize(currentSentence.tokens.join(''));

        if (attempt === target) {
            setStatus('correct');
            
            // <--- 3. FALA A FRASE AO ACERTAR
            speak(currentSentence.chinese, currentSentence.language || 'zh');

            setTimeout(() => {
                onResult(true, "sentence_builder");
                if (currentIdx < sentences.length - 1) {
                    setCurrentIdx(prev => prev + 1);
                } else {
                    alert("Parabéns! Você completou todas as frases.");
                    setCurrentIdx(0);
                }
            }, 2000); // Tempo aumentado para 2s para ouvir o áudio
        } else {
            setStatus('wrong');
            onResult(false, "sentence_builder");
        }
    };

    if (sentences.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <EmptyState msg="Laboratório de Frases" icon="flask-conical" />
                <p className="text-slate-400 text-sm mt-2">Adicione textos com frases completas para desbloquear este laboratório.</p>
            </div>
        );
    }

    const isGerman = currentSentence.language === 'de';

    return (
        <div className="p-6 h-full flex flex-col pb-24 max-w-md mx-auto">
            <div className="flex-1 flex flex-col justify-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 text-center block">
                    Frase {currentIdx + 1} de {sentences.length}
                </span>
                
                {/* Área da Resposta */}
                <div className={`min-h-[120px] bg-slate-100 rounded-2xl p-4 mb-6 flex flex-wrap gap-2 content-start border-2 transition-colors ${
                    status === 'correct' ? 'border-green-400 bg-green-50' : 
                    status === 'wrong' ? 'border-red-400 bg-red-50' : 'border-slate-200'
                }`}>
                    {selectedTokens.map((token) => (
                        <button 
                            key={token.id} 
                            onClick={() => handleUndo(token)}
                            className={`bg-white px-3 py-2 rounded-lg shadow-sm font-medium ${isGerman ? 'font-sans' : 'font-chinese'} animate-pop hover:bg-red-50 hover:text-red-500`}
                        >
                            {token.text}
                        </button>
                    ))}
                    {selectedTokens.length === 0 && (
                        <span className="text-slate-400 text-sm w-full text-center mt-8 self-center">Toque nas palavras abaixo...</span>
                    )}
                </div>

                {/* Tradução */}
                <p className="text-center text-slate-500 italic mb-8 text-sm px-4">
                    "{currentSentence.translation}"
                </p>

                {/* Área das Peças */}
                <div className="flex flex-wrap gap-2 justify-center content-center min-h-[100px]">
                    {shuffledTokens.map((token) => (
                        <button
                            key={token.id}
                            onClick={() => handleSelect(token)}
                            className={`bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-xl shadow-sm hover:border-brand-300 hover:shadow-md transition-all active:scale-95 ${isGerman ? 'font-sans' : 'font-chinese'} text-lg`}
                        >
                            {token.text}
                        </button>
                    ))}
                </div>
            </div>

            {/* Controles */}
            <div className="flex gap-3 mt-auto pt-6">
                <button 
                    onClick={initGame} 
                    className="p-4 text-slate-400 hover:text-slate-600 rounded-xl bg-slate-50 active:bg-slate-200 transition-colors"
                    title="Reiniciar Frase"
                >
                    <Icon name="rotate-ccw" size={24} />
                </button>
                
                {status === 'wrong' ? (
                    <button 
                        onClick={initGame} 
                        className="flex-1 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-600 transition-all py-4 animate-pulse"
                    >
                        Tentar Novamente
                    </button>
                ) : (
                    <button 
                        onClick={checkAnswer} 
                        disabled={shuffledTokens.length > 0 || status === 'correct'}
                        className="flex-1 bg-brand-600 text-white font-bold rounded-xl shadow-lg hover:bg-brand-700 disabled:opacity-50 disabled:shadow-none transition-all py-4"
                    >
                        {status === 'correct' ? 'Muito Bem!' : 'Verificar'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default LabView;