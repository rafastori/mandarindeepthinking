
import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem } from '../types';
import { useSpeech } from '../hooks/useSpeech';

interface PracticeViewProps {
    data: StudyItem[];
    savedIds: string[];
    onResult: (isCorrect: boolean, word: string) => void;
}

const PracticeView: React.FC<PracticeViewProps> = ({ data, savedIds, onResult }) => {
    const [session, setSession] = useState<any>(null); 
    const [isFinished, setIsFinished] = useState(false); 
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const speak = useSpeech();

    const resetGame = () => {
        setIsFinished(false); 
        setFeedback(null); 
        setSession(null); 
        setTimeout(() => {
            const savedKeywords: any[] = []; 
            data.forEach(s => s.keywords.forEach(k => { 
                if (savedIds.includes(k.id)) savedKeywords.push({ ...k, fullSentence: s }); 
            }));
            
            if (savedKeywords.length === 0) return;
            
            const shuffled = savedKeywords.sort(() => 0.5 - Math.random());
            const queue = shuffled.slice(0, 6).map(target => {
                const allWords = data
                    .filter(s => (s.language || 'zh') === (target.fullSentence.language || 'zh')) // Filter distractors by same language
                    .flatMap(s => s.keywords)
                    .filter(k => k.id !== target.id);
                    
                const distractors = allWords.sort(() => 0.5 - Math.random()).slice(0, 3).map(k => k.word);
                const options = [target.word, ...distractors].sort(() => 0.5 - Math.random());
                const clozeSentence = target.fullSentence.chinese.replace(target.word, " ____ ");
                return { target, options, clozeSentence };
            }); 
            setSession({ queue, currentIndex: 0, score: 0 });
        }, 50);
    };

    useEffect(() => { if (!session && !isFinished && savedIds.length > 0) resetGame(); }, [savedIds]);

    const handleAnswer = (ans: string) => {
        if (feedback) return; 
        const currentQ = session.queue[session.currentIndex]; 
        const isCorrect = ans === currentQ.target.word; 
        onResult(isCorrect, currentQ.target.word);
        
        if (isCorrect) { 
            setFeedback('correct'); 
            speak(currentQ.target.word, currentQ.target.fullSentence.language || 'zh'); 
        } else { 
            setFeedback('wrong'); 
        }
        
        setTimeout(() => {
            const isLast = session.currentIndex >= session.queue.length - 1;
            setSession((prev: any) => ({ 
                ...prev, 
                score: prev.score + (isCorrect ? 1 : 0), 
                currentIndex: isLast ? prev.currentIndex : prev.currentIndex + 1 
            }));
            if (isLast) setIsFinished(true); else setFeedback(null);
        }, 1200);
    };

    if (savedIds.length === 0) return <EmptyState msg="Salve palavras para praticar." icon="pen-tool" />; 
    if (!session) return <div className="p-10 text-center text-slate-400">Carregando...</div>;
    
    if (isFinished) { 
        return (
            <div className="p-6 h-full flex flex-col items-center justify-center max-w-md mx-auto animate-pop pb-24">
                <div className="bg-brand-100 text-brand-600 p-6 rounded-full mb-6">
                    <Icon name="trophy" size={48} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Sessão Concluída!</h2>
                <p className="text-slate-500 mb-8 text-center">
                    Você acertou <strong className="text-brand-600">{session.score}</strong> de {session.queue.length} palavras.
                </p>
                <button onClick={resetGame} className="w-full py-4 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all flex items-center justify-center gap-2">
                    <Icon name="refresh-cw" size={20} /> Praticar Novamente
                </button>
            </div>
        ); 
    }
    
    const currentQ = session.queue[session.currentIndex]; 
    const isGerman = currentQ.target.fullSentence.language === 'de';
    const progress = ((session.currentIndex + 1) / session.queue.length) * 100;
    
    return (
        <div className="p-4 flex flex-col h-full justify-center max-w-md mx-auto pb-24">
            <div className="mb-6">
                <div className="flex justify-between text-xs font-bold text-slate-400 mb-1 uppercase">
                    <span>Questão {session.currentIndex + 1}</span>
                    <span>{session.queue.length}</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-brand-500 mb-6 relative overflow-hidden min-h-[200px] flex flex-col justify-center">
                {feedback === 'correct' && <div className="absolute inset-0 bg-brand-500/10 flex items-center justify-center z-10"><Icon name="check-circle" size={64} className="text-brand-600 animate-pop" /></div>}
                {feedback === 'wrong' && <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center z-10"><Icon name="x-circle" size={64} className="text-red-500 animate-shake" /></div>}
                <p className={`${isGerman ? 'font-sans' : 'font-chinese'} text-2xl text-center leading-loose text-slate-800 mb-6`}>{currentQ.clozeSentence}</p>
                <p className="text-sm text-center text-slate-400 italic border-t border-slate-100 pt-4">{currentQ.target.fullSentence.translation}</p>
            </div>
            <div className="grid grid-cols-2 gap-4" key={session.currentIndex}>
                {currentQ.options.map((opt: string, i: number) => (
                    <button 
                        key={i} 
                        onClick={() => handleAnswer(opt)} 
                        disabled={feedback !== null} 
                        className={`border-2 rounded-xl py-4 text-xl ${isGerman ? 'font-sans' : 'font-chinese'} font-bold transition-all active:scale-95 ${feedback === null ? 'bg-white border-slate-200 text-slate-700 hover:border-brand-500 hover:bg-brand-50' : opt === currentQ.target.word ? 'bg-brand-500 border-brand-500 text-white' : 'bg-slate-50 border-slate-100 text-slate-300'}`}
                    >
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default PracticeView;
