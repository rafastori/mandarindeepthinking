import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Icon from './Icon';
import { StudyItem } from '../types';
import { getAllSavedWords, SavedWordInfo } from '../services/neuralGraphService';

/**
 * NeuralSelectOverlay
 * 
 * Fullscreen overlay that appears when the user taps the brain icon.
 * Shows all saved words as a searchable list. The user selects a word
 * to open the Neural Graph visualization.
 * 
 * Skills applied:
 * - react-ui-patterns: Empty state when no saved words
 * - react-best-practices (rerender-memo): useMemo for filtered list
 * - react-best-practices (rendering-content-visibility): content-visibility for long lists
 * - ui-ux-pro-max (touch-target-size): Min 44px height items
 * - ui-ux-pro-max (cursor-pointer): All clickable items
 * - ui-ux-pro-max (keyboard-nav): ESC to close, Tab navigation
 */

// Normalize text: remove diacritics/accents (e.g. "diàolï" -> "diaoli")
const normalize = (text: string) =>
    text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

interface NeuralSelectOverlayProps {
    data: StudyItem[];
    savedIds: string[];
    activeFolderFilters?: string[];
    onSelectWord: (word: string) => void;
    onClose: () => void;
}

const NeuralSelectOverlay: React.FC<NeuralSelectOverlayProps> = ({
    data,
    savedIds,
    activeFolderFilters,
    onSelectWord,
    onClose,
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    // Get saved words from current folder context only
    const savedWords = useMemo(
        () => getAllSavedWords(data, savedIds, activeFolderFilters),
        [data, savedIds, activeFolderFilters]
    );

    // Filter by search query (diacritic-insensitive)
    const filteredWords = useMemo(() => {
        if (!searchQuery.trim()) return savedWords;
        const q = normalize(searchQuery.trim());
        return savedWords.filter(
            w =>
                normalize(w.word).includes(q) ||
                normalize(w.pinyin).includes(q) ||
                normalize(w.meaning).includes(q)
        );
    }, [savedWords, searchQuery]);

    // Keyboard navigation: ESC to close
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        },
        [onClose]
    );

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Prevent body scroll while overlay is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-900/90 to-indigo-900/90 border-b border-purple-500/30">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-500/30 p-2 rounded-full">
                        <Icon name="brain" size={22} className="text-purple-300" />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-lg">Mapa Neural</h2>
                        <p className="text-purple-300 text-xs">Selecione uma palavra para explorar</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full text-purple-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400"
                    aria-label="Fechar mapa neural"
                >
                    <Icon name="x" size={24} />
                </button>
            </div>

            {/* Search bar */}
            <div className="px-4 py-3 bg-purple-950/50 border-b border-purple-500/20">
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                    <Icon name="search" size={18} className="text-purple-400 flex-shrink-0" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Buscar palavra, pinyin ou significado..."
                        className="bg-transparent text-white placeholder-purple-400/60 outline-none w-full text-sm"
                        autoFocus
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="p-1 rounded-full text-purple-400 hover:text-white transition-colors cursor-pointer"
                            aria-label="Limpar busca"
                        >
                            <Icon name="x" size={16} />
                        </button>
                    )}
                </div>
                <p className="text-purple-400/60 text-xs mt-2 px-1">
                    {filteredWords.length} palavra{filteredWords.length !== 1 ? 's' : ''} disponíve{filteredWords.length !== 1 ? 'is' : 'l'}
                </p>
            </div>

            {/* Word list */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
                {savedWords.length === 0 ? (
                    /* Empty state (react-ui-patterns) */
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className="bg-purple-500/20 p-4 rounded-full mb-4">
                            <Icon name="bookmark" size={32} className="text-purple-400" />
                        </div>
                        <p className="text-purple-300 font-medium mb-2">Nenhuma palavra salva</p>
                        <p className="text-purple-400/60 text-sm max-w-[250px]">
                            Salve palavras na aba Leitura para explorar suas conexões neurais.
                        </p>
                    </div>
                ) : filteredWords.length === 0 ? (
                    /* No search results */
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Icon name="search" size={32} className="text-purple-400/40 mb-3" />
                        <p className="text-purple-300/60 text-sm">
                            Nenhum resultado para "{searchQuery}"
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filteredWords.map((word) => (
                            <button
                                key={word.id}
                                onClick={() => onSelectWord(word.word)}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all cursor-pointer
                                    hover:bg-purple-500/20 active:bg-purple-500/30 active:scale-[0.98]
                                    focus:outline-none focus:ring-2 focus:ring-purple-400/50
                                    group"
                                style={{ minHeight: '44px', contentVisibility: 'auto' }}
                            >
                                {/* Word indicator dot */}
                                <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 group-hover:bg-purple-400 transition-colors" />

                                {/* Word text */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-white font-bold text-base truncate">
                                            {word.word}
                                        </span>
                                        {word.pinyin && (
                                            <span className="text-purple-400 text-xs truncate flex-shrink-0">
                                                {word.pinyin}
                                            </span>
                                        )}
                                    </div>
                                    {word.meaning && (
                                        <p className="text-purple-300/60 text-xs truncate mt-0.5">
                                            {word.meaning}
                                        </p>
                                    )}
                                </div>

                                {/* Arrow */}
                                <Icon
                                    name="chevron-right"
                                    size={16}
                                    className="text-purple-500/40 flex-shrink-0 group-hover:text-purple-300 transition-colors"
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NeuralSelectOverlay;
