import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DominoPiece as DominoPieceType } from '../types';
import { DominoPiece } from './DominoPiece';
import Icon from '../../../components/Icon';

interface PlayerHandCarouselProps {
    pieces: DominoPieceType[];
    playablePieceIds: string[];
    isMyTurn: boolean;
    onPlay: (piece: DominoPieceType) => void;
    onClose: () => void;
}

export const PlayerHandCarousel: React.FC<PlayerHandCarouselProps> = ({
    pieces,
    playablePieceIds,
    isMyTurn,
    onPlay,
    onClose
}) => {
    const [activeIndex, setActiveIndex] = useState(0);

    // If pieces change and activeIndex is out of bounds
    useEffect(() => {
        if (activeIndex >= pieces.length && pieces.length > 0) {
            setActiveIndex(Math.max(0, pieces.length - 1));
        }
    }, [pieces.length]);

    if (pieces.length === 0) return null;

    const activePiece = pieces[activeIndex];
    const canPlayActive = playablePieceIds.includes(activePiece?.id);

    const handleDragEnd = (event: any, info: any) => {
        // Swipe Horizontal to navigate
        const swipeThreshold = 50;
        if (info.offset.x < -swipeThreshold && activeIndex < pieces.length - 1) {
            setActiveIndex(activeIndex + 1);
        } else if (info.offset.x > swipeThreshold && activeIndex > 0) {
            setActiveIndex(activeIndex - 1);
        }
        // Swipe Up to play
        else if (info.offset.y < -100 && canPlayActive && isMyTurn) {
            onPlay(activePiece);
        }
    };

    const nextPiece = () => {
        if (activeIndex < pieces.length - 1) setActiveIndex(activeIndex + 1);
    };

    const prevPiece = () => {
        if (activeIndex > 0) setActiveIndex(activeIndex - 1);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-0 z-50 bg-slate-900/98 backdrop-blur-xl flex flex-col pt-8 pb-8 px-4"
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-8 relative z-10 w-full max-w-4xl mx-auto px-4">
                    <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                        <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                            <Icon name="grid" size={24} className="text-white" />
                        </div>
                        Meu Trem
                        <span className="bg-slate-800 text-slate-300 text-sm font-bold ml-2 px-3 py-1 rounded-full border border-slate-700">
                            {activeIndex + 1} de {pieces.length}
                        </span>
                    </h2>
                    <button onClick={onClose} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-full text-white transition-colors border border-slate-700 shadow-xl">
                        <Icon name="x" size={24} />
                    </button>
                </div>

                {/* Main Carousel Area */}
                <div className="flex-1 flex flex-col items-center justify-center relative w-full overflow-hidden max-w-6xl mx-auto">

                    {/* Swipe Up Hint */}
                    <AnimatePresence>
                        {canPlayActive && isMyTurn && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 0.8, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="absolute top-[2vh] w-full flex justify-center z-0 pointer-events-none"
                            >
                                <div className="flex flex-col items-center text-green-400 animate-bounce">
                                    <Icon name="chevron-up" size={40} />
                                    <span className="text-sm font-black tracking-widest uppercase mt-2 bg-green-900/50 px-4 py-1 rounded-full border border-green-500/30 backdrop-blur-sm shadow-lg">
                                        Arraste para Jogar
                                    </span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex items-center justify-center w-full h-[60vh] relative perspective-1000 mt-8">
                        {/* Prev Card Phantom */}
                        <AnimatePresence>
                            {activeIndex > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, x: -50 }}
                                    animate={{ opacity: 0.3, x: 0 }}
                                    exit={{ opacity: 0, x: -50 }}
                                    className="absolute left-0 lg:left-20 scale-75 blur-[4px] cursor-pointer hover:opacity-100 transition-all -translate-x-1/2 z-0 hidden sm:block"
                                    onClick={prevPiece}
                                >
                                    <DominoPiece piece={pieces[activeIndex - 1]} size="giant" orientation="vertical" />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Active Card */}
                        <AnimatePresence mode="popLayout">
                            <motion.div
                                key={activePiece.id}
                                drag
                                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                                dragElastic={0.4}
                                onDragEnd={handleDragEnd}
                                initial={{ scale: 0.8, opacity: 0, x: 100 }}
                                animate={{ scale: 1, opacity: 1, x: 0 }}
                                exit={{ scale: 0.8, opacity: 0, x: -100 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className={`z-10 cursor-grab active:cursor-grabbing flex justify-center w-auto ${canPlayActive && isMyTurn ? 'ring-4 ring-green-500 rounded-3xl shadow-[0_0_50px_rgba(34,197,94,0.3)]' : ''}`}
                            >
                                <DominoPiece
                                    piece={activePiece}
                                    size="giant"
                                    canPlay={canPlayActive}
                                    isUnplayableInHand={isMyTurn && !canPlayActive}
                                    orientation="vertical"
                                />
                            </motion.div>
                        </AnimatePresence>

                        {/* Next Card Phantom */}
                        <AnimatePresence>
                            {activeIndex < pieces.length - 1 && (
                                <motion.div
                                    initial={{ opacity: 0, x: 50 }}
                                    animate={{ opacity: 0.3, x: 0 }}
                                    exit={{ opacity: 0, x: 50 }}
                                    className="absolute right-0 lg:right-20 scale-75 blur-[4px] cursor-pointer hover:opacity-100 transition-all translate-x-1/2 z-0 hidden sm:block"
                                    onClick={nextPiece}
                                >
                                    <DominoPiece piece={pieces[activeIndex + 1]} size="giant" orientation="vertical" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer / Controls */}
                    <div className="w-full flex justify-between items-center mt-auto px-2 sm:px-8 z-20 gap-4 mb-4">
                        <button
                            onClick={prevPiece}
                            disabled={activeIndex === 0}
                            className="p-4 sm:p-6 bg-slate-800 rounded-full text-white disabled:opacity-20 transition-all active:scale-90 hover:bg-slate-700 shadow-xl border border-slate-700"
                        >
                            <Icon name="chevron-left" size={32} />
                        </button>

                        {/* Play Action Button (Alternative to wipe) */}
                        <div className="flex-1 flex justify-center max-w-sm">
                            {canPlayActive && isMyTurn ? (
                                <button
                                    onClick={() => onPlay(activePiece)}
                                    className="w-full py-4 sm:py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-xl sm:text-2xl rounded-2xl shadow-[0_10px_30px_rgba(34,197,94,0.4)] transform hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3 border-b-4 border-green-700"
                                >
                                    <Icon name="play" size={28} /> JOGAR PEÇA
                                </button>
                            ) : (
                                <div className="w-full py-4 sm:py-5 bg-slate-800/80 rounded-2xl border-2 border-dashed border-slate-700 text-slate-400 font-bold text-center flex items-center justify-center gap-2">
                                    <Icon name={!isMyTurn ? "clock" : "ban"} />
                                    {!isMyTurn ? "Aguarde sua vez" : "Essa peça não encaixa"}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={nextPiece}
                            disabled={activeIndex === pieces.length - 1}
                            className="p-4 sm:p-6 bg-slate-800 rounded-full text-white disabled:opacity-20 transition-all active:scale-90 hover:bg-slate-700 shadow-xl border border-slate-700"
                        >
                            <Icon name="chevron-right" size={32} />
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
