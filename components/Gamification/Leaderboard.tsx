import React from 'react';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardEntry {
    name: string;
    score: number;
    avatar?: string;
    isCurrentUser?: boolean;
}

interface LeaderboardProps {
    entries: LeaderboardEntry[];
    currentUserRank?: number;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ entries, currentUserRank }) => {
    const getMedalIcon = (rank: number) => {
        switch (rank) {
            case 1: return <Trophy className="w-5 h-5 text-yellow-400" />;
            case 2: return <Medal className="w-5 h-5 text-slate-300" />;
            case 3: return <Award className="w-5 h-5 text-amber-600" />;
            default: return null;
        }
    };

    const getRankStyle = (rank: number) => {
        switch (rank) {
            case 1: return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
            case 2: return 'bg-gradient-to-r from-slate-400/20 to-slate-500/20 border-slate-400/30';
            case 3: return 'bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-amber-600/30';
            default: return 'bg-white/5 border-white/10';
        }
    };

    return (
        <div className="space-y-2">
            {entries.map((entry, idx) => {
                const rank = idx + 1;
                return (
                    <div
                        key={idx}
                        className={`flex items-center gap-3 rounded-xl p-3 border ${getRankStyle(rank)} ${entry.isCurrentUser ? 'ring-2 ring-indigo-500' : ''
                            }`}
                    >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 text-white font-bold text-sm">
                            {getMedalIcon(rank) || rank}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xl">
                            {entry.avatar || '👤'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${entry.isCurrentUser ? 'text-indigo-300' : 'text-white'}`}>
                                {entry.name}
                                {entry.isCurrentUser && <span className="text-xs ml-2">(você)</span>}
                            </p>
                        </div>
                        <div className="text-amber-300 font-bold">
                            {entry.score.toLocaleString()}
                        </div>
                    </div>
                );
            })}

            {currentUserRank && currentUserRank > entries.length && (
                <div className="text-center text-slate-400 py-2 text-sm">
                    ...
                    <br />
                    Sua posição: <span className="text-white font-bold">#{currentUserRank}</span>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;
