import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../components/Icon';
import { DominoRoom, DominoPiece as DominoPieceType, Train, EmoteBroadcast } from '../types';
import { DominoPiece } from './DominoPiece';
import { PlayerHand } from './PlayerHand';
import { HandViewModal } from './HandViewModal';
import { TrainViewModal } from './TrainViewModal';
import { DominoPieceModal } from './DominoPieceModal';
import { EmotePanel, EmoteDisplay } from './EmotePanel';
import { usePuterSpeech } from '../../../hooks/usePuterSpeech';
import { useUserProfile } from '../../../hooks/useUserProfile';

interface GameBoardProps {
    room: DominoRoom;
    currentUserId: string;
    onPlacePiece: (pieceId: string, trainId: string, flipped: boolean) => Promise<boolean>;
    onDrawPiece: () => Promise<DominoPieceType | null>;
    onPassTurn: () => void;
    onReorderHand?: (newOrder: DominoPieceType[]) => void;
    onSendEmote?: (emote: EmoteBroadcast) => void;
    onExit?: () => void;
    onToggleFullscreen?: () => void;
    isFullscreen?: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({
    room,
    currentUserId,
    onPlacePiece,
    onDrawPiece,
    onPassTurn,
    onReorderHand,
    onSendEmote,
    onExit,
    onToggleFullscreen,
    isFullscreen
}) => {
    const [selectedPiece, setSelectedPiece] = useState<DominoPieceType | null>(null);
    const [localHand, setLocalHand] = useState<DominoPieceType[] | null>(null);

    const [showHandModal, setShowHandModal] = useState(false);
    const [viewingTrain, setViewingTrain] = useState<Train | null>(null);
    const [viewingPiece, setViewingPiece] = useState<DominoPieceType | null>(null);
    const [autoPassPending, setAutoPassPending] = useState(false);
    const [turnTimer, setTurnTimer] = useState(60);

    const { speakSequence, speak } = usePuterSpeech();
    const prevOpenTrainsRef = useRef<Set<string>>(new Set());

    // Sound effects
    const playTrainOpenSound = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime);
            osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.15);
            osc.frequency.setValueAtTime(392, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.45);
        } catch (e) { }
    };

    useEffect(() => {
        const currentlyOpenTrains = new Set(
            room.trains.filter(t => t.isOpen && t.ownerId !== null).map(t => t.id)
        );
        currentlyOpenTrains.forEach(trainId => {
            if (!prevOpenTrainsRef.current.has(trainId)) {
                const train = room.trains.find(t => t.id === trainId);
                const owner = train?.ownerId ? room.players.find(p => p.id === train.ownerId) : null;
                playTrainOpenSound();
                if (owner && owner.id !== currentUserId) {
                    setTimeout(() => speak(`${owner.name.split(' ')[0]} deixou o trem aberto`, 'pt'), 500);
                }
            }
        });
        prevOpenTrainsRef.current = currentlyOpenTrains;
    }, [room.trains]);

    const isMyTurn = room.currentTurn === currentUserId;
    const currentPlayer = room.players.find(p => p.id === currentUserId);
    const serverHand = currentPlayer?.hand || [];
    const myHand = localHand || serverHand;
    const currentTurnPlayer = room.players.find(p => p.id === room.currentTurn);

    useEffect(() => { setTurnTimer(60); }, [room.currentTurn]);

    useEffect(() => {
        if (room.phase !== 'playing') return;
        const interval = setInterval(() => {
            setTurnTimer(prev => {
                if (prev <= 1) {
                    if (isMyTurn) {
                        if (room.boneyard.length > 0) {
                            onDrawPiece().then(() => setTimeout(() => onPassTurn(), 500));
                        } else onPassTurn();
                    }
                    return 60;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [room.phase, room.boneyard.length, isMyTurn, onPassTurn, onDrawPiece]);

    useEffect(() => {
        if (JSON.stringify(serverHand.map(p => p.id)) !== JSON.stringify(localHand?.map(p => p.id))) {
            setLocalHand(null);
        }
    }, [serverHand]);

    const playersWithOnePieceRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (room.phase !== 'playing') return;
        room.players.forEach(player => {
            if (player.hand.length === 1 && !playersWithOnePieceRef.current.has(player.id)) {
                playersWithOnePieceRef.current.add(player.id);
                try {
                    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const notes = [440, 554.37, 659.25, 880];
                    notes.forEach((freq, i) => {
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
                        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
                        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.15);
                        osc.start(ctx.currentTime + i * 0.1);
                        osc.stop(ctx.currentTime + i * 0.1 + 0.15);
                    });
                } catch (e) { }
                const isMe = player.id === currentUserId;
                const msg = isMe ? 'Atenção! Você tem apenas uma peça!' : `Atenção! ${player.name.split(' ')[0]} tem apenas uma peça!`;
                setTimeout(() => speak(msg, 'pt'), 500);
            }
            if (player.hand.length > 1 && playersWithOnePieceRef.current.has(player.id)) {
                playersWithOnePieceRef.current.delete(player.id);
            }
        });
    }, [room.players, room.phase, currentUserId, speak]);

    const canPlayOnTrain = (piece: DominoPieceType, train: Train) => {
        const targetIndex = train.openEndIndex;
        if (piece.leftIndex === targetIndex) return { canPlay: true, needsFlip: false };
        if (piece.rightIndex === targetIndex) return { canPlay: true, needsFlip: true };
        return { canPlay: false, needsFlip: false };
    };

    const getPlayableTrains = (piece: DominoPieceType): Train[] => {
        return room.trains.filter(train => {
            const canAccess = train.ownerId === null || train.ownerId === currentUserId || train.isOpen;
            if (!canAccess) return false;
            return canPlayOnTrain(piece, train).canPlay;
        });
    };

    const handleSelectPiece = (piece: DominoPieceType) => {
        if (!isMyTurn) return;
        setSelectedPiece(selectedPiece?.id === piece.id ? null : piece);
    };

    const { stats, updateStats } = useUserProfile(currentUserId);

    const handlePlaceOnTrain = async (train: Train) => {
        if (!selectedPiece || !isMyTurn) return;
        const { canPlay, needsFlip } = canPlayOnTrain(selectedPiece, train);
        if (!canPlay) return;

        const connectedIndex = train.openEndIndex;
        const termPair = room.termPairs.find(tp => tp.index === connectedIndex);
        const originalTerm = termPair?.term || '';
        const translation = termPair?.definition || '';
        const refId = termPair?.originalRefId;

        const success = await onPlacePiece(selectedPiece.id, train.id, needsFlip);
        if (success) {
            setSelectedPiece(null);
            setLocalHand(null);

            // Progress/Gamification: Ganhar pontos por acerto com cartas próprias
            if (refId) {
                // Dominó dá 2 exp por jogada certa
                updateStats({ ...stats, points: (stats.points || 0) + 2 });
            }

            if (originalTerm && translation) {
                const isLanguageContext = room.config.context === 'language';
                const termLang = isLanguageContext ? (room.config.sourceLang || 'pt') : 'pt';
                const translationToSpeak = translation.length <= 50 ? translation : '';
                const shouldSpeakTranslation = translationToSpeak && translationToSpeak.toLowerCase() !== originalTerm.toLowerCase();

                const sequence: Array<{ text: string; language: any }> = [{ text: originalTerm, language: termLang }];
                if (shouldSpeakTranslation) sequence.push({ text: translationToSpeak, language: 'pt' });
                speakSequence(sequence);
            }
        }
    };

    const handleDraw = async () => {
        if (!isMyTurn || room.boneyard.length === 0) return;
        const drawnPiece = await onDrawPiece();
        setLocalHand(null);
        if (drawnPiece) {
            const validTrains = room.trains.filter(train => train.ownerId === null || train.ownerId === currentUserId || train.isOpen);
            let canPlay = validTrains.some(train => drawnPiece.leftIndex === train.openEndIndex || drawnPiece.rightIndex === train.openEndIndex);
            if (!canPlay) {
                setAutoPassPending(true);
                setTimeout(() => {
                    setAutoPassPending(false);
                    onPassTurn();
                }, 500);
            } else {
                setSelectedPiece(drawnPiece);
            }
        }
    };

    const handlePass = () => {
        if (!isMyTurn) return;
        setAutoPassPending(false);
        onPassTurn();
    };

    const playableTrains = selectedPiece ? getPlayableTrains(selectedPiece) : [];
    const playablePieceIds = myHand.filter(p => getPlayableTrains(p).length > 0).map(p => p.id);
    const hasPlayablePiece = playablePieceIds.length > 0;

    return (
        <div className="h-full flex flex-col bg-slate-800 overflow-hidden font-sans">
            {/* Header / HUD (Top 10%) */}
            <div className="flex-shrink-0 bg-slate-900 px-4 py-3 flex items-center justify-between shadow-md z-10 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <button onClick={onExit} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full transition-colors">
                        <Icon name="log-out" size={16} />
                    </button>
                    {onToggleFullscreen && (
                        <button onClick={onToggleFullscreen} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full transition-colors">
                            <Icon name={isFullscreen ? "minimize-2" : "maximize-2"} size={16} />
                        </button>
                    )}
                </div>

                {/* Player Avatars */}
                <div className="flex gap-2 items-center justify-center flex-1 mx-4">
                    {room.players.map(p => {
                        const isTurn = p.id === room.currentTurn;
                        const isMe = p.id === currentUserId;
                        const isUno = p.hand.length === 1;
                        return (
                            <div key={p.id} className={`
                                relative flex flex-col items-center transition-all duration-300
                                ${isTurn ? 'scale-110' : 'opacity-70 scale-95'}
                                ${isUno ? 'animate-bounce' : ''}
                            `}>
                                <div className={`
                                    w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-lg relative
                                    ${isTurn ? 'ring-4 ring-green-500 bg-slate-700' : 'ring-2 ring-slate-600 bg-slate-800'}
                                `}>
                                    {isMe ? '👤' : '🤖'}
                                    <div className="absolute -bottom-2 -right-2 bg-slate-900 text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-700">
                                        {p.hand.length}
                                    </div>
                                    {isUno && (
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap uppercase tracking-wider">
                                            1 Peça!
                                        </div>
                                    )}
                                </div>
                                <span className={`text-[10px] mt-2 font-bold max-w-[50px] truncate ${isTurn ? 'text-green-400' : 'text-slate-400'}`}>
                                    {p.name.split(' ')[0]}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Timer */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 ring-2 ring-slate-700">
                    <span className={`text-sm font-bold ${turnTimer <= 10 ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
                        {turnTimer}
                    </span>
                </div>
            </div>

            {/* Board Area: Stacked Trains (Central 60%) */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-hide bg-[#1c2e26] p-4 flex flex-col gap-4">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                <EmoteDisplay emotes={room.emotes || []} currentUserId={currentUserId} />

                {onSendEmote && (
                    <div className="absolute top-4 right-4 z-20 opacity-50 hover:opacity-100 transition-opacity">
                        <EmotePanel onSendEmote={onSendEmote} currentUserId={currentUserId} currentUserName={currentPlayer?.name || 'Jogador'} />
                    </div>
                )}

                {/* Hub Piece Marker */}
                {room.hubPiece && (
                    <div className="self-center flex flex-col items-center mb-2 z-10">
                        <span className="text-[10px] font-bold text-emerald-300/60 uppercase tracking-widest mb-1">Início</span>
                        <div className="scale-75 opacity-90">
                            <DominoPiece piece={room.hubPiece} onClick={() => setViewingPiece(room.hubPiece!)} />
                        </div>
                    </div>
                )}

                {/* Vertical Train List. Ordered: Mexican -> My Train -> Others */}
                <div className="flex flex-col gap-4 z-10 max-w-2xl mx-auto w-full">
                    {[
                        room.trains.find(t => t.ownerId === null),
                        room.trains.find(t => t.ownerId === currentUserId),
                        ...room.trains.filter(t => t.ownerId !== null && t.ownerId !== currentUserId)
                    ].filter(Boolean).map(train => {
                        if (!train) return null;

                        const isMexican = train.ownerId === null;
                        const isMine = train.ownerId === currentUserId;
                        const owner = train.ownerId ? room.players.find(p => p.id === train.ownerId) : null;
                        const canAccess = isMexican || isMine || train.isOpen;
                        const isPlayable = playableTrains.some(t => t.id === train.id);

                        // Calculate the single "End Piece" visualization natively using CSS
                        const endText = train.openEndText;
                        const endIdx = train.openEndIndex;

                        return (
                            <div key={train.id}
                                onClick={() => isPlayable ? handlePlaceOnTrain(train) : setViewingTrain(train)}
                                className={`
                                flex items-center bg-slate-800 rounded-xl shadow-lg border-2 transition-all p-2 pl-3 relative overflow-hidden group h-[80px]
                                ${isPlayable ? 'border-green-400 ring-2 ring-green-900/50 cursor-pointer shadow-green-900/40 hover:-translate-y-0.5 hover:shadow-xl' : 'border-slate-700 cursor-pointer hover:bg-slate-750'}
                                ${!canAccess ? 'opacity-50 grayscale hover:grayscale-0 transition-all' : ''}
                            `}>
                                {/* Tiny Info Col */}
                                <div className="flex flex-col items-center justify-center w-[50px] flex-shrink-0 relative z-10 select-none">
                                    <div className="relative">
                                        <span className="text-3xl filter drop-shadow-md">{isMexican ? '🚂' : isMine ? '🏠' : train.isOpen ? '🔓' : '🔒'}</span>
                                        {train.isOpen && !isMexican && (
                                            <div className="absolute -top-1 -right-2 bg-yellow-500 w-3 h-3 rounded-full border-2 border-slate-800 animate-pulse" title="Trem Aberto" />
                                        )}
                                    </div>
                                    <div className="bg-slate-900/80 text-slate-300 text-[10px] font-black px-1.5 py-0.5 mt-1 rounded ring-1 ring-slate-700 shadow-inner">
                                        {train.pieces.length}
                                    </div>
                                </div>

                                {/* The End Piece "Mouth" */}
                                <div className="flex-1 relative z-10 h-[64px] ml-2 min-w-0">
                                    {train.pieces.length === 0 ? (
                                        <div className="w-full h-full bg-slate-700/50 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-between text-slate-400 px-3 overflow-hidden">
                                            <span className="text-sm font-bold truncate flex-1 break-words leading-tight" title={endText}>{endText}</span>
                                            <span className="text-xs font-black opacity-50 ml-2 flex-shrink-0">{endIdx}</span>
                                        </div>
                                    ) : (
                                        <div className={`
                                            flex items-center justify-between w-full h-full bg-slate-50 rounded-lg shadow-inner border-b-4 transition-all px-3 overflow-hidden
                                            ${isPlayable ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400' : 'border-slate-300'}
                                        `}>
                                            <span className={`text-base sm:text-lg font-black line-clamp-2 leading-tight flex-1 text-left mr-2 ${isPlayable ? 'text-emerald-950' : 'text-slate-800'}`}>
                                                {endText}
                                            </span>
                                            <div className={`flex items-center justify-center rounded-md px-2 py-1 flex-shrink-0 ${isPlayable ? 'bg-emerald-200/50' : 'bg-slate-200/50'}`}>
                                                <span className={`text-sm font-black ${isPlayable ? 'text-emerald-900' : 'text-slate-600'}`}>{endIdx}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Play Overlay */}
                                {isPlayable && (
                                    <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-green-500 text-white font-black text-xs px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2">
                                            <Icon name="check" size={14} /> JOGAR
                                        </div>
                                    </div>
                                )}
                                {/* Expand Overlay */}
                                {!isPlayable && (
                                    <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-slate-800 text-slate-300 font-bold text-[10px] uppercase tracking-wider px-3 py-1 rounded-full shadow-lg flex items-center gap-2 border border-slate-700 backdrop-blur-sm">
                                            <Icon name="search" size={12} /> Ver Fila
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Bridge: Action Bar (10%) */}
            {isMyTurn && (
                <div className="flex-shrink-0 bg-slate-900 px-4 py-3 flex items-center justify-between z-20 border-t border-slate-700 shadow-xl relative mt-[-1px]">
                    <div className="flex-1 flex justify-start">
                        {/* Status Message */}
                        {hasPlayablePiece ? (
                            <div className="flex items-center gap-2 text-green-400 text-sm font-bold bg-green-400/10 px-3 py-1.5 rounded-full border border-green-500/20">
                                <span className="animate-pulse">●</span> Escolha o destino
                            </div>
                        ) : room.boneyard.length > 0 ? (
                            <div className="flex items-center gap-2 text-amber-400 text-sm font-bold bg-amber-400/10 px-3 py-1.5 rounded-full border border-amber-500/20">
                                <span>⚠️</span> Nenhuma jogada, compre pedra
                            </div>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={handleDraw} disabled={room.boneyard.length === 0}
                            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-black transition-all active:scale-95 shadow-lg border-b-4 border-slate-900 hover:border-slate-800 disabled:border-slate-900"
                        >
                            <span className="text-xl leading-none">🧱</span>
                            <div className="flex flex-col text-left">
                                <span className="text-[10px] text-slate-300 uppercase leading-none">Comprar</span>
                                <span className="text-sm leading-none mt-0.5">{room.boneyard.length} restam</span>
                            </div>
                        </button>

                        <button onClick={handlePass}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black transition-all active:scale-95 shadow-lg border-b-4 
                                ${autoPassPending ? 'bg-red-500 hover:bg-red-400 text-white border-red-700 animate-pulse' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-900 hover:border-slate-800'}
                            `}
                        >
                            <span className="text-xl leading-none">⏭️</span>
                            <div className="flex flex-col text-left">
                                <span className="text-[10px] opacity-70 uppercase leading-none">Ação</span>
                                <span className="text-sm leading-none mt-0.5">{autoPassPending ? 'Passando' : 'Passar'}</span>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* Bottom Dock: My Hand (20%) */}
            <div className={`flex-shrink-0 bg-slate-800 border-t ${isMyTurn ? 'border-green-500 shadow-[0_-4px_20px_rgba(34,197,94,0.15)]' : 'border-slate-700'} relative z-30 transition-all`}>
                <PlayerHand
                    pieces={myHand}
                    isMyTurn={isMyTurn}
                    selectedPieceId={selectedPiece?.id || null}
                    playablePieceIds={playablePieceIds}
                    onSelectPiece={handleSelectPiece}
                    onPieceDoubleClick={(piece) => setViewingPiece(piece)}
                />
            </div>

            {/* Modals */}
            {viewingTrain && (
                <TrainViewModal
                    train={viewingTrain}
                    isMyTrain={viewingTrain?.ownerId === currentUserId}
                    onClose={() => setViewingTrain(null)}
                    onPieceClick={(piece) => setViewingPiece(piece)}
                />
            )}
            {viewingPiece && (
                <DominoPieceModal
                    piece={viewingPiece}
                    isOpen={true}
                    onClose={() => setViewingPiece(null)}
                    termPairs={room.termPairs}
                    gameConfig={room.config}
                />
            )}
        </div>
    );
};
