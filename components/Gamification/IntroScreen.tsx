import React from 'react';
import { Flame, Trophy, Star, Play, Clock, Zap, ChevronRight } from 'lucide-react';
import { Stats } from '../../types';
import { LeaderboardEntry } from '../../hooks/useLeaderboard';

interface IntroScreenProps {
    stats: Stats;
    userName: string;
    userAvatar?: string;
    onStart: () => void;
    leaderboard: LeaderboardEntry[];
    userRank: number | null;
    currentUserId?: string;
    leaderboardLoading?: boolean;
}

const IntroScreen: React.FC<IntroScreenProps> = ({
    stats,
    userName,
    userAvatar,
    onStart,
    leaderboard,
    userRank,
    currentUserId,
    leaderboardLoading = false,
}) => {
    const streak = stats.streak || 0;
    const points = stats.points || 0;
    const totalTime = stats.totalTime || 0;
    const totalCorrect = stats.correct || 0;

    const formatTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    // Build smart leaderboard display:
    // - Always show 1st place
    // - Show user and neighbors (user-1, user, user+1)
    const getLeaderboardDisplay = () => {
        if (leaderboard.length === 0) return [];

        const display: { entry: LeaderboardEntry; rank: number; isCurrentUser: boolean }[] = [];
        const userIndex = currentUserId
            ? leaderboard.findIndex(e => e.odaUserId === currentUserId)
            : -1;

        // Always add 1st place
        if (leaderboard[0]) {
            display.push({
                entry: leaderboard[0],
                rank: 1,
                isCurrentUser: userIndex === 0
            });
        }

        // If user is in top 3, show top 4
        if (userIndex > 0 && userIndex <= 3) {
            for (let i = 1; i <= Math.min(3, leaderboard.length - 1); i++) {
                if (!display.find(d => d.rank === i + 1)) {
                    display.push({
                        entry: leaderboard[i],
                        rank: i + 1,
                        isCurrentUser: userIndex === i
                    });
                }
            }
        } else if (userIndex > 3) {
            // Add separator indicator and user's neighborhood
            const neighborStart = Math.max(1, userIndex - 1);
            const neighborEnd = Math.min(leaderboard.length - 1, userIndex + 1);

            for (let i = neighborStart; i <= neighborEnd; i++) {
                display.push({
                    entry: leaderboard[i],
                    rank: i + 1,
                    isCurrentUser: i === userIndex
                });
            }
        } else if (userIndex === -1 && leaderboard.length > 1) {
            // User not in leaderboard yet, show top 3
            for (let i = 1; i < Math.min(3, leaderboard.length); i++) {
                display.push({
                    entry: leaderboard[i],
                    rank: i + 1,
                    isCurrentUser: false
                });
            }
        }

        // Sort by rank
        return display.sort((a, b) => a.rank - b.rank);
    };

    const leaderboardDisplay = getLeaderboardDisplay();
    const showGap = userRank && userRank > 4;

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 z-50 flex flex-col items-center justify-center p-4 overflow-auto">
            {/* Decorative elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-10 left-10 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-20 right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>

            {/* User Info Card */}
            <div className="relative bg-white/10 backdrop-blur-lg rounded-3xl p-5 mb-4 w-full max-w-md border border-white/20 shadow-2xl">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg ring-4 ring-white/30">
                        {userAvatar || '🧑‍🎓'}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-white text-lg font-bold">{userName}</h2>
                        <div className="flex items-center gap-2 text-amber-300">
                            <Star className="w-4 h-4 fill-current" />
                            <span className="font-semibold">{points.toLocaleString()} pts</span>
                        </div>
                    </div>
                    {userRank && (
                        <div className="text-right">
                            <p className="text-slate-400 text-xs">Ranking</p>
                            <p className="text-white text-xl font-bold">#{userRank}</p>
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/5 rounded-xl p-2 text-center">
                        <Flame className={`w-5 h-5 mx-auto mb-1 ${streak > 0 ? 'text-orange-400' : 'text-slate-500'}`} />
                        <p className="text-lg font-bold text-white">{streak}</p>
                        <p className="text-[10px] text-slate-400">Ofensiva</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-2 text-center">
                        <Clock className="w-5 h-5 mx-auto mb-1 text-sky-400" />
                        <p className="text-lg font-bold text-white">{formatTime(totalTime)}</p>
                        <p className="text-[10px] text-slate-400">Tempo</p>
                    </div>

                    {/* Removed Correct Answers Card */}
                    <div className="bg-white/5 rounded-xl p-2 text-center">
                        <Star className="w-5 h-5 mx-auto mb-1 text-amber-400 fill-current" />
                        <p className="text-lg font-bold text-white">{points}</p>
                        <p className="text-[10px] text-slate-400">Pontos</p>
                    </div>
                </div>
            </div>

            {/* Leaderboard */}
            <div className="relative bg-white/10 backdrop-blur-lg rounded-3xl p-4 mb-4 w-full max-w-md border border-white/20">
                <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-white font-semibold">Ranking Global</h3>
                    {leaderboardLoading && (
                        <span className="text-xs text-slate-400 ml-auto">Carregando...</span>
                    )}
                </div>

                {leaderboard.length === 0 && !leaderboardLoading ? (
                    <p className="text-slate-400 text-center text-sm py-4">
                        Seja o primeiro no ranking!
                    </p>
                ) : (
                    <div className="space-y-2">
                        {leaderboardDisplay.map((item, idx) => {
                            const showDivider = idx > 0 && showGap && item.rank > 2 && leaderboardDisplay[idx - 1].rank === 1;

                            return (
                                <React.Fragment key={item.entry.odaUserId}>
                                    {showDivider && (
                                        <div className="text-center text-slate-500 text-sm py-1">
                                            ⋮
                                        </div>
                                    )}
                                    <div className={`flex items-center gap-3 rounded-xl p-2 transition-all ${item.isCurrentUser
                                        ? 'bg-indigo-500/30 border border-indigo-400/50 ring-2 ring-indigo-400/30'
                                        : item.rank === 1
                                            ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30'
                                            : 'bg-white/5'
                                        }`}>
                                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${item.rank === 1 ? 'bg-yellow-500 text-yellow-900' :
                                            item.rank === 2 ? 'bg-slate-300 text-slate-700' :
                                                item.rank === 3 ? 'bg-amber-600 text-amber-100' :
                                                    'bg-slate-600 text-slate-300'
                                            }`}>
                                            {item.rank}
                                        </span>
                                        <span className="text-xl">{item.entry.avatar || '👤'}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-medium truncate text-sm ${item.isCurrentUser ? 'text-indigo-200' : 'text-white'}`}>
                                                {item.entry.name}
                                                {item.isCurrentUser && <span className="text-xs ml-1 text-indigo-300">(você)</span>}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {formatTime(item.entry.totalTime)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-amber-300 font-bold">{item.entry.score.toLocaleString()}</span>
                                            <p className="text-[10px] text-slate-400">pts</p>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Streak Motivation */}
            {streak > 0 && (
                <div className="relative bg-gradient-to-r from-orange-500/30 to-red-500/30 backdrop-blur-lg rounded-2xl p-3 mb-4 w-full max-w-md border border-orange-400/30 flex items-center gap-3">
                    <Flame className="w-8 h-8 text-orange-400 animate-pulse" />
                    <div className="flex-1">
                        <p className="text-white font-bold text-sm">🔥 Ofensiva de {streak} dia{streak > 1 ? 's' : ''}!</p>
                        <p className="text-orange-200 text-xs">Continue assim para ganhar recompensas!</p>
                    </div>
                </div>
            )}

            {/* Start Button */}
            <button
                onClick={onStart}
                className="relative bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white px-8 py-3 rounded-full font-bold text-base shadow-2xl shadow-green-500/40 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
            >
                <Play className="w-5 h-5 fill-current" />
                Começar a Estudar
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
};

export default IntroScreen;
