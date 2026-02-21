import React from 'react';
import Icon from '../../../components/Icon';
import { DominoPiece as DominoPieceType, Train, TermPair, DominoConfig } from '../types';
import { DominoPiece } from './DominoPiece';
import { usePuterSpeech } from '../../../hooks/usePuterSpeech';

interface DominoPieceModalProps {
    piece: DominoPieceType;
    isOpen: boolean;
    onClose: () => void;
    possibleTrains?: Train[]; // Trains this piece can be played on
    onPlay?: (trainId: string) => void;
    termPairs?: TermPair[]; // Term pairs to find translations
    gameConfig?: DominoConfig; // Game config for TTS language
}

export const DominoPieceModal: React.FC<DominoPieceModalProps> = ({
    piece,
    isOpen,
    onClose,
    possibleTrains = [],
    onPlay,
    termPairs = [],
    gameConfig
}) => {
    const { speak } = usePuterSpeech();

    if (!isOpen) return null;

    // Find term pairs for left and right indexes
    const leftTermPair = termPairs.find(tp => tp.index === piece.leftIndex);
    const rightTermPair = termPairs.find(tp => tp.index === piece.rightIndex);

    // Determine what to show: term is the "original" word, definition is the "translation"
    const leftTerm = leftTermPair?.term || piece.leftText;
    const leftDefinition = leftTermPair?.definition || '';
    const rightTerm = rightTermPair?.term || piece.rightText;
    const rightDefinition = rightTermPair?.definition || '';

    // Determine TTS language: always respect the sourceLang, falling back to pt
    const termLang = gameConfig?.sourceLang || 'zh'; // zh is a safer default if no generic provided, but mostly config injects it. Let's use sourceLang || 'pt' since that's what was there.
    const actualTermLang = gameConfig?.sourceLang || 'zh';

    const handleSpeak = (text: string, isDefinition: boolean = false) => {
        // Definitions are always in Portuguese, terms use the game language
        speak(text, isDefinition ? 'pt' : actualTermLang);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-sm m-4 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <span>🔍</span>
                        Detalhes da Peça
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                        aria-label="Fechar"
                    >
                        <Icon name="x" size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col w-full h-full overflow-y-auto">
                    {/* Visual representation */}
                    <div className="flex justify-center mb-6 transform scale-125">
                        <DominoPiece piece={piece} size="lg" />
                    </div>

                    {/* Text Details */}
                    <div className="space-y-4 mb-6">
                        {/* Lado Esquerdo/Superior */}
                        <div className="bg-gradient-to-r from-sky-50 to-sky-100 rounded-xl p-4 border border-sky-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 bg-sky-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                                        {piece.leftIndex}
                                    </span>
                                    <span className="text-xs text-sky-600 font-bold uppercase tracking-wider">Parte 1</span>
                                </div>
                                <button
                                    onClick={() => handleSpeak(leftTerm)}
                                    className="p-2 bg-sky-200 hover:bg-sky-300 rounded-full transition-colors"
                                    title="Ouvir pronúncia"
                                >
                                    <Icon name="volume-2" size={16} className="text-sky-700" />
                                </button>
                            </div>
                            <p className="text-sky-900 font-bold text-lg break-words leading-relaxed">{leftTerm}</p>
                            {leftDefinition && leftDefinition !== leftTerm && (
                                <div className="flex items-center gap-2 mt-2">
                                    <p className="text-sky-700 text-sm opacity-75 break-words flex-1">
                                        {leftDefinition}
                                    </p>
                                    <button
                                        onClick={() => handleSpeak(leftDefinition, true)}
                                        className="p-1.5 bg-sky-100 hover:bg-sky-200 rounded-full transition-colors flex-shrink-0"
                                        title="Ouvir tradução"
                                    >
                                        <Icon name="volume-2" size={12} className="text-sky-600" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Separador */}
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-slate-200" />
                            <span className="text-slate-300 text-xs">CONECTA COM</span>
                            <div className="flex-1 h-px bg-slate-200" />
                        </div>

                        {/* Lado Direito/Inferior */}
                        <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                                        {piece.rightIndex}
                                    </span>
                                    <span className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Parte 2</span>
                                </div>
                                <button
                                    onClick={() => handleSpeak(rightTerm)}
                                    className="p-2 bg-emerald-200 hover:bg-emerald-300 rounded-full transition-colors"
                                    title="Ouvir pronúncia"
                                >
                                    <Icon name="volume-2" size={16} className="text-emerald-700" />
                                </button>
                            </div>
                            <p className="text-emerald-900 font-bold text-lg break-words leading-relaxed">{rightTerm}</p>
                            {rightDefinition && rightDefinition !== rightTerm && (
                                <div className="flex items-center gap-2 mt-2">
                                    <p className="text-emerald-700 text-sm opacity-75 break-words flex-1">
                                        {rightDefinition}
                                    </p>
                                    <button
                                        onClick={() => handleSpeak(rightDefinition, true)}
                                        className="p-1.5 bg-emerald-100 hover:bg-emerald-200 rounded-full transition-colors flex-shrink-0"
                                        title="Ouvir tradução"
                                    >
                                        <Icon name="volume-2" size={12} className="text-emerald-600" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {piece.isHub && (
                            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-center animate-pulse">
                                <span className="text-amber-700 font-medium text-sm flex items-center justify-center gap-2">
                                    ⭐ <span>Peça Central (Hub)</span> ⭐
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    {possibleTrains.length > 0 && onPlay ? (
                        <div className="w-full space-y-3 mt-auto">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                                Jogar em:
                            </p>
                            <div className="grid gap-2">
                                {possibleTrains.map(train => (
                                    <button
                                        key={train.id}
                                        onClick={() => {
                                            onPlay(train.id);
                                            onClose();
                                        }}
                                        className="w-full p-3 bg-green-50 text-green-700 rounded-xl border border-green-200 hover:bg-green-100 transition-all flex items-center justify-between group active:scale-95 shadow-sm hover:shadow-md"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{train.ownerId === null ? '🚂' : train.ownerId ? '👤' : '🔒'}</span>
                                            <span className="font-medium text-sm">
                                                {train.ownerId ? `Trem de ${train.ownerId}` : 'Trem Mexicano'}
                                            </span>
                                        </div>
                                        <Icon name="arrow-right" size={16} className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-center">
                    <button
                        onClick={onClose}
                        className="text-sm text-slate-500 hover:text-slate-800 font-medium px-4 py-2"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};
