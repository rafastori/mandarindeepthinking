import React from 'react';
import Icon from '../../../components/Icon';
import FlagSelect from '../../../components/FlagSelect';
import { STUDY_LANGUAGES, SupportedLanguage } from '../../../types';
import { DominoRoom, DominoConfig, CONTEXT_OPTIONS, DOMINO_CONSTANTS } from '../types';

// Lista completa incluindo Português para tradução
const ALL_LANGUAGES = [
    ...STUDY_LANGUAGES,
    { code: 'pt' as SupportedLanguage, name: 'Português', flag: '🇧🇷', isoCode: 'br' }
];

interface DominoLobbyProps {
    room: DominoRoom;
    isHost: boolean;
    currentUserId: string;
    onToggleReady: (ready: boolean) => void;
    onUpdateConfig: (config: Partial<DominoConfig>) => void;
    onStartGame: (configOverride?: Partial<DominoConfig>) => Promise<void> | void;
    onLeaveRoom: () => void;
    onDeleteRoom: () => void;
    onAddBot?: () => void;
    onRemoveBot?: (botId: string) => void;
}

export const DominoLobby: React.FC<DominoLobbyProps> = ({
    room,
    isHost,
    currentUserId,
    onToggleReady,
    onUpdateConfig,
    onStartGame,
    onLeaveRoom,
    onDeleteRoom,
    onAddBot,
    onRemoveBot
}) => {
    const [isStarting, setIsStarting] = React.useState(false);
    // Estado local para inputs de texto (evita lag ao digitar)
    const [localCustomContext, setLocalCustomContext] = React.useState(room.config.customContext || '');
    const [localCustomTopic, setLocalCustomTopic] = React.useState(room.config.customTopic || '');

    const handleStart = async () => {
        setIsStarting(true);
        try {
            // Passa o config diretamente para startGame (sem depender do Firebase)
            console.log('[DominoLobby] Starting with config:', {
                customContext: localCustomContext,
                customTopic: localCustomTopic
            });

            await onStartGame({
                customContext: localCustomContext || undefined,
                customTopic: localCustomTopic || undefined
            });
        } catch (error) {
            console.error(error);
            setIsStarting(false);
        }
    };

    const currentUserReady = room.players.find(p => p.id === currentUserId)?.isReady || false;
    const allReady = room.players.every(p => p.isReady || p.id === room.hostId);
    const canStart = room.players.length >= DOMINO_CONSTANTS.MIN_PLAYERS && allReady;

    return (
        <div className="max-w-2xl mx-auto p-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white mb-6 shadow-xl">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            🎲 {room.name}
                        </h1>
                        <p className="text-orange-100 mt-1">
                            {room.players.length}/{DOMINO_CONSTANTS.MAX_PLAYERS} jogadores
                        </p>
                    </div>
                    <button
                        onClick={onLeaveRoom}
                        className="p-2 bg-white/20 rounded-lg hover:bg-white/30"
                    >
                        <Icon name="log-out" size={20} />
                    </button>
                </div>
            </div>

            {/* Players */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <Icon name="users" size={14} /> Jogadores
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {room.players.map(player => (
                        <div
                            key={player.id}
                            className={`flex items-center gap-3 p-3 rounded-lg ${player.isReady ? 'bg-green-50 border border-green-200' : 'bg-slate-50'
                                }`}
                        >
                            {player.avatarUrl ? (
                                <img
                                    src={player.avatarUrl}
                                    alt={player.name}
                                    className="w-10 h-10 rounded-full"
                                />
                            ) : (
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${player.isBot
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-brand-100 text-brand-700'
                                    }`}>
                                    {player.isBot ? <Icon name="bot" size={20} /> : player.name.charAt(0)}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                    <p className="font-bold text-slate-700 truncate">{player.name}</p>
                                    {player.isBot && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">BOT</span>}
                                </div>
                                {player.id === room.hostId && (
                                    <p className="text-xs text-orange-600 font-medium">Host</p>
                                )}
                            </div>
                            {player.isReady && !player.isBot && (
                                <Icon name="check-circle" className="text-green-500" size={20} />
                            )}
                            {isHost && player.isBot && onRemoveBot && (
                                <button
                                    onClick={() => onRemoveBot(player.id)}
                                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remover Bot"
                                >
                                    <Icon name="trash-2" size={16} />
                                </button>
                            )}
                        </div>
                    ))}

                    {isHost && room.players.length < DOMINO_CONSTANTS.MAX_PLAYERS && onAddBot && (
                        <button
                            onClick={onAddBot}
                            className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-purple-100 flex items-center justify-center transition-colors">
                                <Icon name="plus" size={20} />
                            </div>
                            <span className="font-medium">Adicionar Bot</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Config */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Icon name="settings" size={20} className="text-brand-500" />
                    Configuração
                </h3>

                {isHost ? (
                    <div className="space-y-4">
                        {/* Contexto */}
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                                Contexto
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {CONTEXT_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => onUpdateConfig({ context: opt.value })}
                                        className={`p-3 rounded-lg text-center transition-all ${room.config.context === opt.value
                                            ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-500'
                                            : 'bg-slate-50 hover:bg-slate-100'
                                            }`}
                                    >
                                        <span className="text-xl block mb-1">{opt.icon}</span>
                                        <span className="text-xs font-medium">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Idiomas (se contexto = language) */}
                        {room.config.context === 'language' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                                        Idioma de Origem
                                    </label>
                                    <FlagSelect
                                        options={STUDY_LANGUAGES}
                                        value={room.config.sourceLang || 'de'}
                                        onChange={(val) => onUpdateConfig({ sourceLang: val as SupportedLanguage })}
                                        placeholder="Selecione"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                                        Traduzir para
                                    </label>
                                    <FlagSelect
                                        options={ALL_LANGUAGES}
                                        value={room.config.targetLang || 'pt'}
                                        onChange={(val) => onUpdateConfig({ targetLang: val as SupportedLanguage })}
                                        placeholder="Selecione"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Tópico Personalizado (só para modo custom) */}
                        {room.config.context === 'custom' && (
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                                    Tópico Personalizado
                                </label>
                                <input
                                    type="text"
                                    value={localCustomTopic}
                                    onChange={(e) => setLocalCustomTopic(e.target.value)}
                                    placeholder="Ex: Anatomia Humana, React Hooks, etc."
                                    className="w-full p-3 border rounded-xl"
                                />
                            </div>
                        )}

                        {/* Contexto Adicional (disponível para TODOS os modos) */}
                        {room.config.context !== 'custom' && (
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                                    Especificar Contexto (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={localCustomContext}
                                    onChange={(e) => setLocalCustomContext(e.target.value)}
                                    placeholder={
                                        room.config.context === 'chemistry' ? 'Ex: Tabela periódica, Química orgânica...' :
                                            room.config.context === 'medicine' ? 'Ex: Cardiologia, Farmacologia...' :
                                                room.config.context === 'computing' ? 'Ex: React, Python, Banco de dados...' :
                                                    room.config.context === 'engineering' ? 'Ex: Elétrica, Mecânica, Civil...' :
                                                        room.config.context === 'biology' ? 'Ex: Genética, Botânica, Zoologia...' :
                                                            room.config.context === 'law' ? 'Ex: Direito Civil, Penal, Trabalhista...' :
                                                                room.config.context === 'language' ? 'Ex: Verbos, Comida, Viagem...' :
                                                                    'Ex: Tema específico...'
                                    }
                                    className="w-full p-3 border rounded-xl bg-slate-50"
                                />
                            </div>
                        )}

                        {/* Dificuldade */}
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">
                                Dificuldade
                            </label>
                            <div className="flex gap-2">
                                {['Iniciante', 'Intermediário', 'Avançado'].map(diff => (
                                    <button
                                        key={diff}
                                        onClick={() => onUpdateConfig({ difficulty: diff as any })}
                                        className={`flex-1 py-2 rounded-lg font-medium transition-all ${room.config.difficulty === diff
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-slate-100 hover:bg-slate-200'
                                            }`}
                                    >
                                        {diff}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Botão Iniciar */}
                        <button
                            onClick={handleStart}
                            disabled={!canStart || isStarting}
                            className={`w-full py-4 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all
                                ${isStarting ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-red-500'}
                            `}
                        >
                            {isStarting ? (
                                <>
                                    <Icon name="loader" size={20} className="animate-spin" />
                                    Criando...
                                </>
                            ) : (
                                <>
                                    <Icon name="play" size={20} />
                                    Iniciar Jogo
                                </>
                            )}
                        </button>
                        {room.players.length < DOMINO_CONSTANTS.MIN_PLAYERS && (
                            <p className="text-center text-red-500 text-xs">
                                Mínimo {DOMINO_CONSTANTS.MIN_PLAYERS} jogadores
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <Icon name="clock" size={48} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-600 font-medium">Aguardando Host iniciar...</p>
                        <div className="mt-4 p-4 bg-slate-50 rounded-xl text-left inline-block">
                            <p className="text-xs text-slate-400 uppercase font-bold mb-2">Config Atual</p>
                            <p className="text-sm">Contexto: <b>{room.config.context}</b></p>
                            <p className="text-sm">Dificuldade: <b>{room.config.difficulty}</b></p>
                        </div>
                    </div>
                )}
            </div>

            {/* Ready Button (non-host) */}
            {!isHost && (
                <button
                    onClick={() => onToggleReady(!currentUserReady)}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 ${currentUserReady
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                >
                    <Icon name={currentUserReady ? 'check-circle' : 'circle'} size={20} />
                    {currentUserReady ? 'Pronto!' : 'Marcar como Pronto'}
                </button>
            )}

            {/* Delete Room (host only) */}
            {isHost && (
                <button
                    onClick={onDeleteRoom}
                    className="w-full mt-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-medium"
                >
                    Deletar Sala
                </button>
            )}
        </div>
    );
};
