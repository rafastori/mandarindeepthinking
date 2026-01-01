import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../components/Icon';
import { DominoRoom, DominoPiece as DominoPieceType, Train } from '../types';
import { DominoPiece } from './DominoPiece';
import { PlayerHand } from './PlayerHand';
import { HandViewModal } from './HandViewModal';
import { TrainViewModal } from './TrainViewModal';
import { DominoPieceModal } from './DominoPieceModal';

interface GameBoardProps {
    room: DominoRoom;
    currentUserId: string;
    onPlacePiece: (pieceId: string, trainId: string, flipped: boolean) => Promise<boolean>;
    onDrawPiece: () => Promise<DominoPieceType | null>;
    onPassTurn: () => void;
    onReorderHand?: (newOrder: DominoPieceType[]) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
    room,
    currentUserId,
    onPlacePiece,
    onDrawPiece,
    onPassTurn,
    onReorderHand
}) => {
    const [selectedPiece, setSelectedPiece] = useState<DominoPieceType | null>(null);
    const [localHand, setLocalHand] = useState<DominoPieceType[] | null>(null);
    const [dragOverTrain, setDragOverTrain] = useState<string | null>(null);
    const [draggingPieceId, setDraggingPieceId] = useState<string | null>(null);

    const [showHandModal, setShowHandModal] = useState(false);
    const [viewingTrain, setViewingTrain] = useState<Train | null>(null);
    const [viewingPiece, setViewingPiece] = useState<DominoPieceType | null>(null);
    const [focusedTrainId, setFocusedTrainId] = useState<string | null>(null); // null = My Train

    // Auto-scroll ref
    const trainRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Keep track of focused index for each train to "Scale Up" the center piece
    // Key: trainId, Value: focused index
    // Using a map ref to avoid re-renders on every scroll event
    const focusedIndicesRef = useRef<{ [trainId: string]: number }>({});
    const [, setForceUpdate] = useState(0); // Force render for scroll updates if we want smooth react state

    const handleTrainScroll = (trainId: string) => {
        const container = trainRefs.current[trainId];
        if (!container) return;

        const center = container.scrollLeft + container.clientWidth / 2;
        const children = Array.from(container.children);

        // Find closest child to center
        let closestIndex = -1;
        let minDistance = Infinity;

        children.forEach((child, index) => {
            if (!(child instanceof HTMLElement)) return;
            // Ignore spacers/padding at start/end if any
            const childCenter = child.offsetLeft + child.offsetWidth / 2;
            const distance = Math.abs(center - childCenter);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = index;
            }
        });

        if (focusedIndicesRef.current[trainId] !== closestIndex) {
            focusedIndicesRef.current[trainId] = closestIndex;
            // Debounce or optimize this? For now, request animation frame or simple state set
            // Ideally we animate via CSS based on scroll-position, but that is complex.
            // Let's force re-render to apply 'scale' classes.
            setForceUpdate(prev => prev + 1);
        }
    };

    // Auto-scroll to end of my train when piece added
    useEffect(() => {
        const myTrain = room.trains.find(t => t.ownerId === currentUserId);
        if (myTrain && trainRefs.current[myTrain.id]) {
            setTimeout(() => {
                trainRefs.current[myTrain.id]?.scrollTo({
                    left: trainRefs.current[myTrain.id]?.scrollWidth,
                    behavior: 'smooth'
                });
            }, 100);
        }
    }, [room.trains]);

    const isMyTurn = room.currentTurn === currentUserId;
    const currentPlayer = room.players.find(p => p.id === currentUserId);
    const serverHand = currentPlayer?.hand || [];
    const myHand = localHand || serverHand;
    const currentTurnPlayer = room.players.find(p => p.id === room.currentTurn);

    // Sync local hand with server when server changes
    useEffect(() => {
        if (JSON.stringify(serverHand.map(p => p.id)) !== JSON.stringify(localHand?.map(p => p.id))) {
            setLocalHand(null);
        }
    }, [serverHand]);

    const canPlayOnTrain = (piece: DominoPieceType, train: Train): { canPlay: boolean; needsFlip: boolean } => {
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

    const handlePlaceOnTrain = async (train: Train, pieceId?: string) => {
        const piece = pieceId
            ? myHand.find(p => p.id === pieceId)
            : selectedPiece;

        if (!piece || !isMyTurn) return;

        const { canPlay, needsFlip } = canPlayOnTrain(piece, train);
        if (!canPlay) return;

        const success = await onPlacePiece(piece.id, train.id, needsFlip);
        if (success) {
            setSelectedPiece(null);
            setLocalHand(null);
        }
    };

    const handleDraw = async () => {
        if (!isMyTurn || room.boneyard.length === 0) return;
        await onDrawPiece();
        setLocalHand(null);
    };

    const handlePass = () => {
        if (!isMyTurn) return;
        onPassTurn();
    };

    const handleReorderHand = (newOrder: DominoPieceType[]) => {
        setLocalHand(newOrder);
        onReorderHand?.(newOrder);
    };

    // Drag and drop handlers for trains
    const handleDragOver = (e: React.DragEvent, trainId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverTrain(trainId);
    };

    const handleDragLeave = () => {
        setDragOverTrain(null);
    };

    const handleDropOnTrain = async (e: React.DragEvent, train: Train) => {
        e.preventDefault();
        setDragOverTrain(null);

        const pieceId = e.dataTransfer.getData('text/plain');
        if (pieceId) {
            await handlePlaceOnTrain(train, pieceId);
        }
    };

    const handleHandDragStart = (pieceId: string) => {
        setDraggingPieceId(pieceId);
    };

    const handleHandDragEnd = () => {
        setDraggingPieceId(null);
    };

    const effectiveSelectedPiece = draggingPieceId
        ? myHand.find(p => p.id === draggingPieceId) || null
        : selectedPiece;

    const playableTrains = effectiveSelectedPiece ? getPlayableTrains(effectiveSelectedPiece) : [];
    const playablePieceIds = myHand.filter(p => getPlayableTrains(p).length > 0).map(p => p.id);
    const hasPlayablePiece = playablePieceIds.length > 0;

    return (
        <div className="h-full flex flex-col bg-gradient-to-b from-slate-100 to-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 p-2 shadow-lg z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur">
                            <span className="text-lg">🎲</span>
                        </div>
                        <div>
                            <h2 className="font-bold text-white text-xs leading-none">Dominó</h2>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${isMyTurn ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
                                <p className="text-white/90 text-[10px] font-medium leading-none">
                                    {isMyTurn ? 'Sua vez' : `Vez de ${currentTurnPlayer?.name.split(' ')[0]}`}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-center bg-white/10 rounded-lg px-2 py-1 backdrop-blur min-w-[50px]">
                            <p className="text-[9px] text-white/70 uppercase tracking-widest leading-none mb-0.5">Monte</p>
                            <p className="text-sm font-bold text-white leading-none">{room.boneyard.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Players Row */}
            <div className="flex-shrink-0 flex gap-1.5 p-1.5 overflow-x-auto bg-white/60 backdrop-blur border-b border-slate-200 no-scrollbar">
                {room.players.map((p, idx) => (
                    <div
                        key={p.id}
                        className={`
                            flex items-center gap-1.5 px-2 py-1 rounded-full transition-all flex-shrink-0
                            ${p.id === room.currentTurn
                                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm ring-1 ring-orange-200'
                                : 'bg-white text-slate-600 border border-slate-100'}
                        `}
                    >
                        <span className="text-xs">
                            {idx === 0 ? '👑' : p.id === currentUserId ? '👤' : '🤖'}
                        </span>
                        <span className="font-bold text-[10px] truncate max-w-[60px]">{p.name.split(' ')[0]}</span>
                        <span className={`
                            px-1.5 py-0.5 rounded-full text-[9px] font-bold min-w-[20px] text-center
                            ${p.id === room.currentTurn ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}
                        `}>
                            {p.hand.length}
                        </span>
                    </div>
                ))}
            </div>

            {/* Game Area */}
            <div className="flex-1 overflow-y-auto p-3 min-h-0">
                {/* Hub Central */}
                <div className="flex justify-center mb-4">
                    {room.hubPiece && (
                        <div className="text-center">
                            <div className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold mb-2">
                                <span>⭐</span>
                                <span>HUB CENTRAL</span>
                                <span>⭐</span>
                            </div>
                            <div className="transform hover:scale-105 transition-transform">
                                <DominoPiece piece={room.hubPiece} size="md" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Train View - Shows focused train (My Train by default) */}
                {(() => {
                    const myTrain = room.trains.find(t => t.ownerId === currentUserId);
                    const focusedTrain = focusedTrainId
                        ? room.trains.find(t => t.id === focusedTrainId)
                        : myTrain;

                    if (!focusedTrain) return null;

                    const isMexican = focusedTrain.ownerId === null;
                    const isMyTrain = focusedTrain.ownerId === currentUserId;
                    const isPlayable = playableTrains.some(t => t.id === focusedTrain.id);
                    const canAccess = isMexican || isMyTrain || focusedTrain.isOpen;
                    const isDragOver = dragOverTrain === focusedTrain.id;
                    const owner = focusedTrain.ownerId ? room.players.find(p => p.id === focusedTrain.ownerId) : null;

                    return (
                        <div
                            data-train-id={focusedTrain.id}
                            onDragOver={(e) => canAccess && isMyTurn && handleDragOver(e, focusedTrain.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => canAccess && isMyTurn && handleDropOnTrain(e, focusedTrain)}
                            onClick={() => isPlayable && handlePlaceOnTrain(focusedTrain)}
                            className={`
                                rounded-2xl p-4 transition-all relative mb-4
                                ${isMyTrain
                                    ? 'bg-gradient-to-br from-emerald-50 via-white to-teal-50'
                                    : isMexican
                                        ? 'bg-gradient-to-br from-amber-50 via-white to-orange-50 border border-amber-200'
                                        : 'bg-gradient-to-br from-slate-50 via-white to-slate-100 border border-slate-200'}
                                ${isPlayable ? 'ring-2 ring-green-400 cursor-pointer shadow-lg' : 'shadow-md'}
                                ${isDragOver && canAccess ? 'ring-4 ring-blue-400 scale-[1.01] bg-blue-50' : ''}
                            `}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">
                                        {isMexican ? '🚂' : isMyTrain ? '🏠' : focusedTrain.isOpen ? '🔓' : '🔒'}
                                    </span>
                                    <div>
                                        <span className={`font-bold text-base ${isMexican ? 'text-amber-700' : isMyTrain ? 'text-emerald-700' : 'text-slate-700'}`}>
                                            {isMexican ? 'Trem Mexicano' : isMyTrain ? 'Meu Trem' : `Trem de ${owner?.name.split(' ')[0]}`}
                                        </span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-slate-400">{focusedTrain.pieces.length} peças</span>
                                            {focusedTrain.isOpen && !isMexican && (
                                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-bold">
                                                    ABERTO
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isMyTrain && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFocusedTrainId(null); // Back to My Train
                                            }}
                                            className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors"
                                        >
                                            ← Voltar
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setViewingTrain(focusedTrain);
                                        }}
                                        className="px-3 py-1 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors"
                                    >
                                        Ver Tudo
                                    </button>
                                    {isDragOver && canAccess && (
                                        <span className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded-full text-[10px] font-bold animate-pulse">
                                            <Icon name="download" size={10} />
                                            SOLTAR
                                        </span>
                                    )}
                                    {isPlayable && !isDragOver && (
                                        <span className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white rounded-full text-[10px] font-bold">
                                            <Icon name="check" size={10} />
                                            JOGAR
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Carousel */}
                            <div
                                className="flex items-center gap-4 overflow-x-auto pb-4 pt-2 scrollbar-hide snap-x snap-mandatory"
                                style={{ paddingLeft: '40%', paddingRight: '40%' }}
                                ref={el => { if (el) trainRefs.current[focusedTrain.id] = el; }}
                                onScroll={() => handleTrainScroll(focusedTrain.id)}
                            >
                                {focusedTrain.pieces.length === 0 ? (
                                    <div className="flex items-center justify-center w-full py-8 text-slate-400">
                                        <div className="text-center">
                                            <span className="text-3xl">📍</span>
                                            <p className="text-sm mt-2">Ponta: {focusedTrain.openEndText}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {focusedTrain.pieces.map((placed, idx) => {
                                            const isFocused = focusedIndicesRef.current[focusedTrain.id] === idx;
                                            return (
                                                <div
                                                    key={`${focusedTrain.id}-${idx}`}
                                                    className={`
                                                        transform transition-all duration-300 snap-center flex-shrink-0 cursor-pointer
                                                        ${isFocused
                                                            ? 'scale-150 z-20 opacity-100 drop-shadow-xl'
                                                            : 'scale-75 opacity-50 blur-[0.5px] grayscale-[0.3]'}
                                                    `}
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation();
                                                        setViewingPiece(placed.piece);
                                                    }}
                                                >
                                                    <DominoPiece
                                                        piece={placed.piece}
                                                        flipped={placed.orientation === 'flipped'}
                                                        size="md"
                                                    />
                                                </div>
                                            );
                                        })}
                                        {/* Drop Zone */}
                                        {canAccess && isMyTurn && (
                                            <div className="snap-center flex-shrink-0">
                                                <div className={`
                                                    w-[70px] h-[45px] rounded-xl border-2 border-dashed flex items-center justify-center transition-all
                                                    ${isDragOver ? 'border-blue-500 bg-blue-100 text-blue-600' : 'border-slate-300 text-slate-400 bg-slate-50'}
                                                `}>
                                                    <Icon name={isDragOver ? "download" : "plus"} size={18} />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {/* Other Trains Bar */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {room.trains
                        .filter(t => t.ownerId !== currentUserId) // Exclude My Train
                        .map(train => {
                            const isMexican = train.ownerId === null;
                            const owner = train.ownerId ? room.players.find(p => p.id === train.ownerId) : null;
                            const isPlayable = playableTrains.some(t => t.id === train.id);
                            const isFocused = focusedTrainId === train.id;
                            const isDragOver = dragOverTrain === train.id;

                            return (
                                <div
                                    key={train.id}
                                    data-train-id={train.id}
                                    onClick={() => isPlayable && handlePlaceOnTrain(train)}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        setFocusedTrainId(train.id);
                                    }}
                                    onDragOver={(e) => isMyTurn && handleDragOver(e, train.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => isMyTurn && handleDropOnTrain(e, train)}
                                    className={`
                                        flex-shrink-0 p-3 rounded-xl transition-all cursor-pointer min-w-[120px]
                                        ${isMexican
                                            ? 'bg-amber-50 border border-amber-200'
                                            : 'bg-slate-50 border border-slate-200'}
                                        ${isFocused ? 'ring-2 ring-blue-400' : ''}
                                        ${isPlayable ? 'ring-2 ring-green-400' : ''}
                                        ${isDragOver ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                                        hover:shadow-md
                                    `}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm">{isMexican ? '🚂' : train.isOpen ? '🔓' : '🔒'}</span>
                                        <span className="text-xs font-bold text-slate-600 truncate">
                                            {isMexican ? 'Mexicano' : owner?.name.split(' ')[0]}
                                        </span>
                                    </div>
                                    <div className="flex gap-1 overflow-hidden">
                                        {train.pieces.slice(-3).map((p, i) => (
                                            <div key={i} className="w-6 h-8 bg-white rounded border border-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-400">
                                                {p.piece.leftIndex}|{p.piece.rightIndex}
                                            </div>
                                        ))}
                                        {train.pieces.length === 0 && (
                                            <span className="text-[10px] text-slate-400">Vazio</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">{train.pieces.length} peças • Toque 2x para ver</p>
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* My Hand */}
            <div className={`
                flex-shrink-0 border-t-2 bg-white p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]
                ${isMyTurn ? 'border-orange-400' : 'border-slate-200'}
            `}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🎯</span>
                        <h3 className="font-bold text-slate-700 text-sm">
                            Minha Mão
                            <span className="ml-1 text-slate-400">({myHand.length} peças)</span>
                        </h3>
                        {!hasPlayablePiece && isMyTurn && room.boneyard.length > 0 && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">
                                Sem jogadas - Compre!
                            </span>
                        )}
                    </div>

                    {isMyTurn && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleDraw}
                                disabled={room.boneyard.length === 0}
                                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                            >
                                <Icon name="plus-circle" size={14} />
                                Comprar
                            </button>
                            <button
                                onClick={() => setShowHandModal(true)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95"
                            >
                                <Icon name="layout-grid" size={14} />
                                Ver Tudo
                            </button>
                            <button
                                onClick={handlePass}
                                className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all active:scale-95"
                            >
                                <Icon name="skip-forward" size={14} />
                                Passar
                            </button>
                        </div>
                    )}
                </div>

                <PlayerHand
                    pieces={myHand}
                    isMyTurn={isMyTurn}
                    selectedPieceId={selectedPiece?.id || null}
                    playablePieceIds={playablePieceIds}
                    onSelectPiece={handleSelectPiece}
                    onDragStart={handleHandDragStart}
                    onDragEnd={handleHandDragEnd}
                    onTrainHover={(trainId) => setDragOverTrain(trainId)}
                    onTrainDrop={async (trainId, pieceId) => {
                        setDragOverTrain(null);
                        const train = room.trains.find(t => t.id === trainId);
                        if (train) await handlePlaceOnTrain(train, pieceId);
                    }}
                    onPieceDoubleClick={(piece) => setViewingPiece(piece)}
                />

                {!isMyTurn && (
                    <div className="flex items-center justify-center gap-2 mt-2 p-2 bg-slate-100 rounded-lg">
                        <div className="animate-spin" style={{ animationDuration: '3s' }}>
                            <Icon name="clock" size={14} className="text-slate-400" />
                        </div>
                        <p className="text-xs text-slate-500">Aguardando {currentTurnPlayer?.name.split(' ')[0]}...</p>
                    </div>
                )}
            </div>

            {/* Hand View Modal */}
            {
                showHandModal && (
                    <HandViewModal
                        pieces={myHand}
                        onClose={() => setShowHandModal(false)}
                        onReorder={handleReorderHand}
                    />
                )
            }

            {/* Train View Modal */}
            {
                viewingTrain && (
                    <TrainViewModal
                        train={viewingTrain}
                        isMyTrain={viewingTrain?.ownerId === currentUserId}
                        onClose={() => setViewingTrain(null)}
                    />
                )
            }

            {/* Piece Detail Modal */}
            {viewingPiece && (
                <DominoPieceModal
                    piece={viewingPiece}
                    isOpen={true}
                    onClose={() => setViewingPiece(null)}
                />
            )}
        </div>
    );
};
