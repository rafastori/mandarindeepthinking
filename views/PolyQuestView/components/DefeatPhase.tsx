import React, { useEffect } from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom } from '../types';
import { THEME, getPlayerColor } from '../theme';
import { audio } from '../audio';

interface Props {
    room: PolyQuestRoom;
    currentUserId: string;
    onResetGame: () => void;
    onSaveHistory: (result: any) => Promise<void>;
}

/** Tela de derrota — drama, score do jogador, retry. */
export const DefeatPhase: React.FC<Props> = ({ room, currentUserId, onResetGame, onSaveHistory }) => {
    const me = room.players.find(p => p.id === currentUserId);
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex(p => p.id === currentUserId) + 1;
    const discovered = room.enigmas.filter(e => e.isDiscovered).length;

    useEffect(() => {
        audio.defeat();
    }, []);

    useEffect(() => {
        if (me) {
            onSaveHistory({
                score: me.score,
                rank: myRank,
                totalPlayers: room.players.length,
                won: false,
                bossDefeated: false,
                wordsLearned: discovered,
                helpsGiven: me.helpCount || 0,
            });
        }
    }, [currentUserId]);

    return (
        <div className={`min-h-full ${THEME.bgDeep} -m-6 p-6 text-white flex items-center justify-center`}>
            <div className="max-w-md w-full text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-rose-900/40 border-4 border-rose-500 flex items-center justify-center animate-pulse">
                    <Icon name="skull" size={48} className="text-rose-400" />
                </div>
                <h1 className="text-4xl font-black text-rose-400 mb-2 tracking-tight">DERROTA</h1>
                <p className="text-white/60 text-sm mb-6">A party caiu antes de derrotar o boss…</p>

                <div className={`${THEME.bgPanel} rounded-2xl p-4 mb-4 border border-rose-500/30`}>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <Stat label="Pontos" value={me?.score || 0} color="text-amber-300" />
                        <Stat label="Palavras" value={discovered} color="text-emerald-300" />
                        <Stat label="Ajudas" value={me?.helpCount || 0} color="text-violet-300" />
                    </div>
                    <p className="text-xs text-white/60">
                        Você ficou em <span className="font-black text-white">#{myRank}</span> de {room.players.length}
                    </p>
                </div>

                <button
                    onClick={onResetGame}
                    className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-rose-500/40"
                >
                    <Icon name="rotate-ccw" size={20} /> Tentar Novamente
                </button>
            </div>
        </div>
    );
};

const Stat: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <div className="bg-black/30 rounded-lg p-2">
        <div className={`text-2xl font-black ${color}`}>{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">{label}</div>
    </div>
);
