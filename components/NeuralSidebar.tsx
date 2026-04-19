import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Square } from 'lucide-react';
import Icon from './Icon';
import { GraphNode, NeuralGraphData } from '../services/neuralGraphService';
import type { SupportedLanguage } from '../types';

interface NeuralSidebarProps {
    selectedNode: GraphNode | null;
    graphData: NeuralGraphData;
    onClose: () => void;
    onExplore: (word: string) => void;
    onNodeSelect: (nodeId: string) => void;
    speak: (text: string, language: SupportedLanguage, id?: string) => void;
    stop: () => void;
    playingId: string | null;
}

const NeuralSidebar: React.FC<NeuralSidebarProps> = ({
    selectedNode,
    graphData,
    onClose,
    onExplore,
    onNodeSelect,
    speak,
    stop,
    playingId,
}) => {

    const handleAudio = (text: string, lang: SupportedLanguage, id: string) => {
        if (playingId === id) stop();
        else speak(text, lang, id);
    };

    // Compute related nodes for the selected node
    const { relatedSentences, relatedWords, relatedGalaxies } = useMemo(() => {
        if (!selectedNode || !graphData) return { relatedSentences: [], relatedWords: [], relatedGalaxies: [] };

        const connectedIds = new Set<string>();

        // Find all nodes directly connected to the selected node
        for (const link of graphData.links) {
            const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
            const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;

            if (sourceId === selectedNode.id) connectedIds.add(targetId);
            if (targetId === selectedNode.id) connectedIds.add(sourceId);
        }

        // Also find second-degree connections (nodes connected to our connected nodes)
        const secondDegreeIds = new Set<string>();
        for (const cId of connectedIds) {
            for (const link of graphData.links) {
                const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
                const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;

                if (sourceId === cId && targetId !== selectedNode.id) secondDegreeIds.add(targetId);
                if (targetId === cId && sourceId !== selectedNode.id) secondDegreeIds.add(sourceId);
            }
        }

        const allRelatedIds = new Set([...connectedIds, ...secondDegreeIds]);

        const sentences: GraphNode[] = [];
        const words: GraphNode[] = [];
        const galaxies: GraphNode[] = [];

        for (const node of graphData.nodes) {
            if (node.id === selectedNode.id) continue;
            if (!allRelatedIds.has(node.id)) continue;

            if (node.type === 'sentence') {
                sentences.push(node);
            } else if (node.type === 'galaxy') {
                galaxies.push(node);
            } else {
                words.push(node);
            }
        }

        // Sort galaxies by score descending
        galaxies.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));

        return { relatedSentences: sentences, relatedWords: words, relatedGalaxies: galaxies };
    }, [selectedNode, graphData]);

    return (
        <AnimatePresence>
            {selectedNode && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[210]"
                        onClick={onClose}
                        style={{ background: 'rgba(0,0,0,0.3)' }}
                    />

                    {/* Sidebar panel */}
                    <motion.div
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                        className="fixed top-0 right-0 h-full w-full sm:w-[380px] z-[220] flex flex-col"
                        style={{
                            background: 'rgba(15, 10, 30, 0.75)',
                            backdropFilter: 'blur(24px) saturate(1.6)',
                            WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
                            borderLeft: '1px solid rgba(139, 92, 246, 0.15)',
                            boxShadow: '0 0 60px rgba(0, 0, 0, 0.5)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center px-6 pt-6 pb-4">
                            <div className="flex items-center gap-2 text-purple-400">
                                <Icon name="info" size={18} />
                                <span className="text-xs uppercase tracking-[0.2em] font-mono">
                                    {selectedNode.type === 'sentence' ? 'Frase' : 'Definição'}
                                </span>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400"
                                aria-label="Fechar painel de detalhes"
                            >
                                <Icon name="x" size={20} className="text-purple-300" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex flex-col gap-5 px-6 overflow-y-auto pb-4">
                            {selectedNode.type === 'sentence' ? (
                                /* ── Sentence view ── */
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <div className="flex items-start justify-between gap-3 mb-4">
                                            <h2
                                                className="text-2xl font-black tracking-tight leading-snug flex-1"
                                                style={{
                                                    background: 'linear-gradient(to bottom right, #fff, rgba(255,255,255,0.4))',
                                                    WebkitBackgroundClip: 'text',
                                                    WebkitTextFillColor: 'transparent',
                                                }}
                                            >
                                                {selectedNode.sentenceText || selectedNode.label}
                                            </h2>
                                            <button
                                                onClick={() => handleAudio(
                                                    selectedNode.sentenceText || selectedNode.label,
                                                    (selectedNode.language || 'zh') as SupportedLanguage,
                                                    `neural-${selectedNode.id}`
                                                )}
                                                className={`flex-shrink-0 p-2.5 rounded-full transition-all mt-0.5 ${playingId === `neural-${selectedNode.id}` ? 'bg-blue-500/30 text-blue-300 animate-pulse' : 'bg-white/8 hover:bg-white/15 text-slate-300 hover:text-white'}`}
                                                title="Ouvir pronúncia"
                                            >
                                                {playingId === `neural-${selectedNode.id}`
                                                    ? <Square size={16} />
                                                    : <Volume2 size={16} />}
                                            </button>
                                        </div>
                                        <div
                                            className="h-1 w-16 rounded-full"
                                            style={{ background: 'linear-gradient(to right, #3b82f6, #8b5cf6)' }}
                                        />
                                    </div>

                                    {selectedNode.sentenceTranslation && (
                                        <p className="text-slate-200 leading-relaxed text-lg font-light tracking-wide italic opacity-90">
                                            "{selectedNode.sentenceTranslation}"
                                        </p>
                                    )}

                                    {/* ── Words in this sentence ── */}
                                    {relatedWords.length > 0 && (
                                        <div className="mt-2">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-2 h-2 rounded-full bg-purple-500" />
                                                <span className="text-xs uppercase tracking-[0.15em] font-mono text-purple-400">
                                                    Palavras desta frase ({relatedWords.length})
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {relatedWords.map(w => (
                                                    <button
                                                        key={w.id}
                                                        onClick={() => onNodeSelect(w.id)}
                                                        className="px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer hover:scale-[1.04] active:scale-[0.96]"
                                                        style={{
                                                            background: 'rgba(139, 92, 246, 0.15)',
                                                            border: '1px solid rgba(139, 92, 246, 0.25)',
                                                            color: '#c4b5fd',
                                                        }}
                                                    >
                                                        <span className="block">{w.label}</span>
                                                        {w.pinyin && (
                                                            <span className="block text-[10px] text-purple-400/60 mt-0.5">{w.pinyin}</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* ── Word view ── */
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <div className="flex items-start justify-between gap-3 mb-4">
                                            <h2
                                                className="text-5xl font-black tracking-tight leading-[0.9] flex-1"
                                                style={{
                                                    background: 'linear-gradient(to bottom right, #fff, rgba(255,255,255,0.4))',
                                                    WebkitBackgroundClip: 'text',
                                                    WebkitTextFillColor: 'transparent',
                                                }}
                                            >
                                                {selectedNode.label}
                                            </h2>
                                            <button
                                                onClick={() => handleAudio(
                                                    selectedNode.label,
                                                    (selectedNode.language || 'zh') as SupportedLanguage,
                                                    `neural-${selectedNode.id}`
                                                )}
                                                className={`flex-shrink-0 p-2.5 rounded-full transition-all mt-1 ${playingId === `neural-${selectedNode.id}` ? 'bg-purple-500/30 text-purple-300 animate-pulse' : 'bg-white/8 hover:bg-white/15 text-slate-300 hover:text-white'}`}
                                                title="Ouvir pronúncia"
                                            >
                                                {playingId === `neural-${selectedNode.id}`
                                                    ? <Square size={18} />
                                                    : <Volume2 size={18} />}
                                            </button>
                                        </div>
                                        <div
                                            className="h-1 w-16 rounded-full"
                                            style={{ background: 'linear-gradient(to right, #8b5cf6, #f43f5e)' }}
                                        />
                                    </div>

                                    {selectedNode.pinyin && (
                                        <p className="text-purple-300 text-lg font-medium tracking-wide">
                                            {selectedNode.pinyin}
                                        </p>
                                    )}

                                    {selectedNode.meaning && (
                                        <p className="text-slate-200 leading-relaxed text-xl font-light tracking-wide italic opacity-90">
                                            "{selectedNode.meaning}"
                                        </p>
                                    )}

                                    {/* ── Connected sentences ── */}
                                    {relatedSentences.length > 0 && (
                                        <div className="mt-2">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-2 h-2 rounded bg-blue-500" />
                                                <span className="text-xs uppercase tracking-[0.15em] font-mono text-blue-400">
                                                    Frases relacionadas ({relatedSentences.length})
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {relatedSentences.map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => onNodeSelect(s.id)}
                                                        className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                                                        style={{
                                                            background: 'rgba(59, 130, 246, 0.1)',
                                                            border: '1px solid rgba(59, 130, 246, 0.2)',
                                                        }}
                                                    >
                                                        <span className="block text-blue-200 font-medium leading-snug">
                                                            {s.sentenceText || s.label}
                                                        </span>
                                                        {s.sentenceTranslation && (
                                                            <span className="block text-blue-400/50 text-xs mt-1 italic">
                                                                {s.sentenceTranslation}
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Related words ── */}
                                    {relatedWords.length > 0 && (
                                        <div className="mt-1">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-2 h-2 rounded-full bg-purple-500" />
                                                <span className="text-xs uppercase tracking-[0.15em] font-mono text-purple-400">
                                                    Palavras próximas ({relatedWords.length})
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {relatedWords.map(w => (
                                                    <button
                                                        key={w.id}
                                                        onClick={() => onNodeSelect(w.id)}
                                                        className="px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer hover:scale-[1.04] active:scale-[0.96]"
                                                        style={{
                                                            background: 'rgba(139, 92, 246, 0.12)',
                                                            border: '1px solid rgba(139, 92, 246, 0.2)',
                                                            color: '#c4b5fd',
                                                        }}
                                                    >
                                                        <span className="block">{w.label}</span>
                                                        {w.pinyin && (
                                                            <span className="block text-[10px] text-purple-400/60 mt-0.5">{w.pinyin}</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Semantic Galaxies ── */}
                                    {relatedGalaxies && relatedGalaxies.length > 0 && (
                                        <div className="mt-1">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                                                <span className="text-xs uppercase tracking-[0.15em] font-mono text-cyan-400">
                                                    Galáxias Vizinhas ({relatedGalaxies.length})
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {relatedGalaxies.map(g => (
                                                    <button
                                                        key={g.id}
                                                        onClick={() => onNodeSelect(g.id)}
                                                        className="px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer hover:scale-[1.04] active:scale-[0.96] flex flex-col items-start gap-1"
                                                        style={{
                                                            background: 'rgba(6, 182, 212, 0.12)',
                                                            border: '1px solid rgba(6, 182, 212, 0.25)',
                                                            color: '#67e8f9',
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span>{g.label}</span>
                                                            {g.similarityScore !== undefined && (
                                                                <span className="text-[10px] bg-cyan-500/20 px-1.5 py-0.5 rounded text-cyan-300">
                                                                    {Math.round(g.similarityScore * 100)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                        {g.pinyin && (
                                                            <span className="text-[10px] text-cyan-400/60">{g.pinyin}</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Bottom actions */}
                        <div className="px-6 pb-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            {(selectedNode.type === 'related-word' || selectedNode.type === 'proximity' || selectedNode.type === 'galaxy') && (
                                <button
                                    onClick={() => onExplore(selectedNode.label)}
                                    className="w-full py-3.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all cursor-pointer hover:brightness-110 active:scale-[0.98]"
                                    style={{
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
                                    }}
                                >
                                    <Icon name="brain" size={18} className="text-white" />
                                    <span className="text-white">
                                        Explorar "{selectedNode.label}"
                                    </span>
                                </button>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default NeuralSidebar;
