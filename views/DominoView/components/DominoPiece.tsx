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
    highlightSide?: 'none' | 'left' | 'right'; // For the connected train visual
    onClick?: () => void;
    onDoubleClick?: () => void;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'giant';
}

export const DominoPiece: React.FC<DominoPieceProps> = ({
    piece,
    orientation = 'horizontal',
    flipped = false,
    selected = false,
    disabled = false,
    canPlay = false,
    isUnplayableInHand = false,
    highlightSide = 'none',
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
        xl: { container: 'min-w-[180px] min-h-[100px]', text: 'text-lg', badge: 'w-5 h-5 text-[10px]', padding: 'p-3', height: 'h-[140px]', badgePos: 'top-1.5 right-1.5' }, // For the single end view on trains
        giant: { container: 'w-[280px] sm:w-[320px] min-h-[140px] sm:min-h-[160px]', text: 'text-2xl sm:text-3xl', badge: 'w-8 h-8 text-sm', padding: 'p-6 sm:p-8', height: 'h-[400px] sm:h-[480px]', badgePos: 'top-3 right-3' }
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
                bg: 'bg-gradient-to-br from-amber-100 to-amber-200 ring-1 ring-white/50',
                text: 'text-amber-950 font-extrabold',
                border: isLeft ? 'border-r border-amber-300 shadow-[-1px_0_0_rgba(255,255,255,0.4)_inset]' : 'border-t border-amber-300 shadow-[0_-1px_0_rgba(255,255,255,0.4)_inset]',
                badgeBg: 'bg-gradient-to-br from-amber-700 to-amber-900 shadow-inner',
                badgeText: 'text-amber-50'
            };
        }
        if (isDouble) {
            return {
                bg: 'bg-gradient-to-br from-orange-50 to-orange-100 ring-1 ring-white/60',
                text: 'text-orange-950 font-extrabold',
                border: isLeft ? 'border-r border-orange-200 shadow-[-1px_0_0_rgba(255,255,255,0.5)_inset]' : 'border-t border-orange-200 shadow-[0_-1px_0_rgba(255,255,255,0.5)_inset]',
                badgeBg: 'bg-gradient-to-br from-orange-800 to-orange-950 shadow-inner',
                badgeText: 'text-orange-50'
            };
        }
        return {
            bg: 'bg-gradient-to-br from-[rgb(250,250,250)] to-[rgb(230,230,230)] ring-1 ring-white', // Very clean whitish/gray with a bevel light effect
            text: 'text-slate-800',
        };
    };

    const applyHighlight = (baseColors: any, isHighlighted: boolean) => {
        if (!isHighlighted) return baseColors;
        return {
            ...baseColors,
            bg: 'bg-gradient-to-br from-yellow-200 to-yellow-300 shadow-[inset_0_2px_10px_rgba(202,138,4,0.2)] ring-1 ring-yellow-400',
            text: 'text-yellow-950 font-black',
            badgeBg: 'bg-yellow-500 animate-pulse shadow-inner',
            badgeText: 'text-yellow-950'
        };
    };

    const leftColors = applyHighlight(getColors(true), highlightSide === 'left');
    const rightColors = applyHighlight(getColors(false), highlightSide === 'right');

    // Dynamic container classes
    const containerClasses = `
        transition-all duration-300 rounded-xl overflow-hidden border border-slate-300/40
        shadow-[2px_4px_12px_rgba(0,0,0,0.15),_0_2px_4px_rgba(0,0,0,0.1)]
        ${piece.isHub ? 'border-amber-400' : ''}
        ${isUnplayableInHand ? 'opacity-40 scale-95 grayscale-[0.5]' : 'opacity-100'}
        ${selected ? 'ring-4 ring-green-500 border-green-500 scale-[1.03] shadow-[0_12px_25px_rgba(34,197,94,0.35)] -translate-y-3' : ''}
        ${canPlay && !selected ? 'ring-2 ring-emerald-400 border-emerald-400 shadow-[0_6px_15px_rgba(52,211,153,0.4)]' : ''}
        ${!disabled && !isUnplayableInHand ? 'hover:shadow-[0_8px_20px_rgba(0,0,0,0.2)] hover:-translate-y-1.5 cursor-pointer' : ''}
        ${config.container}
    `;

    const renderSide = (text: string, index: number, isLeft: boolean, isVertical: boolean) => {
        const colors = isLeft ? leftColors : rightColors;
        // In vertical, the top half gets bottom border. In horizontal, left half gets right border. 
        // We override the getter's border logic to match orientation.
        let borderClass = '';
        if (isVertical) {
            borderClass = isLeft ? 'border-b border-slate-300 shadow-[0_-1px_0_rgba(255,255,255,0.6)_inset]' : '';
        } else {
            borderClass = isLeft ? 'border-r border-slate-300 shadow-[-1px_0_0_rgba(255,255,255,0.6)_inset]' : '';
        }

        // Special override for hub/double
        if (piece.isHub) borderClass = isVertical ? (isLeft ? 'border-b border-amber-300 shadow-[0_-1px_0_rgba(255,255,255,0.4)_inset]' : '') : (isLeft ? 'border-r border-amber-300 shadow-[-1px_0_0_rgba(255,255,255,0.4)_inset]' : '');
        if (isDouble) borderClass = isVertical ? (isLeft ? 'border-b border-orange-200 shadow-[0_-1px_0_rgba(255,255,255,0.5)_inset]' : '') : (isLeft ? 'border-r border-orange-200 shadow-[-1px_0_0_rgba(255,255,255,0.5)_inset]' : '');

        return (
            <div className={`
                flex-1 ${config.padding} text-center flex flex-col justify-center items-center relative
                ${colors.bg} ${borderClass}
            `}>
                <span className={`block w-full break-words leading-tight font-bold ${config.text} ${colors.text} drop-shadow-sm ${text.length > 12 ? 'line-clamp-4' : 'line-clamp-3'}`}>
                    {text}
                </span>
                <div className={`
                    absolute rounded-full flex items-center justify-center font-bold shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)] ${config.badgePos}
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
