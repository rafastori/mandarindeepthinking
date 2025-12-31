import React from 'react';
import { DominoPiece as DominoPieceType } from '../types';

interface DominoPieceProps {
    piece: DominoPieceType;
    orientation?: 'horizontal' | 'vertical';
    flipped?: boolean;
    selected?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
}

export const DominoPiece: React.FC<DominoPieceProps> = ({
    piece,
    orientation = 'horizontal',
    flipped = false,
    selected = false,
    disabled = false,
    onClick,
    size = 'md'
}) => {
    const leftText = flipped ? piece.rightText : piece.leftText;
    const rightText = flipped ? piece.leftText : piece.rightText;
    const leftIndex = flipped ? piece.rightIndex : piece.leftIndex;
    const rightIndex = flipped ? piece.leftIndex : piece.rightIndex;

    const sizeClasses = {
        sm: 'text-xs min-w-[100px]',
        md: 'text-sm min-w-[140px]',
        lg: 'text-base min-w-[180px]'
    };

    const isDouble = leftIndex === rightIndex;

    if (orientation === 'vertical') {
        return (
            <button
                onClick={onClick}
                disabled={disabled}
                className={`
                    flex flex-col rounded-xl border-2 overflow-hidden transition-all
                    ${selected ? 'ring-4 ring-orange-400 border-orange-500' : 'border-slate-300'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg cursor-pointer'}
                    ${piece.isHub ? 'border-yellow-500 bg-yellow-50' : 'bg-white'}
                    ${sizeClasses[size]}
                `}
            >
                <div className={`
                    p-2 text-center font-medium border-b border-slate-200
                    ${isDouble ? 'bg-orange-100 text-orange-800' : 'bg-blue-50 text-blue-800'}
                `}>
                    <span className="block truncate">{leftText}</span>
                    <span className="text-[10px] text-slate-400">[{leftIndex}]</span>
                </div>
                <div className={`
                    p-2 text-center font-medium
                    ${isDouble ? 'bg-orange-100 text-orange-800' : 'bg-green-50 text-green-800'}
                `}>
                    <span className="block truncate">{rightText}</span>
                    <span className="text-[10px] text-slate-400">[{rightIndex}]</span>
                </div>
            </button>
        );
    }

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                flex rounded-xl border-2 overflow-hidden transition-all
                ${selected ? 'ring-4 ring-orange-400 border-orange-500' : 'border-slate-300'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg cursor-pointer'}
                ${piece.isHub ? 'border-yellow-500 bg-yellow-50' : 'bg-white'}
                ${sizeClasses[size]}
            `}
        >
            <div className={`
                flex-1 p-2 text-center font-medium border-r border-slate-200
                ${isDouble ? 'bg-orange-100 text-orange-800' : 'bg-blue-50 text-blue-800'}
            `}>
                <span className="block truncate">{leftText}</span>
                <span className="text-[10px] text-slate-400">[{leftIndex}]</span>
            </div>
            <div className={`
                flex-1 p-2 text-center font-medium
                ${isDouble ? 'bg-orange-100 text-orange-800' : 'bg-green-50 text-green-800'}
            `}>
                <span className="block truncate">{rightText}</span>
                <span className="text-[10px] text-slate-400">[{rightIndex}]</span>
            </div>
        </button>
    );
};
