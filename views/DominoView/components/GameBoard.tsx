import React, { useState } from 'react';
import Icon from '../../../components/Icon';
import { DominoRoom, DominoPiece as DominoPieceType, Train } from '../types';
import { DominoPiece } from './DominoPiece';

interface GameBoardProps {
    room: DominoRoom;
    currentUserId: string;
    onPlacePiece: (pieceId: string, trainId: string, flipped: boolean) => Promise<boolean>;
    onDrawPiece: () => Promise<DominoPieceType | null>;
    onPassTurn: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
    room,
    currentUserId,
    onPlacePiece,
    onDrawPiece,
    onPassTurn
}) => {
    const [selectedPiece, setSelectedPiece] = useState<DominoPieceType | null>(null);
    const [isFlipped, setIsFlipped] = useState(false);

    const isMyTurn = room.currentTurn === currentUserId;
    const currentPlayer = room.players.find(p => p.id === currentUserId);
    const myHand = currentPlayer?.hand || [];

    const canPlayOnTrain = (piece: DominoPieceType, train: Train): { canPlay: boolean; needsFlip: boolean } => {
        // Termo i conecta com Definição i
        // A ponta do trem expõe um índice. Precisamos de uma peça que tenha esse índice em um dos lados.
        const targetIndex = train.openEndIndex;

        if (piece.leftIndex === targetIndex) {
            return { canPlay: true, needsFlip: false };
        }
        if (piece.rightIndex === targetIndex) {
            return { canPlay: true, needsFlip: true };
        }
        return { canPlay: false, needsFlip: false };
    };

    const getPlayableTrains = (piece: DominoPieceType): Train[] => {
        return room.trains.filter(train => {
            // Pode jogar no próprio trem ou no mexicano
            // Ou em trens abertos de outros
            const canAccess = train.ownerId === null || // Mexicano
                train.ownerId === currentUserId || // Próprio
                train.isOpen; // Aberto

            if (!canAccess) return false;

            const { canPlay } = canPlayOnTrain(piece, train);
            return canPlay;
        });
    };

    const handleSelectPiece = (piece: DominoPieceType) => {
        if (!isMyTurn) return;

        if (selectedPiece?.id === piece.id) {
            setSelectedPiece(null);
            setIsFlipped(false);
        } else {
            setSelectedPiece(piece);
            setIsFlipped(false);
        }
    };

    const handlePlaceOnTrain = async (train: Train) => {
        if (!selectedPiece || !isMyTurn) return;

        const { canPlay, needsFlip } = canPlayOnTrain(selectedPiece, train);
        if (!canPlay) return;

        const success = await onPlacePiece(selectedPiece.id, train.id, needsFlip);
        if (success) {
            setSelectedPiece(null);
            setIsFlipped(false);
        }
    };

    const handleDraw = async () => {
        if (!isMyTurn || room.boneyard.length === 0) return;
        await onDrawPiece();
    };

    const handlePass = () => {
        if (!isMyTurn) return;
        onPassTurn();
    };

    const playableTrains = selectedPiece ? getPlayableTrains(selectedPiece) : [];

    return (
        <div className="h-full flex flex-col p-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-4 text-white mb-4 flex justify-between items-center">
                <div>
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        🎲 Dominó Mexicano
                    </h2>
                    <p className="text-orange-100 text-sm">
                        Vez de: {room.players.find(p => p.id === room.currentTurn)?.name}
                        {isMyTurn && ' (Você!)'}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-orange-100">Monte</p>
                    <p className="text-2xl font-bold">{room.boneyard.length}</p>
                </div>
            </div>

            {/* Hub + Trains */}
            <div className="flex-1 bg-green-800 rounded-xl p-4 overflow-auto mb-4">
                {/* Hub Central */}
                <div className="flex justify-center mb-6">
                    {room.hubPiece && (
                        <div className="text-center">
                            <p className="text-white text-xs mb-2 font-bold">🌟 HUB CENTRAL 🌟</p>
                            <DominoPiece piece={room.hubPiece} size="lg" disabled />
                        </div>
                    )}
                </div>

                {/* Trains */}
                <div className="space-y-4">
                    {room.trains.map(train => {
                        const owner = train.ownerId
                            ? room.players.find(p => p.id === train.ownerId)
                            : null;
                        const isMexican = train.ownerId === null;
                        const isPlayable = playableTrains.some(t => t.id === train.id);

                        return (
                            <div
                                key={train.id}
                                className={`
                                    bg-green-700/50 rounded-lg p-3
                                    ${isPlayable ? 'ring-2 ring-yellow-400 cursor-pointer' : ''}
                                `}
                                onClick={() => isPlayable && handlePlaceOnTrain(train)}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">
                                        {isMexican ? '🚂' : (train.isOpen ? '🔓' : '🔒')}
                                    </span>
                                    <span className="text-white font-medium text-sm">
                                        {isMexican ? 'Trem Mexicano' : `Trem de ${owner?.name}`}
                                    </span>
                                    {train.isOpen && !isMexican && (
                                        <span className="text-xs bg-yellow-500 text-yellow-900 px-2 py-0.5 rounded-full">
                                            ABERTO
                                        </span>
                                    )}
                                    {isPlayable && (
                                        <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full ml-auto">
                                            PODE JOGAR
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {train.pieces.length === 0 ? (
                                        <div className="text-green-400/50 text-xs italic">
                                            Ponta: [{train.openEndIndex}] {train.openEndText}
                                        </div>
                                    ) : (
                                        train.pieces.map((placed, idx) => (
                                            <DominoPiece
                                                key={`${train.id}-${idx}`}
                                                piece={placed.piece}
                                                flipped={placed.orientation === 'flipped'}
                                                size="sm"
                                                disabled
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* My Hand */}
            <div className="bg-white rounded-xl p-4 shadow-lg border-2 border-slate-200">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-slate-700">
                        Minha Mão ({myHand.length} peças)
                    </h3>
                    {isMyTurn && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleDraw}
                                disabled={room.boneyard.length === 0}
                                className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                            >
                                <Icon name="download" size={14} className="inline mr-1" />
                                Comprar
                            </button>
                            <button
                                onClick={handlePass}
                                className="px-3 py-1 bg-slate-500 text-white rounded-lg text-sm font-medium"
                            >
                                Passar
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2">
                    {myHand.map(piece => {
                        const canPlay = isMyTurn && getPlayableTrains(piece).length > 0;
                        return (
                            <DominoPiece
                                key={piece.id}
                                piece={piece}
                                orientation="vertical"
                                selected={selectedPiece?.id === piece.id}
                                disabled={!isMyTurn}
                                onClick={() => handleSelectPiece(piece)}
                                size="md"
                            />
                        );
                    })}
                </div>

                {selectedPiece && (
                    <p className="text-xs text-orange-600 mt-2">
                        Peça selecionada! Clique em um trem destacado para jogar.
                    </p>
                )}
            </div>

            {/* Players Scoreboard */}
            <div className="flex gap-2 mt-4 overflow-x-auto">
                {room.players.map(p => (
                    <div
                        key={p.id}
                        className={`
                            flex-shrink-0 px-3 py-2 rounded-lg text-sm
                            ${p.id === room.currentTurn ? 'bg-orange-100 text-orange-800' : 'bg-slate-100'}
                        `}
                    >
                        <span className="font-bold">{p.name}</span>
                        <span className="ml-2 text-slate-500">{p.hand.length} peças</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
