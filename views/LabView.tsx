
import React, { useState, useEffect } from 'react';
import EmptyState from '../components/EmptyState';
import { StudyItem } from '../types';
import { useSpeech } from '../hooks/useSpeech';

interface LabViewProps {
    data: StudyItem[];
    savedIds: string[];
    onResult: (correct: boolean, text: string) => void;
}

const LabView: React.FC<LabViewProps> = ({ data, savedIds, onResult }) => {
    const [puzzle, setPuzzle] = useState<any>(null); 
    const [userOrder, setUserOrder] = useState<any[]>([]); 
    const [pool, setPool] = useState<any[]>([]); 
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle'); 
    const speak = useSpeech();

    const initPuzzle = () => { 
        const validSentences = data.filter(s => s.keywords.some(k => savedIds.includes(k.id))); 
        if (validSentences.length === 0) return null; 
        const target = validSentences[Math.floor(Math.random() * validSentences.length)]; 
        const shuffled = [...target.tokens].sort(() => 0.5 - Math.random()); 
        return { target, shuffledItems: shuffled.map((txt, i) => ({ id: i, text: txt, used: false })) }; 
    };

    useEffect(() => { 
        if (!puzzle) { 
            const p = initPuzzle(); 
            if(p) { 
                setPuzzle(p); 
                setPool(p.shuffledItems); 
                setUserOrder([]); 
                setStatus('idle'); 
            } 
        } 
    }, [savedIds, puzzle]);

    const handleSelect = (idx: number) => { 
        if(status === 'success') return; 
        const item = pool[idx]; 
        const nextIndex = userOrder.length; 
        if (item.text !== puzzle.target.tokens[nextIndex]) { 
            setStatus('error'); 
            onResult(false, puzzle.target.tokens[nextIndex] + " (Order)"); 
            setTimeout(() => setStatus('idle'), 500); 
            return; 
        } 
        const newPool = [...pool]; 
        newPool[idx].used = true; 
        setPool(newPool); 
        const newOrder = [...userOrder, item]; 
        setUserOrder(newOrder); 
        if (newOrder.length === puzzle.target.tokens.length) { 
            setStatus('success'); 
            onResult(true, "Full Sentence"); 
            speak(puzzle.target.chinese, puzzle.target.language || 'zh'); 
        } 
    };

    const reset = () => setPuzzle(null);

    if (savedIds.length === 0) return <EmptyState msg="Precisa de vocabulário para o laboratório." icon="flask-conical" />; 
    if (!puzzle) return <div className="p-10 text-center text-slate-400">Carregando...</div>;

    const isGerman = puzzle.target.language === 'de';

    return (
        <div className="p-4 flex flex-col h-full max-w-md mx-auto pb-24">
            <div className="bg-slate-800 rounded-xl p-4 mb-4 shadow-lg">
                <span className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">Alvo</span>
                <p className="text-white text-lg leading-relaxed">{puzzle.target.translation}</p>
            </div>
            <div className={`bg-white border-2 rounded-xl min-h-[100px] p-3 mb-6 flex flex-wrap gap-2 content-start transition-colors ${status === 'error' ? 'border-red-400 bg-red-50 animate-shake' : 'border-slate-200'} ${status === 'success' ? 'border-brand-500 bg-brand-50' : ''}`}>
                {userOrder.length === 0 && <span className="text-slate-300 w-full text-center self-center">Toque nas palavras abaixo</span>}
                {userOrder.map((item, i) => (<span key={i} className="bg-brand-600 text-white px-2 py-1 rounded shadow animate-pop">{item.text}</span>))}
            </div>
            <div className="flex flex-wrap justify-center gap-3 mb-auto">
                {pool.map((item, i) => (
                    <button key={i} onClick={() => !item.used && handleSelect(i)} className={`px-4 py-2 rounded-lg text-lg ${isGerman ? 'font-sans' : 'font-chinese'} shadow-sm border-b-2 transition-all ${item.used ? 'opacity-0 pointer-events-none scale-90' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 active:translate-y-1 active:border-b-0'}`}>
                        {item.text}
                    </button>
                ))}
            </div>
            {status === 'success' && (<button onClick={reset} className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg animate-pop mt-4">Próximo Desafio</button>)}
        </div>
    );
};

export default LabView;
