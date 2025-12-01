
import React, { useState, useMemo } from 'react';
import EmptyState from '../components/EmptyState';
import { StudyItem } from '../types';

interface CardsViewProps {
    data: StudyItem[];
    savedIds: string[];
    onResult: (correct: boolean, word: string) => void;
}

const CardsView: React.FC<CardsViewProps> = ({ data, savedIds, onResult }) => {
    const [idx, setIdx] = useState(0); 
    const [flipped, setFlipped] = useState(false);
    
    const cards = useMemo(() => { 
        let list: any[] = []; 
        data.forEach(s => s.keywords.forEach(k => { 
            if (savedIds.includes(k.id)) list.push({...k, sentence: s}); 
        })); 
        return list.sort(() => 0.5 - Math.random()); 
    }, [savedIds, data]);

    if (cards.length === 0) return <EmptyState msg="Sem cards para revisar." icon="layers" />;

    const card = cards[idx]; 
    const isGerman = card.sentence.language === 'de';

    const next = (correct: boolean) => { 
        onResult(correct, card.word); 
        setFlipped(false); 
        setTimeout(() => setIdx((idx + 1) % cards.length), 200); 
    };

    return (
        <div className="p-6 h-full flex flex-col items-center justify-center max-w-md mx-auto pb-24">
            <div className="relative w-full aspect-[3/4] cursor-pointer perspective-1000 group" onClick={() => setFlipped(!flipped)}>
                <div className={`w-full h-full transition-all duration-500 transform-style-3d shadow-2xl rounded-2xl ${flipped ? 'rotate-y-180' : ''}`}>
                    <div className="absolute inset-0 bg-white rounded-2xl flex flex-col items-center justify-center backface-hidden border-b-4 border-slate-100">
                        <span className="text-xs text-slate-400 uppercase tracking-widest mb-4">{isGerman ? 'Texto' : 'Hanzi'}</span>
                        <h2 className={`text-6xl ${isGerman ? 'font-sans' : 'font-chinese'} font-bold text-slate-800`}>{card.word}</h2>
                        <span className="mt-8 text-xs text-brand-500 font-bold">Toque para virar</span>
                    </div>
                    <div className="absolute inset-0 bg-slate-800 rounded-2xl flex flex-col items-center justify-center rotate-y-180 backface-hidden text-white p-6 text-center">
                        <h2 className={`text-3xl ${isGerman ? 'font-sans' : 'font-chinese'} font-bold mb-2`}>{card.word}</h2>
                        <p className="text-brand-400 text-xl mb-4">{card.pinyin}</p>
                        <p className="text-lg mb-6 opacity-90">{card.meaning}</p>
                        <div className={`bg-white/10 p-3 rounded text-sm italic ${isGerman ? 'font-sans' : 'font-chinese'}`}>{card.sentence.chinese}</div>
                    </div>
                </div>
            </div>
            <div className={`flex gap-4 mt-8 w-full transition-opacity duration-300 ${flipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button onClick={() => next(false)} className="flex-1 py-3 rounded-xl bg-red-100 text-red-600 font-bold shadow-sm active:scale-95 transition-transform">Errei</button>
                <button onClick={() => next(true)} className="flex-1 py-3 rounded-xl bg-brand-100 text-brand-700 font-bold shadow-sm active:scale-95 transition-transform">Acertei</button>
            </div>
        </div>
    );
};

export default CardsView;
