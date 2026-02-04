import React, { useEffect, useRef } from 'react';
import { Trophy, X, Star, Clock, Flame } from 'lucide-react';
import { LeaderboardEntry } from '../../hooks/useLeaderboard';

interface LeaderboardModalProps {
    leaderboard: LeaderboardEntry[];
    currentUserId?: string;
    userRank: number | null;
    onClose: () => void;
}

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
    leaderboard,
    currentUserId,
    userRank,
    onClose,
}) => {
    const userRowRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to user's position on mount
    useEffect(() => {
        if (userRowRef.current && scrollContainerRef.current) {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                userRowRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }, 100);
        }
    }, []);

    const formatTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    const getRankBadge = (rank: number) => {
        if (rank === 1) return { bg: 'bg-yellow-500', text: 'text-yellow-900', emoji: '🥇' };
        if (rank === 2) return { bg: 'bg-slate-300', text: 'text-slate-700', emoji: '🥈' };
        if (rank === 3) return { bg: 'bg-amber-600', text: 'text-amber-100', emoji: '🥉' };
        return { bg: 'bg-slate-600', text: 'text-slate-300', emoji: null };
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl w-full max-w-lg max-h-[80vh] overflow-hidden border border-white/20 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 backdrop-blur-xl border-b border-white/10 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Trophy className="w-6 h-6 text-yellow-400" />
                            <h2 className="text-xl font-bold text-white">Ranking Global</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5 text-white/70" />
                        </button>
                    </div>
                    {userRank && (
                        <p className="text-sm text-amber-300 mt-1">
                            Sua posição: <span className="font-bold">#{userRank}</span> de {leaderboard.length}
                        </p>
                    )}
                </div>

                {/* Scrollable List */}
                <div
                    ref={scrollContainerRef}
                    className="overflow-y-auto max-h-[calc(80vh-100px)] p-4 space-y-2"
                >
                    {leaderboard.length === 0 ? (
                        <p className="text-center text-slate-400 py-8">
                            Nenhum jogador no ranking ainda. Seja o primeiro!
                        </p>
                    ) : (
                        leaderboard.map((entry, index) => {
                            const rank = index + 1;
                            const isCurrentUser = entry.odaUserId === currentUserId;
                            const { bg, text, emoji } = getRankBadge(rank);

                            return (
                                <div
                                    key={entry.odaUserId}
                                    ref={isCurrentUser ? userRowRef : null}
                                    className={`flex items-center gap-3 rounded-2xl p-3 transition-all ${isCurrentUser
                                            ? 'bg-gradient-to-r from-indigo-600/50 via-purple-600/50 to-indigo-600/50 border-2 border-indigo-400 ring-4 ring-indigo-500/30 scale-[1.02]'
                                            : rank <= 3
                                                ? 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30'
                                                : 'bg-white/5 border border-white/10'
                                        }`}
                                >
                                    {/* Rank Badge */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${bg} ${text}`}>
                                        {emoji || rank}
                                    </div>

                                    {/* Avatar */}
                                    <span className="text-2xl">{entry.avatar || '👤'}</span>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-semibold truncate ${isCurrentUser ? 'text-white' : 'text-white/90'}`}>
                                            {entry.name}
                                            {isCurrentUser && (
                                                <span className="ml-2 text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                                                    Você
                                                </span>
                                            )}
                                        </p>
                                        <div className="flex items-center gap-3 text-xs text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatTime(entry.totalTime)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Flame className="w-3 h-3 text-orange-400" />
                                                {entry.streak || 0} dias
                                            </span>
                                        </div>
                                    </div>

                                    {/* Score */}
                                    <div className="text-right">
                                        <div className="flex items-center gap-1">
                                            <Star className={`w-4 h-4 fill-current ${isCurrentUser ? 'text-yellow-300' : 'text-amber-400'}`} />
                                            <span className={`font-bold ${isCurrentUser ? 'text-yellow-300 text-lg' : 'text-amber-300'}`}>
                                                {entry.score.toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500">pontos</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeaderboardModal;
