import React, { useState, useRef } from 'react';
import { DominoPiece as DominoPieceType } from '../types';
import Icon from '../../../components/Icon';

interface DominoPieceProps {
    piece: DominoPieceType;
    orientation?: 'horizontal' | 'vertical';
    flipped?: boolean;
    selected?: boolean;
    disabled?: boolean;
    canPlay?: boolean;
    onClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
    draggable?: boolean;
}

// Modal para visualizar texto completo
const TextPreviewModal: React.FC<{
    piece: DominoPieceType;
    flipped?: boolean;
    onClose: () => void;
}> = ({ piece, flipped = false, onClose }) => {
    const leftText = flipped ? piece.rightText : piece.leftText;
    const rightText = flipped ? piece.leftText : piece.rightText;
    const leftIndex = flipped ? piece.rightIndex : piece.leftIndex;
    const rightIndex = flipped ? piece.leftIndex : piece.rightIndex;

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl max-w-sm w-full shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        🎲 Detalhes da Peça
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <Icon name="x" size={20} className="text-slate-500" />
                    </button>
                </div>
                <div className="p-4 space-y-4">
                    {/* Lado Esquerdo/Superior */}
                    <div className="bg-gradient-to-r from-sky-50 to-sky-100 rounded-xl p-4 border border-sky-200">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 bg-sky-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                {leftIndex}
                            </span>
                            <span className="text-xs text-sky-600 font-medium uppercase">Termo</span>
                        </div>
                        <p className="text-sky-900 font-semibold text-lg break-words">{leftText}</p>
                    </div>

                    {/* Separador */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-slate-400">↔</span>
                        <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    {/* Lado Direito/Inferior */}
                    <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                {rightIndex}
                            </span>
                            <span className="text-xs text-emerald-600 font-medium uppercase">Definição</span>
                        </div>
                        <p className="text-emerald-900 font-semibold text-lg break-words">{rightText}</p>
                    </div>

                    {piece.isHub && (
                        <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-center">
                            <span className="text-amber-700 font-medium text-sm">⭐ Esta é a peça central (Hub)</span>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export const DominoPiece: React.FC<DominoPieceProps> = ({
    piece,
    orientation = 'horizontal',
    flipped = false,
    selected = false,
    disabled = false,
    canPlay = false,
    onClick,
    size = 'md',
    draggable = false
}) => {
    const [showModal, setShowModal] = useState(false);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const [isLongPress, setIsLongPress] = useState(false);

    const leftText = flipped ? piece.rightText : piece.leftText;
    const rightText = flipped ? piece.leftText : piece.rightText;
    const leftIndex = flipped ? piece.rightIndex : piece.leftIndex;
    const rightIndex = flipped ? piece.leftIndex : piece.rightIndex;

    const sizeConfig = {
        sm: { container: 'min-w-[75px]', text: 'text-[9px]', index: 'text-[7px]', padding: 'p-1.5', height: 'h-[60px]' },
        md: { container: 'min-w-[100px]', text: 'text-[11px]', index: 'text-[8px]', padding: 'p-2', height: 'h-[80px]' },
        lg: { container: 'min-w-[130px]', text: 'text-sm', index: 'text-[9px]', padding: 'p-2.5', height: 'h-[100px]' }
    };

    const config = sizeConfig[size];
    const isDouble = leftIndex === rightIndex;

    // Long press handlers for preview
    const handlePointerDown = () => {
        setIsLongPress(false);
        longPressTimer.current = setTimeout(() => {
            setIsLongPress(true);
            setShowModal(true);
        }, 500); // 500ms for long press
    };

    const handlePointerUp = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handlePointerLeave = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        // Don't trigger click if it was a long press
        if (isLongPress) {
            setIsLongPress(false);
            return;
        }

        if (onClick) {
            onClick();
        }
    };

    // Double click to preview
    const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowModal(true);
    };

    // 3D color effects
    const get3DColors = (isLeft: boolean) => {
        if (piece.isHub) {
            return {
                bg: 'bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500',
                border: isLeft ? 'border-r border-amber-600/30' : '',
                shadow: 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.1)]',
                text: 'text-amber-900'
            };
        }
        if (isDouble) {
            return {
                bg: 'bg-gradient-to-br from-orange-200 via-orange-300 to-orange-400',
                border: isLeft ? 'border-r border-orange-500/30' : '',
                shadow: 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.1)]',
                text: 'text-orange-900'
            };
        }
        if (isLeft) {
            return {
                bg: 'bg-gradient-to-br from-sky-200 via-sky-300 to-sky-400',
                border: 'border-r border-sky-500/30',
                shadow: 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.1)]',
                text: 'text-sky-900'
            };
        }
        return {
            bg: 'bg-gradient-to-br from-emerald-200 via-emerald-300 to-emerald-400',
            border: '',
            shadow: 'shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.1)]',
            text: 'text-emerald-900'
        };
    };

    const leftColors = get3DColors(true);
    const rightColors = get3DColors(false);

    // 3D container styles
    const containerClasses = `
        transition-all duration-200 rounded-xl overflow-hidden
        bg-gradient-to-b from-slate-100 to-slate-300
        shadow-[0_4px_6px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.5)]
        ${piece.isHub ? 'ring-2 ring-amber-400 ring-offset-1' : 'border border-slate-400/30'}
        ${selected ? 'ring-4 ring-orange-400 ring-offset-2 scale-110 shadow-2xl -translate-y-1' : ''}
        ${canPlay && !selected ? 'ring-2 ring-green-400 shadow-lg shadow-green-200/50' : ''}
        ${disabled ? 'opacity-70' : 'hover:shadow-xl hover:scale-105 hover:-translate-y-0.5 active:scale-100 active:translate-y-0 cursor-pointer'}
        ${config.container}
    `;

    const renderSide = (text: string, index: number, isLeft: boolean) => {
        const colors = isLeft ? leftColors : rightColors;
        return (
            <div className={`
                flex-1 ${config.padding} text-center flex flex-col justify-center
                ${colors.bg} ${colors.border} ${colors.shadow}
            `}>
                <span className={`block truncate leading-tight font-semibold ${config.text} ${colors.text}`}>
                    {text}
                </span>
                <span className={`${config.index} opacity-60 font-medium mt-0.5`}>{index}</span>
            </div>
        );
    };

    if (orientation === 'vertical') {
        return (
            <>
                <div
                    onClick={handleClick}
                    onDoubleClick={handleDoubleClick}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerLeave}
                    className={`flex flex-col ${containerClasses} ${config.height} select-none touch-none`}
                    style={{ transform: selected ? 'perspective(500px) rotateX(-5deg) translateY(-4px)' : '' }}
                >
                    <div className={`
                        flex-1 ${config.padding} text-center flex flex-col justify-center
                        ${leftColors.bg} border-b border-white/20 ${leftColors.shadow}
                    `}>
                        <span className={`block truncate leading-tight font-semibold ${config.text} ${leftColors.text}`}>
                            {leftText}
                        </span>
                        <span className={`${config.index} opacity-60 font-medium`}>{leftIndex}</span>
                    </div>
                    <div className={`
                        flex-1 ${config.padding} text-center flex flex-col justify-center
                        ${rightColors.bg} ${rightColors.shadow}
                    `}>
                        <span className={`block truncate leading-tight font-semibold ${config.text} ${rightColors.text}`}>
                            {rightText}
                        </span>
                        <span className={`${config.index} opacity-60 font-medium`}>{rightIndex}</span>
                    </div>
                </div>
                {showModal && <TextPreviewModal piece={piece} flipped={flipped} onClose={() => setShowModal(false)} />}
            </>
        );
    }

    return (
        <>
            <div
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                className={`flex ${containerClasses} select-none`}
                style={{ transform: selected ? 'perspective(500px) rotateY(5deg) translateY(-4px)' : '' }}
            >
                {renderSide(leftText, leftIndex, true)}
                {renderSide(rightText, rightIndex, false)}
            </div>
            {showModal && <TextPreviewModal piece={piece} flipped={flipped} onClose={() => setShowModal(false)} />}
        </>
    );
};
