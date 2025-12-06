import React, { useMemo } from 'react';
import Icon from '../../components/Icon';
import { GameRoom, GameCard } from '../../types';
import { User } from 'firebase/auth';

interface ActiveGameProps {
    room: GameRoom;
    user: User;
    // Agora enviamos o TIPO de resultado, não apenas boolean
    onResult: (result: 'CORRECT' | 'WRONG' | 'PASS' | 'GRAB') => void;
}

export const ActiveGame: React.FC<ActiveGameProps> = ({ room, user, onResult }) => {
    const isGerman = room.config?.lang === 'de';
    
    // 1. Descobre qual carta está na mão deste usuário específico
    const myCardIndex = room.activeHands?.[user.uid];
    const hasCard = myCardIndex !== undefined && myCardIndex !== null;
    const myCard = hasCard ? room.deck[myCardIndex] : null;

    // 2. Mistura as opções (Correta + Distratores) apenas quando a carta muda
    const shuffledOptions = useMemo(() => {
        if (!myCard) return [];
        
        const correct = myCard.meaning;
        const distractors = myCard.distractors || [];
        // Pega até 3 distratores (caso a IA mande mais)
        const options = [correct, ...distractors.slice(0, 3)];
        
        // Embaralha
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        return options;
    }, [myCard?.word]); // Só re-embaralha se a palavra mudar

    // 3. Verifica a resposta
    const handleOptionClick = (selectedOption: string) => {
        if (!myCard) return;
        if (selectedOption === myCard.meaning) {
            onResult('CORRECT');
        } else {
            onResult('WRONG');
        }
    };

    return (
        <div className="text-center animate-in fade-in slide-in-from-bottom-4 relative pb-10">
            
            {/* Placar Flutuante */}
            <div className="mb-6 inline-flex items-center gap-4 bg-white px-6 py-2 rounded-full shadow-sm border border-slate-100">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pontos</span>
                    <span className={`text-xl font-black ${room.teamScore < 0 ? 'text-red-500' : 'text-brand-600'}`}>
                        {room.teamScore}
                    </span>
                </div>
                <div className="h-8 w-px bg-slate-200"></div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Meta</span>
                    <span className="text-xl font-bold text-slate-700">{room.targetScore}</span>
                </div>
            </div>

            {/* CENA 1: Usuário sem carta (Precisa pegar uma) */}
            {!myCard && (
                <div className="py-12 flex flex-col items-center">
                    <div className="w-24 h-32 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center mb-6 shadow-sm rotate-3">
                        <Icon name="plus" className="text-slate-300" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">Sua vez de jogar!</h3>
                    <p className="text-slate-500 mb-8 max-w-xs">Pegue uma carta do monte para ajudar a equipe.</p>
                    
                    <button 
                        onClick={() => onResult('GRAB')}
                        className="bg-brand-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Icon name="layers" size={20} />
                        Pegar Carta
                    </button>
                </div>
            )}

            {/* CENA 2: Usuário com carta (Quiz) */}
            {myCard && (
                <div className="max-w-sm mx-auto">
                    {/* Cartão da Palavra */}
                    <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200 mb-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-brand-500"></div>
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded">Mandarim</span>
                            <button onClick={() => onResult('PASS')} className="text-xs font-bold text-slate-400 hover:text-brand-600 flex items-center gap-1 transition-colors">
                                Pular <Icon name="skip-forward" size={12} />
                            </button>
                        </div>
                        
                        <div className="py-2">
                            <p className={`text-4xl font-extrabold text-slate-800 mb-2 ${isGerman ? 'font-sans' : 'font-chinese'}`}>
                                {myCard.word}
                            </p>
                            <p className="text-lg text-brand-600 font-medium">
                                {myCard.pinyin}
                            </p>
                        </div>
                    </div>

                    {/* Opções de Resposta */}
                    <div className="grid gap-3">
                        {shuffledOptions.map((option, idx) => (
                            <button 
                                key={idx}
                                onClick={() => handleOptionClick(option)}
                                className="w-full bg-white p-4 rounded-xl border-2 border-slate-100 font-bold text-slate-600 shadow-sm hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 active:scale-95 transition-all text-sm"
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                    
                    <p className="text-xs text-slate-400 mt-6 text-center">
                        Acerto: +1 | Erro: -3 | Pular: 0
                    </p>
                </div>
            )}
        </div>
    );
};