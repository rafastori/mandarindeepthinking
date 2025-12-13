import React from 'react';
import Icon from '../../components/Icon';
import { GameRoom } from '../../types';

interface GameOverProps {
    room: GameRoom;
    isHost: boolean;
    onRestart: () => void;
    onDelete: () => void;
}

export const GameOver: React.FC<GameOverProps> = ({ room, isHost, onRestart, onDelete }) => {
    // Lógica de Vitória ou Derrota baseada no score
    const isVictory = (room.teamScore || 0) > 0;

    return (
        <div className="text-center py-20 animate-in zoom-in duration-300">
            
            {/* Ícone Dinâmico */}
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ${isVictory ? 'bg-yellow-100' : 'bg-red-100'}`}>
                <Icon 
                    name={isVictory ? "trophy" : "slash"} 
                    size={48} 
                    className={isVictory ? "text-yellow-600" : "text-red-500"} 
                />
            </div>

            {/* Título Dinâmico */}
            <h2 className="text-3xl font-extrabold text-slate-800 mb-2">
                {isVictory ? "Vitória da Equipe!" : "Game Over"}
            </h2>
            
            <p className="text-slate-500 mb-8 max-w-xs mx-auto">
                {isVictory 
                    ? `Vocês atingiram a meta de ${room.targetScore} pontos!` 
                    : "A pontuação da equipe chegou a zero (ou menos). Tente novamente!"
                }
            </p>
            
            {/* Placar Final */}
            <div className="bg-white p-6 rounded-xl shadow-lg mt-6 max-w-sm mx-auto border border-slate-100">
                <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase">Pontuação Final</span>
                    <span className={`text-2xl font-black ${isVictory ? 'text-green-600' : 'text-red-600'}`}>
                        {room.teamScore}
                    </span>
                </div>

                <h3 className="font-bold text-slate-700 mb-4 text-left text-sm">Contribuições</h3>
                {room.players
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((p, index) => (
                        <div key={p.id} className="flex justify-between items-center py-2 text-sm">
                            <span className={`font-medium ${index===0 ? 'text-brand-600' : 'text-slate-600'}`}>
                                {index === 0 && '👑 '} {p.name}
                            </span>
                            <span className="font-bold text-slate-800">{p.score} pts</span>
                        </div>
                    ))}
            </div>
            
            {isHost ? (
                <div className="mt-10 space-y-3">
                    <button onClick={onRestart} className="w-full bg-brand-600 text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:bg-brand-700 active:scale-95 transition-all">
                        Jogar Novamente
                    </button>
                    <button onClick={onDelete} className="w-full text-slate-400 hover:text-red-500 font-bold py-2 text-sm">
                        Encerrar Sala
                    </button>
                </div>
            ) : (
                <p className="mt-10 text-slate-400 italic">Aguardando Host reiniciar...</p>
            )}
        </div>
    );
};