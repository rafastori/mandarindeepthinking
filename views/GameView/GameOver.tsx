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
    return (
        <div className="text-center py-20 animate-in zoom-in duration-300">
            <div className="bg-yellow-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
                <Icon name="trophy" size={48} className="text-yellow-600" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Vitória da Equipe!</h2>
            <p className="text-slate-500 mb-8">Vocês atingiram a meta de {room.targetScore} pontos!</p>
            
            <div className="bg-white p-6 rounded-xl shadow-lg mt-6 max-w-sm mx-auto">
                <h3 className="font-bold text-slate-700 mb-4 border-b pb-2">Top Contribuições</h3>
                {room.players
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((p, index) => (
                        <div key={p.id} className="flex justify-between items-center py-2">
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