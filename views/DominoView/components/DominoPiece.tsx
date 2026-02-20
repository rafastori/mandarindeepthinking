import React from 'react';
import { DominoPiece as DominoPieceType } from '../types';

interface DominoPieceProps {
    piece: DominoPieceType;
    orientation?: 'horizontal' | 'vertical';
    flipped?: boolean;
    selected?: boolean;
    disabled?: boolean;
    canPlay?: boolean;
    isUnplayableInHand?: boolean; // New prop for the "dim unplayable pieces" feature
    onClick?: () => void;
    onDoubleClick?: () => void;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const DominoPiece: React.FC<DominoPieceProps> = ({
    piece,
    orientation = 'horizontal',
    flipped = false,
    selected = false,
    disabled = false,
    canPlay = false,
    isUnplayableInHand = false,
    onClick,
    onDoubleClick,
    size = 'md'
}) => {

    const leftText = flipped ? piece.rightText : piece.leftText;
    const rightText = flipped ? piece.leftText : piece.rightText;
    const leftIndex = flipped ? piece.rightIndex : piece.leftIndex;
    const rightIndex = flipped ? piece.leftIndex : piece.rightIndex;

    const sizeConfig = {
        sm: { container: 'min-w-[80px]', text: 'text-[10px]', badge: 'w-2.5 h-2.5 text-[6px]', padding: 'p-1', height: 'h-[60px]', badgePos: 'top-0.5 right-0.5' },
        md: { container: 'min-w-[100px]', text: 'text-sm', badge: 'w-3.5 h-3.5 text-[8px]', padding: 'p-1.5', height: 'h-[80px]', badgePos: 'top-1 right-1' },
        lg: { container: 'min-w-[130px]', text: 'text-base', badge: 'w-4 h-4 text-[9px]', padding: 'p-2', height: 'h-[110px]', badgePos: 'top-1 right-1' },
        xl: { container: 'min-w-[180px]', text: 'text-lg', badge: 'w-5 h-5 text-[10px]', padding: 'p-3', height: 'h-[140px]', badgePos: 'top-1.5 right-1.5' } // For the single end view on trains
    };

    const config = sizeConfig[size];
    const isDouble = leftIndex === rightIndex;

    const handleClick = (e: React.MouseEvent) => {
        if (onClick) onClick();
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onDoubleClick?.();
    };

    // Cleaner, flat colors for high legibility
    const getColors = (isLeft: boolean) => {
        if (piece.isHub) {
            return {
                bg: 'bg-amber-100',
                text: 'text-amber-900',
                border: isLeft ? 'border-r-2 border-amber-300' : 'border-t-2 border-amber-300',
                badgeBg: 'bg-amber-900',
                badgeText: 'text-amber-50'
            };
        }
        if (isDouble) {
            return {
                bg: 'bg-orange-50',
                text: 'text-orange-950',
                border: isLeft ? 'border-r-2 border-orange-200' : 'border-t-2 border-orange-200',
                badgeBg: 'bg-orange-900',
                badgeText: 'text-orange-50'
            };
        }
        return {
            bg: 'bg-slate-50', // Very clean whitish/gray
            text: 'text-slate-800',
            border: isLeft ? 'border-r-2 border-slate-200' : 'border-t-2 border-slate-200',
            badgeBg: 'bg-slate-800',
            badgeText: 'text-slate-50'
        };
    };

    const leftColors = getColors(true);
    const rightColors = getColors(false);

    // Dynamic container classes
    const containerClasses = `
        transition-all duration-300 rounded-xl overflow-hidden shadow-sm border-2
        ${piece.isHub ? 'border-amber-300' : 'border-slate-300'}
        ${isUnplayableInHand ? 'opacity-40 scale-95 grayscale-[0.5]' : 'opacity-100'}
        ${selected ? 'ring-4 ring-green-500 border-green-500 scale-105 shadow-xl -translate-y-2' : ''}
        ${canPlay && !selected ? 'ring-2 ring-emerald-400 border-emerald-400 shadow-lg shadow-emerald-100' : ''}
        ${!disabled && !isUnplayableInHand ? 'hover:shadow-md cursor-pointer' : ''}
        ${config.container}
    `;

    const renderSide = (text: string, index: number, isLeft: boolean, isVertical: boolean) => {
        const colors = isLeft ? leftColors : rightColors;
        // In vertical, the top half gets bottom border. In horizontal, left half gets right border. 
        // We override the getter's border logic to match orientation.
        let borderClass = '';
        if (isVertical) {
            borderClass = isLeft ? 'border-b-2 border-slate-200' : '';
        } else {
            borderClass = isLeft ? 'border-r-2 border-slate-200' : '';
        }

        // Special override for hub/double
        if (piece.isHub) borderClass = isVertical ? (isLeft ? 'border-b-2 border-amber-300' : '') : (isLeft ? 'border-r-2 border-amber-300' : '');
        if (isDouble) borderClass = isVertical ? (isLeft ? 'border-b-2 border-orange-200' : '') : (isLeft ? 'border-r-2 border-orange-200' : '');

        return (
            <div className={`
                flex-1 ${config.padding} text-center flex flex-col justify-center items-center relative
                ${colors.bg} ${borderClass}
            `}>
                <span className={`block w-full break-words leading-tight font-bold ${config.text} ${colors.text} ${text.length > 12 ? 'line-clamp-4' : 'line-clamp-3'}`}>
                    {text}
                </span>
                <div className={`
                    absolute rounded-full flex items-center justify-center font-bold shadow-sm ${config.badgePos}
                    ${config.badge} ${colors.badgeBg} ${colors.badgeText}
                `}>
                    {index}
                </div>
            </div>
        );
    };

    if (orientation === 'vertical') {
        return (
            <div
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                className={`flex flex-col ${containerClasses} ${config.height} select-none`}
            >
                {renderSide(leftText, leftIndex, true, true)}
                {renderSide(rightText, rightIndex, false, true)}
            </div>
        );
    }

    return (
        <div
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            className={`flex ${containerClasses} select-none`}
        >
            {renderSide(leftText, leftIndex, true, false)}
            {renderSide(rightText, rightIndex, false, false)}
        </div>
    );
};
