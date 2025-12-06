import React from 'react';
import Icon from '../../components/Icon';
import { GameRoom, GameCard } from '../../types';
import { User } from 'firebase/auth';

interface ActiveGameProps {
    room: GameRoom;
    user: User;
    onSubmit: (known: boolean) => void;
}

export const ActiveGame: React.FC<ActiveGameProps> = ({ room, user, onSubmit }) => {
    const isGerman = room.config?.lang === 'de';
    
    // MUDANÇA: Todos olham para a mesma carta baseada no índice da rodada
    const getCurrentUserCard = (): GameCard | null => {
        const currentCardIndex = room.currentCardIndex || 0;
        
        // Se o índice for maior que o baralho, retornamos null (vai acionar o refill ou fim)
        if (currentCardIndex >= room.deck.length) return null;
        
        return room.deck[currentCardIndex];
    };

    const myCard = getCurrentUserCard();
    const myAnswer = room.roundAnswers?.[user.uid];
    const hasAnswered = myAnswer !== undefined;

    return (
        <div className="text-center animate-in fade-in slide-in-from-bottom-4 relative">
            
            {/* Overlay de Regeneração */}
            {room.status === 'regenerating' && (
                <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl">
                    <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
                    <h3 className="text-xl font-bold text-slate-800">Recarregando Baralho...</h3>
                    <p className="text-slate-500 text-sm mt-2">A IA está criando mais desafios!</p>
                </div>
            )}

            {hasAnswered ? (
                <div className="py-12">
                    <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Icon name="clock" size={40} className="text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">Resposta Enviada!</h3>
                    <p className="text-slate-500 mb-8">Aguardando a equipe...</p>
                    
                    <div className="max-w-xs mx-auto bg-white p-4 rounded-xl border border-slate-100">
                        <div className="space-y-2">
                            {room.players.map(p => {
                                const done = room.roundAnswers?.[p.id] !== undefined;
                                return (
                                    <div key={p.id} className="flex justify-between items-center text-sm">
                                        <span className={done ? 'text-slate-400' : 'text-slate-800 font-bold'}>{p.name}</span>
                                        {done 
                                            ? <Icon name="check" size={16} className="text-green-500" />
                                            : <span className="text-orange-400 text-xs animate-pulse">Pensando...</span>
                                        }
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : myCard ? (
                <>
                    {/* Card Principal */}
                    <div className="w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200 transition-all min-h-[350px] flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-brand-500"></div>
                        <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-4">
                            Desafio da Equipe {/* Texto alterado para refletir que é coletivo */}
                        </p>
                        
                        <div className="py-4">
                            <p className={`text-5xl font-extrabold text-slate-800 mb-3 ${isGerman ? 'font-sans' : 'font-chinese'}`}>
                                {myCard.word}
                            </p>
                            <p className="text-2xl text-brand-600 font-medium">
                                {myCard.pinyin}
                            </p>
                        </div>

                        <div className="pt-6 border-t border-slate-100 mt-2">
                            <p className="text-lg font-medium text-slate-700">{myCard.meaning}</p>
                            <p className="text-sm text-slate-400 italic mt-2">"{myCard.example}"</p>
                        </div>
                    </div>

                    {/* Botões */}
                    <div className="flex gap-4 mt-8">
                        <button 
                            onClick={() => onSubmit(false)} 
                            className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-2xl shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
                        >
                            <Icon name="x" size={24} className="mb-1 mx-auto block" /> 
                            Não sei
                        </button>
                        <button 
                            onClick={() => onSubmit(true)} 
                            className="flex-1 py-4 bg-brand-600 text-white font-bold rounded-2xl shadow-lg shadow-brand-200 hover:bg-brand-700 active:scale-95 transition-all"
                        >
                            <Icon name="check" size={24} className="mb-1 mx-auto block" /> 
                            Sei!
                        </button>
                    </div>
                </>
            ) : (
                <div className="p-10 text-slate-400">Preparando próxima carta...</div>
            )}
        </div>
    );
};