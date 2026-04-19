import React, { useState } from 'react';
import { X, Clock, CheckCircle, XCircle, Star, Gift, Trophy, TrendingUp, ChevronRight, Volume2, Square, ArrowLeft } from 'lucide-react';
import { SessionStats, Achievement, InventoryItem, SupportedLanguage } from '../../types';
import { usePuterSpeech } from '../../hooks/usePuterSpeech';

export interface SessionErrorDetail {
    word: string;
    pinyin: string;
    meaning: string;
    language: SupportedLanguage;
    sourceId: string;
}

interface SessionSummaryProps {
    sessionStats: SessionStats;
    newAchievements: Achievement[];
    newInventoryItem: InventoryItem | null;
    onClose: () => void;
    errors?: SessionErrorDetail[];
    ignoredReviewWords?: string[];
    onToggleIgnore?: (word: string) => void;
}

const SessionSummary: React.FC<SessionSummaryProps> = ({
    sessionStats,
    newAchievements,
    newInventoryItem,
    onClose,
    errors = [],
    ignoredReviewWords = [],
    onToggleIgnore,
}) => {
    const [showErrorList, setShowErrorList] = useState(false);
    const { speak, stop, playingId } = usePuterSpeech();
    const canOpenErrors = errors.length > 0;
    const sessionDuration = sessionStats.endTime
        ? Math.floor((sessionStats.endTime - sessionStats.startTime) / 1000)
        : 0;

    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    };

    const tabTimeEntries = Object.entries(sessionStats.tabTime).filter(([, time]) => time > 0);

    const tabNames: Record<string, string> = {
        leitura: '📖 Leitura',
        revisao: '📝 Revisão',
        pratica: '🎯 Prática',
        jogo: '🎮 Jogos',
        lab: '🧪 Laboratório',
        cards: '🃏 Cards',
        pronuncia: '🎤 Pronúncia',
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-700 shadow-2xl max-h-[90vh] overflow-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-white text-xl font-bold flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                        Resumo da Sessão
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-2">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                        <Clock className="w-6 h-6 mx-auto mb-2 text-sky-400" />
                        <p className="text-2xl font-bold text-white">{formatTime(sessionDuration)}</p>
                        <p className="text-xs text-slate-400">Tempo de Estudo</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                        <Star className="w-6 h-6 mx-auto mb-2 text-amber-400" />
                        <p className="text-2xl font-bold text-white">+{sessionStats.pointsEarned}</p>
                        <p className="text-xs text-slate-400">Pontos</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                        <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-400" />
                        <p className="text-2xl font-bold text-white">{sessionStats.correctAnswers}</p>
                        <p className="text-xs text-slate-400">Acertos</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => canOpenErrors && setShowErrorList(true)}
                        disabled={!canOpenErrors}
                        className={`bg-white/5 rounded-xl p-4 text-center transition-all relative ${canOpenErrors ? 'hover:bg-white/10 hover:ring-2 hover:ring-red-400/40 cursor-pointer' : 'cursor-default opacity-90'}`}
                        title={canOpenErrors ? 'Ver erros desta sessão' : undefined}
                    >
                        <XCircle className="w-6 h-6 mx-auto mb-2 text-red-400" />
                        <p className="text-2xl font-bold text-white">{sessionStats.wrongAnswers}</p>
                        <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                            Erros
                            {canOpenErrors && <ChevronRight className="w-3 h-3 text-red-400" />}
                        </p>
                    </button>
                </div>

                {/* Tab Time Breakdown */}
                {tabTimeEntries.length > 0 && (
                    <div className="bg-white/5 rounded-xl p-4 mb-6">
                        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                            Tempo por Aba
                        </h3>
                        <div className="space-y-2">
                            {tabTimeEntries.map(([tab, time]) => (
                                <div key={tab} className="flex items-center justify-between">
                                    <span className="text-slate-300">{tabNames[tab] || tab}</span>
                                    <span className="text-white font-mono">{formatTime(time)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* New Achievements */}
                {newAchievements.length > 0 && (
                    <div className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-xl p-4 mb-6 border border-yellow-500/30">
                        <h3 className="text-yellow-300 font-semibold mb-3 flex items-center gap-2">
                            🏆 Conquistas Desbloqueadas!
                        </h3>
                        <div className="space-y-2">
                            {newAchievements.map(ach => (
                                <div key={ach.id} className="flex items-center gap-3 bg-white/10 rounded-lg p-2">
                                    <span className="text-2xl">{ach.icon}</span>
                                    <div>
                                        <p className="text-white font-medium">{ach.name}</p>
                                        <p className="text-slate-400 text-xs">{ach.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* New Inventory Item */}
                {newInventoryItem && (
                    <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 mb-6 border border-purple-500/30 text-center">
                        <Gift className="w-10 h-10 mx-auto mb-2 text-pink-400 animate-bounce" />
                        <h3 className="text-pink-300 font-semibold mb-1">Novo Item!</h3>
                        <div className="text-5xl my-3">{newInventoryItem.icon}</div>
                        <p className="text-white font-medium">{newInventoryItem.name}</p>
                        <p className="text-slate-400 text-xs">Recompensa de ofensiva semanal!</p>
                    </div>
                )}

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white py-3 rounded-xl font-bold transition-all"
                >
                    Fechar
                </button>
            </div>

            {showErrorList && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={() => { stop(); setShowErrorList(false); }}
                >
                    <div
                        className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 w-full max-w-md border border-slate-700 shadow-2xl max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <button
                                onClick={() => { stop(); setShowErrorList(false); }}
                                className="text-slate-400 hover:text-white p-2 -ml-2 flex items-center gap-1"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h2 className="text-white text-lg font-bold flex items-center gap-2">
                                <XCircle className="w-5 h-5 text-red-400" />
                                Erros da Sessão ({errors.length})
                            </h2>
                            <button
                                onClick={() => { stop(); setShowErrorList(false); }}
                                className="text-slate-400 hover:text-white p-2"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                            {errors.map((err, idx) => {
                                const audioId = `session-err-${idx}-${err.sourceId}`;
                                const isPlaying = playingId === audioId;
                                const isMarked = ignoredReviewWords.includes(err.word);
                                return (
                                    <div
                                        key={`${err.sourceId}-${idx}`}
                                        className="bg-white/5 hover:bg-white/10 rounded-xl p-3 flex items-center gap-3 transition-colors"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-semibold text-lg truncate">{err.word}</p>
                                            {err.pinyin && (
                                                <p className="text-brand-300 text-sm truncate">{err.pinyin}</p>
                                            )}
                                            {err.meaning && (
                                                <p className="text-slate-400 text-xs truncate">{err.meaning}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (isPlaying) stop();
                                                else speak(err.word, err.language, audioId);
                                            }}
                                            className={`p-2 rounded-full flex-shrink-0 transition-colors ${isPlaying ? 'bg-brand-600 text-white animate-pulse' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
                                            title="Ouvir pronúncia"
                                        >
                                            {isPlaying ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                        </button>
                                        {onToggleIgnore && (
                                            <button
                                                onClick={() => onToggleIgnore(err.word)}
                                                className={`p-2 rounded-full flex-shrink-0 transition-colors ${isMarked ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' : 'text-slate-300 hover:text-amber-400 hover:bg-white/10'}`}
                                                title={isMarked ? 'Remover da revisão' : 'Marcar para revisão'}
                                            >
                                                <Star className="w-4 h-4" fill={isMarked ? '#fbbf24' : 'none'} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => { stop(); setShowErrorList(false); }}
                            className="mt-4 w-full bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl font-semibold transition-all"
                        >
                            Voltar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SessionSummary;
