import React from 'react';
import Icon from '../../components/Icon';

interface Props {
    show: boolean;
    isCorrectingColors: boolean;
    isColorHighlightEnabled: boolean;
    colorBtnRef: React.RefObject<HTMLButtonElement | null>;
    colorPopoverRef: React.RefObject<HTMLDivElement | null>;
    onTogglePopover: () => void;
    onToggleColors: () => void;
    onCorrectColors: () => void;
}

const ColorPopover: React.FC<Props> = ({
    show,
    isCorrectingColors,
    isColorHighlightEnabled,
    colorBtnRef,
    colorPopoverRef,
    onTogglePopover,
    onToggleColors,
    onCorrectColors,
}) => (
    <div className="relative inline-flex">
        <button
            ref={colorBtnRef}
            onClick={(e) => { e.stopPropagation(); onTogglePopover(); }}
            className={`p-1.5 rounded-lg transition-colors ml-1 ${isCorrectingColors
                ? 'text-amber-500 bg-amber-50 animate-pulse'
                : isColorHighlightEnabled
                    ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
            title="Opções de cores"
        >
            {isCorrectingColors
                ? <div className="w-[18px] h-[18px] border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                : <Icon name="palette" size={18} />
            }
        </button>

        {show && !isCorrectingColors && (
            <div
                ref={colorPopoverRef}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 min-w-[200px] z-[100] animate-in fade-in slide-in-from-top-2"
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleColors();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700"
                >
                    <Icon name={isColorHighlightEnabled ? 'eye-off' : 'palette'} size={16} className={isColorHighlightEnabled ? 'text-slate-400' : 'text-amber-500'} />
                    {isColorHighlightEnabled ? 'Desativar cores' : 'Ativar cores'}
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onCorrectColors();
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700"
                >
                    <Icon name="rotate-ccw" size={16} className="text-brand-500" />
                    Atualizar correção por cores
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[-1px]">
                    <div className="w-2.5 h-2.5 bg-white border-l border-t border-slate-200 transform rotate-45" />
                </div>
            </div>
        )}
    </div>
);

export default ColorPopover;
