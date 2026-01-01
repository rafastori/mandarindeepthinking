import React from 'react';
import { DominoPiece as DominoPieceType } from '../types';

interface DominoPieceProps {
    piece: DominoPieceType;
    orientation?: 'horizontal' | 'vertical';
    flipped?: boolean;
    selected?: boolean;
    disabled?: boolean;
    canPlay?: boolean;
    onClick?: () => void;
    onDoubleClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
    draggable?: boolean;
}

export const DominoPiece: React.FC<DominoPieceProps> = ({
    piece,
    orientation = 'horizontal',
    flipped = false,
    selected = false,
    disabled = false,
    canPlay = false,
    onClick,
    onDoubleClick,
    size = 'md',
    draggable = false
}) => {

    const leftText = flipped ? piece.rightText : piece.leftText;
    const rightText = flipped ? piece.leftText : piece.rightText;
    const leftIndex = flipped ? piece.rightIndex : piece.leftIndex;
    const rightIndex = flipped ? piece.leftIndex : piece.rightIndex;

    const sizeConfig = {
        sm: { container: 'min-w-[85px]', text: 'text-[9px]', index: 'text-[7px]', padding: 'p-1', height: 'h-[60px]' },
        md: { container: 'min-w-[100px]', text: 'text-[11px]', index: 'text-[8px]', padding: 'p-2', height: 'h-[80px]' },
        lg: { container: 'min-w-[130px]', text: 'text-sm', index: 'text-[9px]', padding: 'p-2.5', height: 'h-[100px]' }
    };

    const config = sizeConfig[size];
    const isDouble = leftIndex === rightIndex;

    const handleClick = (e: React.MouseEvent) => {
        if (onClick) {
            onClick();
        }
    };

    // Double click handler
    const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onDoubleClick?.();
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
                flex-1 ${config.padding} text-center flex flex-col justify-center items-center
                ${colors.bg} ${colors.border} ${colors.shadow}
            `}>
                <span className={`block w-full break-words leading-tight font-semibold ${config.text} ${colors.text} ${text.length > 8 ? 'line-clamp-2' : ''}`}>
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
                    className={`flex flex-col ${containerClasses} ${config.height} select-none`}
                    style={{ transform: selected ? 'perspective(500px) rotateX(-5deg) translateY(-4px)' : '' }}
                >
                    <div className={`
                        flex-1 ${config.padding} text-center flex flex-col justify-center
                        ${leftColors.bg} border-b border-white/20 ${leftColors.shadow}
                    `}>
                        <span className={`block w-full break-words leading-tight font-semibold ${config.text} ${leftColors.text} ${leftText.length > 8 ? 'line-clamp-2' : ''}`}>
                            {leftText}
                        </span>
                        <span className={`${config.index} opacity-60 font-medium`}>{leftIndex}</span>
                    </div>
                    <div className={`
                        flex-1 ${config.padding} text-center flex flex-col justify-center
                        ${rightColors.bg} ${rightColors.shadow}
                    `}>
                        <span className={`block w-full break-words leading-tight font-semibold ${config.text} ${rightColors.text} ${rightText.length > 8 ? 'line-clamp-2' : ''}`}>
                            {rightText}
                        </span>
                        <span className={`${config.index} opacity-60 font-medium`}>{rightIndex}</span>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                className={`flex ${containerClasses} select-none`}
                style={{ transform: selected ? 'perspective(500px) rotateY(5deg) translateY(-4px)' : '' }}
            >
                {renderSide(leftText, leftIndex, true)}
                {renderSide(rightText, rightIndex, false)}
            </div>
        </>
    );
};
