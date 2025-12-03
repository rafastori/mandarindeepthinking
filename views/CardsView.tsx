import React, { useState, useMemo } from 'react';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { StudyItem } from '../types';

interface CardsViewProps {
    data: StudyItem[];
    savedIds: string[];
    onResult: (correct: boolean, word: string) => void;
}

const CardsView: React.FC<CardsViewProps> = ({ data, savedIds, onResult }) => {
    const [idx, setIdx] = useState(0); 
    const [flipped, setFlipped] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [sessionKey, setSessionKey] = useState(0); 
    
    const cards = useMemo(() => { 
        let list: any[] = []; 
        data.forEach(item => {
            // CASO 1: Card solto (Firebase)
            if (savedIds.includes(item.id.toString())) {
                list.push({
                    id: item.id,
                    word: item.chinese,
                    pinyin: item.pinyin,
                    meaning: item.translation,
                    sentence: { chinese: item.originalSentence || item.chinese },
                    language: item.language
                });
            }
            // CASO 2: Keyword dentro de texto
            if (item.keywords) {
                item.keywords.forEach(k => { 
                    if (savedIds.includes(k.id)) {
                        list.push({ ...k, sentence: item, language: item.language }); 
                    }
                });
            }
        });
        
        // CORREÇÃO AQUI: Filtra pelo CONTEÚDO da palavra, não pelo ID.
        // Isso evita que "Hallo" apareça 2 vezes se foi salva em textos diferentes.
        const unique = list.filter((v, i, a) => 
            a.findIndex(t => (t.word.toLowerCase().trim() === v.word.toLowerCase().trim())) === i
        );
        
        // Embaralha
        return unique.sort(() => 0.5 - Math.random()); 
    }, [savedIds, data, sessionKey]);

    const handleRestart = () => {
        setIsFinished(false);
        setIdx(0);
        setFlipped(false);
        setSessionKey(prev => prev + 1); 
    };

    if (isFinished) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 animate-in fade-in zoom-in duration-300">
                <div className="bg-blue-100 p-6 rounded-full mb-6 shadow-sm">
                    <Icon name="layers" size={64} className="text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Revisão Completa!</h2>
                <p className="text-slate-500 mb-8 max-w-xs">
                    Você revisou <span className="font-bold text-slate-700">{cards.length} cartas</span> nesta sessão.
                </p>
                <button 
                    onClick={handleRestart}
                    className="bg-brand-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-brand-700 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Icon name="rotate-ccw" size={20} />
                    Revisar Novamente
                </button>
            </div>
        );
    }

    if (cards.length === 0) return <EmptyState msg="Sem cards para revisar." icon="layers" />;

    const card = cards[idx]; 
    const isGerman = card.language === 'de';

    const getFontSize = (text: string) => {
        if (text.length > 20) return 'text-2xl';
        if (text.length > 12) return 'text-4xl';
        return 'text-6xl';
    };

    const next = (correct: boolean) => { 
        onResult(correct, card.word); 
        setFlipped(false); 
        
        setTimeout(() => {
            if (idx < cards.length - 1) {
                setIdx(idx + 1);
            } else {
                setIsFinished(true);
            }
        }, 200); 
    };

    return (
        <div className="p-6 h-full flex flex-col items-center justify-center max-w-md mx-auto pb-24">
            <div className="w-full mb-4 flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span>Card {idx + 1} de {cards.length}</span>
                <span>{Math.round(((idx + 1) / cards.length) * 100)}%</span>
            </div>

            <div className="relative w-full aspect-[3/4] cursor-pointer perspective-1000 group" onClick={() => setFlipped(!flipped)}>
                <div className={`w-full h-full transition-all duration-500 transform-style-3d shadow-2xl rounded-2xl ${flipped ? 'rotate-y-180' : ''}`}>
                    
                    {/* FRENTE */}
                    <div className="absolute inset-0 bg-white rounded-2xl flex flex-col items-center justify-center backface-hidden border-b-4 border-slate-100 p-4">
                        <span className="text-xs text-slate-400 uppercase tracking-widest mb-4">
                            {isGerman ? 'Palavra' : 'Hanzi'}
                        </span>
                        <h2 className={`${getFontSize(card.word)} ${isGerman ? 'font-sans' : 'font-chinese'} font-bold text-slate-800 text-center break-words w-full`}>
                            {card.word}
                        </h2>
                        <span className="mt-8 text-xs text-brand-500 font-bold">Toque para virar</span>
                    </div>

                    {/* VERSO */}
                    <div className="absolute inset-0 bg-slate-800 rounded-2xl flex flex-col items-center justify-center rotate-y-180 backface-hidden text-white p-6 text-center">
                        <h2 className={`text-3xl ${isGerman ? 'font-sans' : 'font-chinese'} font-bold mb-2 break-words w-full`}>
                            {card.word}
                        </h2>
                        <p className="text-brand-400 text-xl mb-4">{card.pinyin}</p>
                        <p className="text-lg mb-6 opacity-90">{card.meaning}</p>
                        
                        {card.sentence.chinese && card.sentence.chinese !== card.word && (
                            <div className={`bg-white/10 p-3 rounded text-sm italic ${isGerman ? 'font-sans' : 'font-chinese'}`}>
                                {card.sentence.chinese}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className={`flex gap-4 mt-8 w-full transition-opacity duration-300 ${flipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button onClick={(e) => { e.stopPropagation(); next(false); }} className="flex-1 py-3 rounded-xl bg-red-100 text-red-600 font-bold shadow-sm active:scale-95 transition-transform">Errei</button>
                <button onClick={(e) => { e.stopPropagation(); next(true); }} className="flex-1 py-3 rounded-xl bg-brand-100 text-brand-700 font-bold shadow-sm active:scale-95 transition-transform">Acertei</button>
            </div>
        </div>
    );
};

export default CardsView;