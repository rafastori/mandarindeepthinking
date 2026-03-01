import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../components/Icon';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { DominoRoom, DominoPiece as DominoPieceType, Train, EmoteBroadcast } from '../types';
import { DominoPiece } from './DominoPiece';
import { PlayerHandCarousel } from './PlayerHandCarousel';
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
    const [isCarouselOpen, setIsCarouselOpen] = useState(false);
    const [viewingPiece, setViewingPiece] = useState<DominoPieceType | null>(null);
    const [activeOpponentTrainId, setActiveOpponentTrainId] = useState<string | null>(null);
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

    const handlePlaceOnTrain = async (train: Train, overridePiece?: DominoPieceType) => {
        const pieceToPlay = overridePiece || selectedPiece;
        if (!pieceToPlay || !isMyTurn) return;
        const { canPlay, needsFlip } = canPlayOnTrain(pieceToPlay, train);
        if (!canPlay) return;

        const connectedIndex = train.openEndIndex;
        const termPair = room.termPairs.find(tp => tp.index === connectedIndex);
        const originalTerm = termPair?.term || '';
        const translation = termPair?.definition || '';
        const refId = termPair?.originalRefId;

        const success = await onPlacePiece(pieceToPlay.id, train.id, needsFlip);
        if (success) {
            setSelectedPiece(null);
            setLocalHand(null);

            // Progress/Gamification: Ganhar pontos por acerto com cartas próprias
            if (refId) {
                // Dominó dá 2 exp por jogada certa
                updateStats({ ...stats, points: (stats.points || 0) + 2 });
            }

            if (originalTerm && translation) {
                const termLang = termPair?.language || room.config.sourceLang || 'zh';
                const targetLang = room.config.targetLang || 'pt';
                const translationToSpeak = translation.length <= 50 ? translation : '';
                const shouldSpeakTranslation = translationToSpeak && translationToSpeak.toLowerCase() !== originalTerm.toLowerCase();

                const sequence: Array<{ text: string; language: any }> = [{ text: originalTerm, language: termLang }];
                if (shouldSpeakTranslation) sequence.push({ text: translationToSpeak, language: targetLang });
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
                setIsCarouselOpen(true); // Open carousel to show the playable drawn piece
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

            {/* Infinite Canvas Area: Stacked Trains (Central 60%) */}
            <div className="flex-1 overflow-hidden relative bg-[#1c2e26] cursor-grab active:cursor-grabbing">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                <TransformWrapper
                    initialScale={0.8}
                    minScale={0.2}
                    maxScale={2}
                    centerOnInit={true}
                    limitToBounds={false}
                >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                            {/* Canvas Controls */}
                            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                                <button onClick={() => zoomIn(0.2, 300)} className="w-10 h-10 flex items-center justify-center bg-slate-800/90 text-slate-300 rounded-full shadow-lg border border-slate-600 hover:bg-slate-700 hover:text-white transition-all backdrop-blur-sm"><Icon name="zoom-in" size={20} /></button>
                                <button onClick={() => zoomOut(0.2, 300)} className="w-10 h-10 flex items-center justify-center bg-slate-800/90 text-slate-300 rounded-full shadow-lg border border-slate-600 hover:bg-slate-700 hover:text-white transition-all backdrop-blur-sm"><Icon name="zoom-out" size={20} /></button>
                                <button onClick={() => resetTransform()} className="w-10 h-10 flex items-center justify-center bg-slate-800/90 text-slate-300 rounded-full shadow-lg border border-slate-600 hover:bg-slate-700 hover:text-white transition-all backdrop-blur-sm mt-2"><Icon name="maximize" size={18} /></button>
                            </div>

                            <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full flex flex-col items-center justify-center p-32">
                                <EmoteDisplay emotes={room.emotes || []} currentUserId={currentUserId} />

                                {onSendEmote && (
                                    <div className="absolute top-4 right-4 z-20 opacity-50 hover:opacity-100 transition-opacity">
                                        <EmotePanel onSendEmote={onSendEmote} currentUserId={currentUserId} currentUserName={currentPlayer?.name || 'Jogador'} />
                                    </div>
                                )}

                                <div className="flex flex-col gap-24 items-start pb-48 w-max">
                                    {/* Hub Piece Marker */}
                                    {room.hubPiece && (
                                        <div className="self-center flex flex-col items-center z-10 sticky left-1/2 -translate-x-1/2">
                                            <span className="text-sm font-black text-emerald-300/80 uppercase tracking-widest mb-4 bg-emerald-900/30 px-6 py-2 rounded-full border border-emerald-500/30 backdrop-blur-md shadow-2xl">Ponto de Início</span>
                                            <div className="scale-110 drop-shadow-2xl">
                                                <DominoPiece piece={room.hubPiece} onClick={() => setViewingPiece(room.hubPiece!)} size="giant" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Render Selected Trains */}
                                    {[
                                        room.trains.find(t => t.ownerId === null),
                                        room.trains.find(t => t.ownerId === currentUserId),
                                        ...(activeOpponentTrainId ? [room.trains.find(t => t.id === activeOpponentTrainId)] : [])
                                    ].filter(Boolean).map(train => {
                                        if (!train) return null;

                                        const isMexican = train.ownerId === null;
                                        const isMine = train.ownerId === currentUserId;
                                        const owner = train.ownerId ? room.players.find(p => p.id === train.ownerId) : null;
                                        const canAccess = isMexican || isMine || train.isOpen;
                                        const isPlayable = playableTrains.some(t => t.id === train.id);

                                        return (
                                            <div key={train.id} className={`flex flex-row items-center relative min-h-[160px] p-8 rounded-3xl transition-colors ${isPlayable ? 'bg-green-900/10 border-2 border-green-500/20 shadow-[inset_0_0_50px_rgba(34,197,94,0.05)]' : ''}`}>
                                                {/* Connecting Electric Line */}
                                                <div className={`absolute top-1/2 left-8 right-8 h-4 -translate-y-1/2 z-0 rounded-full shadow-inner ${isPlayable ? 'bg-green-500/30 animate-pulse' : 'bg-slate-700/60'}`}></div>

                                                {/* Floating Owner Icon */}
                                                <div className={`absolute left-4 -top-6 text-3xl shadow-xl bg-slate-800 rounded-full p-3 border-4 z-20 flex flex-col items-center
                                                    ${isPlayable ? 'border-green-400 ring-4 ring-green-500/30' : 'border-slate-600'}
                                                    ${!canAccess ? 'opacity-50 grayscale' : ''}
                                                `}>
                                                    <span>{isMexican ? '🚂' : isMine ? '🏠' : (train.isOpen ? '🔓' : '🤖')}</span>
                                                    {!isMexican && !isMine && owner && (
                                                        <span className="text-[10px] font-black text-slate-300 mt-1 tracking-widest uppercase">{owner.name.split(' ')[0]}</span>
                                                    )}
                                                    {isMexican && <span className="text-[10px] font-black text-amber-400 mt-1 tracking-widest uppercase">Mesa</span>}
                                                    {isMine && <span className="text-[10px] font-black text-emerald-400 mt-1 tracking-widest uppercase">Meu</span>}
                                                </div>

                                                {/* Train Pieces Sequence */}
                                                <div className="flex flex-row items-center z-10 pl-6 gap-2">
                                                    {train.pieces.length === 0 ? (
                                                        <div className="opacity-40 text-slate-400 font-bold bg-slate-800 px-8 py-4 rounded-xl border-4 border-dashed border-slate-600 italic">Vazio</div>
                                                    ) : (
                                                        train.pieces.map((placed, idx) => {
                                                            const isLast = idx === train.pieces.length - 1;
                                                            return (
                                                                <div key={idx} className="z-10 hover:z-30 transition-all hover:scale-105 hover:-translate-y-2 drop-shadow-2xl">
                                                                    <DominoPiece
                                                                        piece={placed.piece}
                                                                        flipped={placed.orientation === 'flipped'}
                                                                        size="giant"
                                                                        highlightSide={isLast ? 'right' : 'none'}
                                                                        onClick={() => setViewingPiece(placed.piece)}
                                                                    />
                                                                </div>
                                                            )
                                                        })
                                                    )}
                                                </div>

                                                {/* Dropzone for Playable */}
                                                {isPlayable && (
                                                    <div className="z-20 ml-8 animate-in zoom-in fade-in duration-300">
                                                        <button onClick={() => handlePlaceOnTrain(train)} className="w-[240px] h-[160px] rounded-2xl border-4 border-dashed border-green-400 bg-green-500/20 flex flex-col items-center justify-center text-green-400 hover:bg-green-500 hover:text-white hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-[0_0_40px_rgba(34,197,94,0.4)] backdrop-blur-sm group">
                                                            <Icon name="check-circle" size={64} className="group-hover:scale-110 transition-transform" />
                                                            <span className="font-black mt-4 tracking-widest text-base uppercase bg-green-900/50 px-4 py-2 rounded-full group-hover:bg-transparent">Jogar Aqui</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </TransformComponent>
                        </>
                    )}
                </TransformWrapper>
            </div>

            {/* Quick Actions (Floating Bottom Left) */}
            {isMyTurn && (
                <div className="absolute bottom-6 left-6 z-40 flex gap-3">
                    <button onClick={handleDraw} disabled={room.boneyard.length === 0}
                        className="flex items-center justify-center w-14 h-14 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-full shadow-xl border-2 border-slate-700 hover:border-slate-500 transition-all active:scale-95"
                        title={`Comprar (${room.boneyard.length} restam)`}
                    >
                        <span className="text-2xl">🧱</span>
                    </button>
                    <button onClick={handlePass}
                        className={`flex items-center justify-center w-14 h-14 text-white rounded-full shadow-xl border-2 transition-all active:scale-95
                            ${autoPassPending ? 'bg-red-500 hover:bg-red-400 border-red-400 animate-pulse' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-500'}
                        `}
                        title={autoPassPending ? 'Passando...' : 'Passar Vez'}
                    >
                        <Icon name="skip-forward" size={24} />
                    </button>
                </div>
            )}

            {/* Main FAB: Meu Trem (Floating Bottom Center) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
                <button
                    onClick={() => setIsCarouselOpen(true)}
                    className={`relative flex items-center justify-center w-20 h-20 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] border-4 transition-all transform hover:scale-105 active:scale-95 ${isMyTurn ? 'bg-gradient-to-tr from-green-500 to-emerald-400 border-green-200 cursor-pointer animate-pulse-slow' : 'bg-slate-700 border-slate-600'}`}
                >
                    <Icon name="grid" size={32} className="text-white drop-shadow-md" />
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-black w-8 h-8 rounded-full flex items-center justify-center border-2 border-slate-800 shadow-lg">
                        {myHand.length}
                    </div>
                </button>
                <span className={`text-white font-black uppercase text-[10px] tracking-widest mt-2 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm ring-1 ring-slate-700 ${isMyTurn ? 'bg-green-900/80 shadow-green-500/50' : 'bg-slate-900/80'}`}>
                    Meu Trem
                </span>
            </div>

            {/* Floating Opponent Avatars (Right Side) */}
            <div className="absolute right-4 top-24 bottom-28 flex flex-col items-center justify-center gap-4 z-30 opacity-80 hover:opacity-100 transition-opacity pointer-events-none">
                {room.trains.filter(t => t.ownerId !== null && t.ownerId !== currentUserId).map(train => {
                    const owner = room.players.find(p => p.id === train.ownerId);
                    if (!owner) return null;
                    const isUno = owner.hand.length === 1;
                    const isPlayable = playableTrains.some(t => t.id === train.id);

                    return (
                        <button
                            key={train.id}
                            onClick={() => {
                                if (isPlayable && selectedPiece && activeOpponentTrainId === train.id) {
                                    handlePlaceOnTrain(train);
                                } else {
                                    setActiveOpponentTrainId(activeOpponentTrainId === train.id ? null : train.id);
                                }
                            }}
                            className={`
                                relative w-14 h-14 rounded-full flex flex-col items-center justify-center bg-slate-800 shadow-xl border-2 transition-all group pointer-events-auto
                                ${isPlayable ? 'border-green-400 ring-2 ring-green-500 scale-110' : 'border-slate-600 hover:border-slate-400 hover:scale-105 active:scale-95'}
                                ${activeOpponentTrainId === train.id ? 'ring-4 ring-blue-500 bg-blue-900' : ''}
                                ${!train.isOpen ? 'opacity-70 grayscale' : ''}
                            `}
                        >
                            <span className="text-xl">{train.isOpen ? '🔓' : '🤖'}</span>
                            <span className="text-[9px] font-bold text-slate-300 w-full truncate px-1 text-center leading-none mt-1">
                                {owner.name.split(' ')[0]}
                            </span>

                            {/* Piece count badge */}
                            <div className="absolute -top-2 -right-2 bg-slate-900 w-6 h-6 rounded-full flex items-center justify-center border-2 border-slate-700 text-white font-black text-[10px] shadow-lg">
                                {owner.hand.length}
                            </div>

                            {/* UNO Indicator */}
                            {isUno && (
                                <div className="absolute -left-14 bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded shadow-lg whitespace-nowrap uppercase tracking-wider animate-bounce flex items-center gap-1">
                                    <Icon name="alert-circle" size={10} /> 1 Pedra
                                    <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-red-600"></div>
                                </div>
                            )}

                            {/* Play Overlay (if selected piece) */}
                            {isPlayable && (
                                <div className="absolute inset-0 bg-green-500 rounded-full flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Icon name="check" size={24} className="text-white drop-shadow-md" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Selected Piece Floating Indicator (If they selected a piece to place) */}
            {selectedPiece && !isCarouselOpen && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 bg-green-500/90 backdrop-blur-md px-6 py-3 rounded-full shadow-2xl border border-green-400 flex items-center gap-4 animate-in slide-in-from-top-4">
                    <span className="text-white font-bold text-sm tracking-wide">Selecione o trem para jogar:</span>
                    <button onClick={() => setSelectedPiece(null)} className="p-1 bg-white/20 hover:bg-white/30 rounded-full text-white">
                        <Icon name="x" size={16} />
                    </button>
                </div>
            )}

            {/* Modals */}
            {isCarouselOpen && (
                <PlayerHandCarousel
                    pieces={myHand}
                    playablePieceIds={playablePieceIds}
                    isMyTurn={isMyTurn}
                    onPlay={(piece) => {
                        setSelectedPiece(piece);
                        setIsCarouselOpen(false);
                        const trains = getPlayableTrains(piece);
                        if (trains.length === 1) {
                            handlePlaceOnTrain(trains[0], piece);
                        }
                    }}
                    onClose={() => setIsCarouselOpen(false)}
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
