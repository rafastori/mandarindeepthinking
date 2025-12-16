import React, { useState } from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom, SUPPORTED_LANGUAGES, GAME_CONSTANTS } from '../types';
import { validateText } from '../utils';

interface PolyQuestLobbyProps {
    room: PolyQuestRoom;
    isHost: boolean;
    currentUserId: string;
    onToggleReady: () => void;
    onUpdateConfig: (sourceLang: string, targetLang: string, text: string) => void;
    onStartGame: () => void;
    onLeaveRoom: () => void;
}

export const PolyQuestLobby: React.FC<PolyQuestLobbyProps> = ({
    room,
    isHost,
    currentUserId,
    onToggleReady,
    onUpdateConfig,
    onStartGame,
    onLeaveRoom,
}) => {
    const [sourceLang, setSourceLang] = useState(room.config.sourceLang);
    const [targetLang, setTargetLang] = useState(room.config.targetLang);
    const [text, setText] = useState(room.config.originalText);

    const currentPlayer = room.players.find(p => p.id === currentUserId);
    const allReady = room.players.every(p => p.isReady);
    const validation = validateText(text, GAME_CONSTANTS.MIN_WORDS);

    const handleConfigChange = () => {
        if (isHost && validation.valid) {
            onUpdateConfig(sourceLang, targetLang, text);
        }
    };

    // Auto-update config quando mudar (debounce seria ideal, mas simplificando)
    React.useEffect(() => {
        if (isHost) {
            const timer = setTimeout(() => {
                handleConfigChange();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [sourceLang, targetLang, text]);

    const canStart = isHost && allReady && validation.valid && room.players.length > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-emerald-200">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center">
                            <Icon name="users" size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">{room.name}</h2>
                            <p className="text-sm text-slate-500">
                                {isHost ? '👑 Você é o Host' : `Host: ${room.players.find(p => p.id === room.hostId)?.name}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onLeaveRoom}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-colors"
                    >
                        Sair
                    </button>
                </div>

                {/* Jogadores */}
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">
                        Jogadores ({room.players.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {room.players.map(player => (
                            <div
                                key={player.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${player.isReady
                                        ? 'bg-emerald-50 border-emerald-200'
                                        : 'bg-slate-50 border-slate-200'
                                    }`}
                            >
                                {player.avatarUrl && (
                                    <img
                                        src={player.avatarUrl}
                                        alt={player.name}
                                        className="w-10 h-10 rounded-full"
                                    />
                                )}
                                <div className="flex-1">
                                    <p className="font-semibold text-slate-800 flex items-center gap-2">
                                        {player.name}
                                        {player.id === room.hostId && (
                                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                                                Host
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {player.isReady ? '✅ Pronto' : '⏳ Aguardando'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Configuração */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">⚙️ Configuração do Jogo</h3>

                <div className="space-y-4">
                    {/* Idiomas */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Idioma de Origem
                            </label>
                            <select
                                value={sourceLang}
                                onChange={(e) => setSourceLang(e.target.value)}
                                disabled={!isHost}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            >
                                {SUPPORTED_LANGUAGES.map(lang => (
                                    <option key={lang.code} value={lang.code}>
                                        {lang.flag} {lang.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Idioma de Destino
                            </label>
                            <select
                                value={targetLang}
                                onChange={(e) => setTargetLang(e.target.value)}
                                disabled={!isHost}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            >
                                {SUPPORTED_LANGUAGES.map(lang => (
                                    <option key={lang.code} value={lang.code}>
                                        {lang.flag} {lang.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Texto Base */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-semibold text-slate-700">
                                Texto Base
                            </label>
                            <span className={`text-xs font-semibold ${validation.valid ? 'text-emerald-600' : 'text-red-600'
                                }`}>
                                {validation.wordCount} / {GAME_CONSTANTS.MIN_WORDS} palavras
                            </span>
                        </div>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            disabled={!isHost}
                            rows={6}
                            placeholder={`Cole aqui o texto em ${SUPPORTED_LANGUAGES.find(l => l.code === sourceLang)?.name || sourceLang}...`}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed resize-none"
                        />
                        {!validation.valid && validation.error && (
                            <p className="text-xs text-red-600 mt-1">{validation.error}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Ações */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                        {!allReady && (
                            <p className="text-sm text-slate-600">
                                <Icon name="info" size={16} className="inline mr-1" />
                                Todos os jogadores devem estar prontos para iniciar
                            </p>
                        )}
                        {allReady && !validation.valid && isHost && (
                            <p className="text-sm text-red-600">
                                <Icon name="alert-circle" size={16} className="inline mr-1" />
                                Configure um texto válido para iniciar
                            </p>
                        )}
                        {canStart && (
                            <p className="text-sm text-emerald-600 font-semibold">
                                <Icon name="check-circle" size={16} className="inline mr-1" />
                                Tudo pronto! Pode iniciar o jogo
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Botão Pronto */}
                        <button
                            onClick={onToggleReady}
                            className={`px-6 py-3 rounded-lg font-semibold transition-all ${currentPlayer?.isReady
                                    ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            {currentPlayer?.isReady ? '❌ Cancelar' : '✅ Estou Pronto'}
                        </button>

                        {/* Botão Iniciar (apenas host) */}
                        {isHost && (
                            <button
                                onClick={onStartGame}
                                disabled={!canStart}
                                className="px-8 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                <Icon name="play" size={20} />
                                <span>Iniciar Jogo</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
