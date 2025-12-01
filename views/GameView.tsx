
import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem } from '../types';
import { useSpeech } from '../hooks/useSpeech';

interface GameViewProps {
    data: StudyItem[];
    onResult: (correct: boolean, word: string) => void;
}

const GameView: React.FC<GameViewProps> = ({ data, onResult }) => {
    const [pool, setPool] = useState<any[]>([]);
    const [selected, setSelected] = useState<any>(null); 
    const [matchedList, setMatchedList] = useState<any[]>([]);
    const [isWrong, setIsWrong] = useState(false);
    const speak = useSpeech();

    useEffect(() => {
        const initGame = () => {
            if (data.length === 0) return;

            try {
                const localStats = localStorage.getItem('mandarin_hsk_stats');
                const history = localStats ? JSON.parse(localStats).history : [];
                const today = new Date().toLocaleDateString('pt-BR');
                const recentErrors = history.filter((h: any) => h.date === today).map((h: any) => h.word);
                let uniqueErrors = [...new Set(recentErrors)];

                if (uniqueErrors.length < 4) {
                    const allKeywords = data.flatMap(s => s.keywords.map(k => ({...k, language: s.language || 'zh'})));
                    if (allKeywords.length === 0) return;
                    
                    const randomFill = allKeywords.sort(() => 0.5 - Math.random()).slice(0, 6).map(k => k.word);
                    uniqueErrors = [...new Set([...uniqueErrors as any, ...randomFill])];
                }

                let gameWords: any[] = [];
                data.forEach(sentence => {
                    sentence.keywords.forEach(kw => {
                        if (uniqueErrors.includes(kw.word)) {
                            if (!gameWords.find(gw => gw.word === kw.word)) {
                                gameWords.push({...kw, language: sentence.language || 'zh'});
                            }
                        }
                    });
                });

                gameWords = gameWords.slice(0, 6);
                let items: any[] = [];
                gameWords.forEach((item, index) => {
                    items.push({ id: `h-${index}`, wordId: item.word, content: item.word, type: 'hanzi', language: item.language });
                    items.push({ id: `t-${index}`, wordId: item.word, content: item.meaning, type: 'trans', language: item.language });
                });

                setPool(items.sort(() => 0.5 - Math.random()));
                setMatchedList([]);
            } catch (e) { console.error("Erro init jogo", e); }
        };
        initGame();
    }, [data]);

    const handleCardClick = (item: any) => {
        if (isWrong) return; 
        if (selected && selected.id === item.id) { setSelected(null); return; }

        if (!selected) {
            setSelected(item);
        } else {
            if (selected.wordId === item.wordId) {
                const hanziWord = selected.type === 'hanzi' ? selected.content : item.content;
                const transWord = selected.type === 'trans' ? selected.content : item.content;
                const lang = item.language || 'zh';
                onResult(true, hanziWord); 
                speak(hanziWord, lang);
                setMatchedList(prev => [...prev, { hanzi: hanziWord, trans: transWord, language: lang }]);
                setPool(prev => prev.filter(i => i.wordId !== item.wordId));
                setSelected(null);
            } else {
                const errorWord = selected.type === 'hanzi' ? selected.content : item.content;
                onResult(false, errorWord);
                setIsWrong(true);
                setTimeout(() => { setSelected(null); setIsWrong(false); }, 500);
            }
        }
    };

    if (data.length === 0) return <EmptyState msg="Adicione textos na Leitura para jogar." icon="gamepad-2" />;

    if (pool.length === 0 && matchedList.length === 0) return <EmptyState msg="Carregando jogo..." icon="gamepad-2" />;

    if (pool.length === 0 && matchedList.length > 0) {
        return (
            <div className="p-6 h-full flex flex-col items-center justify-center animate-pop">
                <div className="bg-brand-100 text-brand-600 p-6 rounded-full mb-6"><Icon name="trophy" size={48} /></div>
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Limpeza Concluída!</h2>
                <div className="w-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    {matchedList.map((m, i) => (<div key={i} className="flex justify-between p-4 border-b border-slate-50 last:border-0"><span className={`${m.language === 'de' ? 'font-sans' : 'font-chinese'} font-bold text-slate-800`}>{m.hanzi}</span><span className="text-slate-500 text-sm truncate max-w-[50%]">{m.trans}</span></div>))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 flex flex-col h-full pb-24">
            <div className="flex-none mb-4 min-h-[60px]">
                {matchedList.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">{matchedList.map((m, i) => (<div key={i} className="flex-none bg-brand-50 border border-brand-100 px-3 py-2 rounded-lg flex flex-col animate-pop"><span className={`${m.language === 'de' ? 'font-sans' : 'font-chinese'} font-bold text-brand-700 text-sm`}>{m.hanzi}</span></div>))}</div>
                ) : <p className="text-center text-slate-400 text-sm py-4 italic">Combine os pares...</p>}
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-2 gap-3 pb-4">
                    {pool.map((item) => (
                        <button key={item.id} onClick={() => handleCardClick(item)} className={`p-4 rounded-xl border-2 transition-all duration-200 min-h-[80px] flex items-center justify-center text-center shadow-sm relative overflow-hidden ${selected?.id === item.id ? (isWrong ? 'border-red-400 bg-red-50 animate-shake' : 'border-brand-500 bg-brand-50 -translate-y-1 shadow-md') : 'border-slate-200 bg-white hover:border-brand-200'}`}>
                            <span className={`${item.type === 'hanzi' ? (item.language === 'de' ? 'font-sans font-bold text-xl' : 'font-chinese text-2xl font-bold') : 'text-sm font-medium'} text-slate-700`}>{item.content}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GameView;
