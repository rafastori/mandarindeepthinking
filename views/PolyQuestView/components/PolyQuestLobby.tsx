import React, { useState, useEffect } from 'react';
import Icon from '../../../components/Icon';
import FlagSelect from '../../../components/FlagSelect';
import { PolyQuestRoom, SUPPORTED_LANGUAGES, PlayerClass, PLAYER_CLASSES, BotLevel, BOT_LEVEL_CONFIG } from '../types';
import { RULES } from '../rules';
import { validateText } from '../utils';
import { GameContentSelectorModal } from '../../DominoView/components/GameContentSelectorModal';
import { useStudyItems } from '../../../hooks/useStudyItems';
import { THEME, getPlayerColor } from '../theme';
import ClassPicker from './ClassPicker';
import AudioToggle from './AudioToggle';
import { audio } from '../audio';

interface Props {
    room: PolyQuestRoom;
    isHost: boolean;
    currentUserId: string;
    onToggleReady: () => void;
    onSelectClass: (cls: PlayerClass) => void;
    onUpdateConfig: (sourceLang: string, targetLang: string, text: string, difficulty: string, context?: string, selectedFolderIds?: string[]) => void;
    onStartGame: () => void;
    onLeaveRoom: () => void;
    onDeleteRoom: () => void;
    onAddBot: (level: BotLevel) => void;
    onKickPlayer: (playerId: string) => void;
}

export const PolyQuestLobby: React.FC<Props> = ({
    room, isHost, currentUserId, onToggleReady, onSelectClass,
    onUpdateConfig, onStartGame, onLeaveRoom, onDeleteRoom,
    onAddBot, onKickPlayer,
}) => {
    const [botLevel, setBotLevel] = useState<BotLevel>('medium');
    const [showBotMenu, setShowBotMenu] = useState(false);
    const [sourceLang, setSourceLang] = useState(room.config.sourceLang);
    const [targetLang, setTargetLang] = useState(room.config.targetLang);
    const [text, setText] = useState(room.config.originalText);
    const [difficulty, setDifficulty] = useState(room.config.difficulty || 'Iniciante');
    const [context, setContext] = useState(room.config.context || 'library');
    const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>(room.config.selectedFolderIds || []);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

    const { items: libraryItems } = useStudyItems(currentUserId);

    const currentPlayer = room.players.find(p => p.id === currentUserId);
    const allReady = room.players.every(p => p.isReady);
    const allPickedClass = room.players.every(p => p.cls);
    const validation = context === 'gemini'
        ? validateText(text, RULES.MIN_WORDS)
        : { valid: selectedFolderIds.length > 0 && text.length > 0, wordCount: text.split(' ').length, error: 'Selecione ao menos 1 pasta com Textos ou Palavras.' };

    // Sync config (apenas host)
    useEffect(() => {
        if (isHost) {
            const t = setTimeout(() => {
                if (context === 'library' || validation.valid) {
                    onUpdateConfig(sourceLang, targetLang, text, difficulty, context, selectedFolderIds);
                }
            }, 500);
            return () => clearTimeout(t);
        }
    }, [sourceLang, targetLang, text, difficulty, context, selectedFolderIds]);

    // Auto-merge texts da biblioteca
    useEffect(() => {
        if (context === 'library' && isHost) {
            if (selectedFolderIds.length === 0) { setText(''); return; }
            const inFolder = (itemPath?: string) => selectedFolderIds.some(filterPath => {
                if (filterPath === '__uncategorized__' && !itemPath) return true;
                return itemPath === filterPath || itemPath?.startsWith(filterPath + '/');
            });
            const matchingItems = libraryItems.filter(i => inFolder(i.folderPath));
            const textItems = matchingItems.filter(i => i.type === 'text' || (!i.type && (i.tokens?.length || 0) > 4));
            if (textItems.length > 0) {
                setText(textItems.map(t => t.chinese).join('\n\n'));
            } else {
                const wordsWithSentences = matchingItems.filter(i => i.originalSentence);
                if (wordsWithSentences.length > 0) {
                    setText(Array.from(new Set(wordsWithSentences.map(w => w.originalSentence))).join(' '));
                } else {
                    setText(matchingItems.map(i => i.chinese).join(' '));
                }
            }
        }
    }, [context, selectedFolderIds, libraryItems, isHost]);

    const canStart = isHost && allReady && allPickedClass && validation.valid && room.players.length > 0;

    return (
        <div className={`min-h-full ${THEME.bg} -m-6 p-6 text-white`}>
            <div className="max-w-3xl mx-auto space-y-5">
                {/* Header da sala */}
                <div className={`${THEME.bgPanel} rounded-2xl p-5 ${THEME.borderGlow} border`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center text-2xl">
                                🏰
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{room.name}</h2>
                                <p className="text-xs text-white/60">
                                    {isHost ? '👑 Você é o líder' : `Líder: ${room.players.find(p => p.id === room.hostId)?.name || '—'}`}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <AudioToggle />
                            {isHost && (
                                <button
                                    onClick={() => { if (confirm('Deletar esta sala permanentemente?')) onDeleteRoom(); }}
                                    className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200"
                                    title="Deletar sala"
                                >
                                    <Icon name="trash-2" size={18} />
                                </button>
                            )}
                            <button
                                onClick={onLeaveRoom}
                                className="px-3 py-2 text-white/70 hover:text-white text-sm font-semibold"
                            >
                                Sair
                            </button>
                        </div>
                    </div>

                    {/* Lista de jogadores */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">
                                Aventureiros ({room.players.length}/6)
                            </h3>
                            {isHost && room.players.length < 6 && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowBotMenu(s => !s)}
                                        className="px-2.5 py-1 bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 border border-violet-400/40 rounded-lg text-xs font-bold flex items-center gap-1.5"
                                    >
                                        <Icon name="plus" size={12} /> Bot
                                    </button>
                                    {showBotMenu && (
                                        <div className="absolute right-0 top-full mt-1 bg-[#1a0a3d] border border-violet-400/40 rounded-xl p-2 z-20 shadow-xl w-44">
                                            <p className="text-[10px] uppercase tracking-wider text-violet-300 font-bold mb-1.5 px-1">Nível</p>
                                            {(['easy', 'medium', 'hard'] as BotLevel[]).map(l => (
                                                <button
                                                    key={l}
                                                    onClick={() => { setBotLevel(l); audio.classPerk(); onAddBot(l); setShowBotMenu(false); }}
                                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold mb-0.5 transition-colors ${botLevel === l ? 'bg-violet-500/30 text-white' : 'text-white/70 hover:bg-white/5'}`}
                                                >
                                                    {BOT_LEVEL_CONFIG[l].name}
                                                    <span className="ml-1.5 text-white/40 text-[10px] font-normal">
                                                        {Math.round(BOT_LEVEL_CONFIG[l].accuracy * 100)}% acerto
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {room.players.map(p => {
                                const color = getPlayerColor(p.id);
                                const cls = p.cls ? PLAYER_CLASSES.find(c => c.id === p.cls) : null;
                                const isBot = p.isBot;
                                return (
                                    <div
                                        key={p.id}
                                        className={`flex items-center gap-3 p-2.5 rounded-xl border-2 backdrop-blur group ${isBot ? 'border-dashed' : ''}`}
                                        style={{
                                            backgroundColor: `${color.hex}20`,
                                            borderColor: p.isReady ? '#10B981' : color.hex,
                                        }}
                                    >
                                        {isBot ? (
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-2xl bg-violet-500/30 border border-violet-400/40">
                                                {p.botEmoji || '🤖'}
                                            </div>
                                        ) : p.avatarUrl ? (
                                            <img src={p.avatarUrl} alt={p.name} className="w-10 h-10 rounded-full ring-2 ring-white/30" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white" style={{ backgroundColor: color.hex }}>
                                                {p.name[0]?.toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-sm truncate">{p.name}</span>
                                                {isBot && <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-violet-500/30 text-violet-200 font-black">{BOT_LEVEL_CONFIG[p.botLevel || 'medium'].name}</span>}
                                                {p.id === room.hostId && <span className="text-xs">👑</span>}
                                                {cls && <span title={cls.name} className="text-base">{cls.icon}</span>}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-xs font-bold ${p.isReady ? 'text-emerald-300' : 'text-white/50'}`}>
                                                    {p.isReady ? (isBot ? '🤖 Bot ativo' : '✅ Pronto') : '⏳ Aguardando'}
                                                </span>
                                                {!isBot && <span className="text-[10px] text-amber-300 font-semibold">LVL {p.totalScore || 0}</span>}
                                            </div>
                                        </div>
                                        {isHost && p.id !== currentUserId && (
                                            <button
                                                onClick={() => { if (confirm(`Remover ${p.name}?`)) onKickPlayer(p.id); }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-white/40 hover:text-rose-400"
                                                title="Remover"
                                            >
                                                <Icon name="x" size={14} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Class Picker */}
                <div className={`${THEME.bgPanel} rounded-2xl p-5 ${THEME.borderGlow} border`}>
                    <h3 className="text-sm font-black uppercase tracking-wider text-amber-300 mb-3 flex items-center gap-2">
                        <Icon name="sword" size={18} />
                        Escolha sua classe
                    </h3>
                    <ClassPicker
                        selected={currentPlayer?.cls}
                        onSelect={onSelectClass}
                    />
                    {!currentPlayer?.cls && (
                        <p className="text-xs text-amber-300/80 mt-2 text-center">
                            ⚠ Você precisa escolher uma classe antes do jogo começar.
                        </p>
                    )}
                </div>

                {/* Configuração (host only) */}
                <div className={`${THEME.bgPanel} rounded-2xl p-5 ${THEME.borderGlow} border`}>
                    <h3 className="text-sm font-black uppercase tracking-wider text-amber-300 mb-3 flex items-center gap-2">
                        <Icon name="sparkles" size={18} />
                        Configuração da Quest
                    </h3>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-black/20 rounded-lg p-2">
                                <FlagSelect
                                    options={SUPPORTED_LANGUAGES}
                                    value={sourceLang}
                                    onChange={setSourceLang}
                                    label="Idioma estudado"
                                    disabled={!isHost}
                                />
                            </div>
                            <div className="bg-black/20 rounded-lg p-2">
                                <FlagSelect
                                    options={SUPPORTED_LANGUAGES}
                                    value={targetLang}
                                    onChange={setTargetLang}
                                    label="Idioma nativo"
                                    disabled={!isHost}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-white/70 uppercase mb-1.5">Dificuldade</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['Iniciante', 'Intermediário', 'Avançado'].map(level => (
                                    <button
                                        key={level}
                                        onClick={() => setDifficulty(level)}
                                        disabled={!isHost}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border-2 ${difficulty === level
                                            ? 'bg-amber-400 text-slate-900 border-amber-300'
                                            : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                                        } ${!isHost ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-white/70 uppercase mb-1.5">Fonte do Texto</label>
                            <div className="flex bg-black/30 p-1 rounded-xl mb-3">
                                <button
                                    onClick={() => setContext('gemini')}
                                    disabled={!isHost}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${context !== 'library' ? 'bg-amber-400 text-slate-900' : 'text-white/60 hover:text-white'} ${!isHost ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    Texto IA
                                </button>
                                <button
                                    onClick={() => setContext('library')}
                                    disabled={!isHost}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${context === 'library' ? 'bg-amber-400 text-slate-900' : 'text-white/60 hover:text-white'} ${!isHost ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Icon name="book" size={14} /> Biblioteca
                                </button>
                            </div>

                            {context === 'library' ? (
                                <div className="space-y-3">
                                    <button
                                        onClick={() => isHost && setIsFolderModalOpen(true)}
                                        disabled={!isHost}
                                        className={`w-full bg-black/30 border-2 border-white/15 text-white/90 font-bold py-3 rounded-xl flex items-center justify-between px-4 transition-colors ${isHost ? 'hover:border-amber-400/50' : 'opacity-50 cursor-not-allowed'}`}
                                    >
                                        <span className="truncate text-sm flex items-center gap-2">
                                            <Icon name="folder" size={16} className="text-amber-400" />
                                            {selectedFolderIds.length > 0 ? `${selectedFolderIds.length} pasta(s)` : 'Escolher pastas...'}
                                        </span>
                                        {isHost && <Icon name="chevron-right" size={16} className="text-white/50" />}
                                    </button>
                                    {text && (
                                        <div className="bg-black/30 rounded-lg p-2 border border-white/10 max-h-32 overflow-y-auto">
                                            <p className="text-xs text-white/70 italic line-clamp-4">{text.slice(0, 200)}{text.length > 200 ? '…' : ''}</p>
                                            <p className="text-[10px] text-amber-300/80 font-bold mt-1">{text.split(/\s+/).filter(Boolean).length} palavras</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    disabled={!isHost}
                                    rows={5}
                                    placeholder="Cole aqui o texto..."
                                    className="w-full px-3 py-2 bg-black/30 border-2 border-white/15 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 disabled:opacity-50 resize-none"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Ações */}
                <div className={`${THEME.bgPanel} rounded-2xl p-5 ${THEME.borderGlow} border`}>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="flex-1 text-sm">
                            {!currentPlayer?.cls && (
                                <p className="text-amber-300 font-semibold flex items-center gap-2">
                                    <Icon name="alert-circle" size={16} /> Escolha sua classe primeiro.
                                </p>
                            )}
                            {currentPlayer?.cls && !allReady && (
                                <p className="text-white/70">
                                    <Icon name="info" size={14} className="inline mr-1" />
                                    Aguardando todos ficarem prontos…
                                </p>
                            )}
                            {allReady && !validation.valid && isHost && (
                                <p className="text-rose-300 font-semibold">
                                    <Icon name="alert-circle" size={14} className="inline mr-1" />
                                    Configure um texto válido.
                                </p>
                            )}
                            {canStart && (
                                <p className="text-emerald-300 font-bold">
                                    <Icon name="check-circle" size={14} className="inline mr-1" />
                                    Tudo pronto! A masmorra aguarda.
                                </p>
                            )}
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                            <button
                                onClick={() => { audio.cardLock(); onToggleReady(); }}
                                disabled={!currentPlayer?.cls}
                                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${currentPlayer?.isReady
                                    ? 'bg-white/10 text-white hover:bg-white/20'
                                    : 'bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50'
                                }`}
                            >
                                {currentPlayer?.isReady ? '↩ Cancelar' : '✅ Estou Pronto'}
                            </button>
                            {isHost && (
                                <button
                                    onClick={() => { audio.classPerk(); onStartGame(); }}
                                    disabled={!canStart}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${canStart
                                        ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 active:scale-95'
                                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                                    }`}
                                >
                                    <Icon name="sword" size={18} /> Iniciar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <GameContentSelectorModal
                isOpen={isFolderModalOpen}
                onClose={() => setIsFolderModalOpen(false)}
                currentUserId={room.hostId}
                initialSelectedPaths={selectedFolderIds}
                onConfirmSelection={(paths) => { if (isHost) setSelectedFolderIds(paths); }}
            />
        </div>
    );
};
