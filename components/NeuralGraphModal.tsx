import React, { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react';
import Icon from './Icon';
import { StudyItem } from '../types';
import { buildGraphForWord, GraphNode, NeuralGraphData } from '../services/neuralGraphService';

// Lazy load ForceGraph2D to reduce bundle size (react-best-practices: bundle-dynamic-imports)
const ForceGraph2D = React.lazy(() => import('react-force-graph-2d'));

/**
 * NeuralGraphModal
 * 
 * Fullscreen modal with a force-directed graph visualization.
 * Shows neural connections between words, sentences, and related words.
 * 
 * Skills applied:
 * - react-best-practices (bundle-dynamic-imports): React.lazy for ForceGraph2D
 * - react-best-practices (rerender-memo): useMemo for graphData, useCallback for handlers
 * - react-ui-patterns: Loading, empty, error states
 * - ui-ux-pro-max (touch-target-size): 44px min nodes
 * - ui-ux-pro-max (reduced-motion): Check prefers-reduced-motion
 * - ui-ux-pro-max (aria-labels): Accessible buttons
 */

interface NeuralGraphModalProps {
    word: string;
    data: StudyItem[];
    savedIds: string[];
    onNavigate: (newWord: string) => void;
    onClose: () => void;
}

// Colors
const COLORS = {
    bg: '#0f0a1e',
    centralWord: '#8b5cf6',     // purple-500
    centralGlow: '#a78bfa',     // purple-400
    sentence: '#3b82f6',        // blue-500
    sentenceGlow: '#60a5fa',    // blue-400
    relatedWord: '#a78bfa',     // purple-400
    relatedGlow: '#c4b5fd',     // purple-300
    link: '#6d28d9',            // purple-700
    linkGlow: '#7c3aed',        // purple-600
    text: '#f8fafc',            // slate-50
    textDim: '#94a3b8',         // slate-400
    panelBg: '#1e1033',
};

const NeuralGraphModal: React.FC<NeuralGraphModalProps> = ({
    word,
    data,
    savedIds,
    onNavigate,
    onClose,
}) => {
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [history, setHistory] = useState<string[]>([word]);
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
    const graphRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Check prefers-reduced-motion (ui-ux-pro-max: reduced-motion)
    const prefersReducedMotion = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }, []);

    // Build graph data (react-best-practices: rerender-memo, js-set-map-lookups)
    const graphData: NeuralGraphData = useMemo(
        () => buildGraphForWord(word, data, savedIds),
        [word, data, savedIds]
    );

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setDimensions({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ESC to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // Center graph on load
    useEffect(() => {
        if (graphRef.current && graphData.nodes.length > 0) {
            setTimeout(() => {
                graphRef.current?.zoomToFit(400, 80);
            }, 800);
        }
    }, [graphData]);

    // Configure d3-force for better spacing (avoid clustering)
    useEffect(() => {
        if (graphRef.current) {
            // Stronger charge repulsion to push nodes apart
            graphRef.current.d3Force('charge')?.strength(-300).distanceMax(400);
            // Longer link distance to separate connected nodes
            graphRef.current.d3Force('link')?.distance(120);
            // Gentle center gravity
            graphRef.current.d3Force('center')?.strength(0.05);
            // Reheat the simulation to apply new forces
            graphRef.current.d3ReheatSimulation();
        }
    }, [graphData]);

    // Handle node click (react-best-practices: useCallback)
    const handleNodeClick = useCallback(
        (node: any) => {
            const graphNode = node as GraphNode;

            if (graphNode.type === 'related-word') {
                // Navigate to this word (re-center)
                setHistory(prev => [...prev, graphNode.label]);
                setSelectedNode(null);
                onNavigate(graphNode.label);
            } else if (graphNode.type === 'sentence') {
                // Show sentence details
                setSelectedNode(graphNode);
            } else if (graphNode.type === 'word') {
                // Show word details
                setSelectedNode(graphNode);
            }
        },
        [onNavigate]
    );

    // Handle back navigation
    const handleBack = useCallback(() => {
        if (history.length > 1) {
            const newHistory = [...history];
            newHistory.pop();
            const prevWord = newHistory[newHistory.length - 1];
            setHistory(newHistory);
            setSelectedNode(null);
            onNavigate(prevWord);
        } else {
            onClose();
        }
    }, [history, onNavigate, onClose]);

    // Custom node rendering on Canvas
    const paintNode = useCallback(
        (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const graphNode = node as GraphNode & { x: number; y: number };
            const { x, y, type, label } = graphNode;

            const fontSize = Math.min(14 / globalScale, 14);
            const nodeRadius = type === 'word'
                ? Math.max(22, 14 + (graphNode.connectionCount || 0) * 2)
                : type === 'sentence'
                    ? 16
                    : Math.max(18, 12 + (graphNode.connectionCount || 0) * 1.5);

            // Glow effect (skip if reduced motion)
            if (!prefersReducedMotion) {
                ctx.shadowBlur = type === 'word' ? 20 : 12;
                ctx.shadowColor = type === 'word'
                    ? COLORS.centralGlow
                    : type === 'sentence'
                        ? COLORS.sentenceGlow
                        : COLORS.relatedGlow;
            }

            // Node body
            ctx.beginPath();
            if (type === 'sentence') {
                // Rounded rectangle for sentences
                const width = Math.min(label.length * 4 + 20, 120);
                const height = 28;
                const rx = 8;
                ctx.moveTo(x - width / 2 + rx, y - height / 2);
                ctx.lineTo(x + width / 2 - rx, y - height / 2);
                ctx.quadraticCurveTo(x + width / 2, y - height / 2, x + width / 2, y - height / 2 + rx);
                ctx.lineTo(x + width / 2, y + height / 2 - rx);
                ctx.quadraticCurveTo(x + width / 2, y + height / 2, x + width / 2 - rx, y + height / 2);
                ctx.lineTo(x - width / 2 + rx, y + height / 2);
                ctx.quadraticCurveTo(x - width / 2, y + height / 2, x - width / 2, y + height / 2 - rx);
                ctx.lineTo(x - width / 2, y - height / 2 + rx);
                ctx.quadraticCurveTo(x - width / 2, y - height / 2, x - width / 2 + rx, y - height / 2);
                ctx.closePath();
                ctx.fillStyle = COLORS.sentence + 'cc';
            } else {
                // Circle for words
                ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
                ctx.fillStyle = type === 'word' ? COLORS.centralWord : COLORS.relatedWord + 'cc';
            }
            ctx.fill();

            // Reset shadow
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';

            // Label
            ctx.font = `${type === 'word' ? 'bold ' : ''}${fontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = COLORS.text;

            if (type === 'sentence') {
                // Truncate sentence label to fit
                const maxWidth = 110;
                let displayLabel = label;
                while (ctx.measureText(displayLabel).width > maxWidth && displayLabel.length > 3) {
                    displayLabel = displayLabel.slice(0, -2) + '…';
                }
                ctx.fillText(displayLabel, x, y);
            } else {
                ctx.fillText(label, x, y);

                // Pinyin below word nodes
                if (graphNode.pinyin && globalScale > 0.6) {
                    ctx.font = `${Math.max(8, fontSize * 0.7)}px Inter, system-ui, sans-serif`;
                    ctx.fillStyle = COLORS.textDim;
                    ctx.fillText(graphNode.pinyin, x, y + nodeRadius + 8);
                }
            }
        },
        [prefersReducedMotion]
    );

    // Custom link rendering
    const paintLink = useCallback(
        (link: any, ctx: CanvasRenderingContext2D) => {
            const start = link.source;
            const end = link.target;
            if (!start.x || !end.x) return;

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);

            ctx.strokeStyle = COLORS.link + '60';
            ctx.lineWidth = 1.5;

            if (!prefersReducedMotion) {
                ctx.shadowBlur = 4;
                ctx.shadowColor = COLORS.linkGlow + '40';
            }

            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        },
        [prefersReducedMotion]
    );

    // Header height for graph offset
    const headerHeight = 56;
    const panelHeight = selectedNode ? 160 : 0;
    const graphHeight = dimensions.height - headerHeight - panelHeight;

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[200] flex flex-col"
            style={{ backgroundColor: COLORS.bg }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 z-10"
                style={{
                    background: 'linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(49, 46, 129, 0.8))',
                    borderBottom: '1px solid rgba(139, 92, 246, 0.3)',
                    backdropFilter: 'blur(8px)',
                    height: `${headerHeight}px`,
                }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        onClick={handleBack}
                        className="p-2 rounded-full text-purple-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400"
                        aria-label={history.length > 1 ? 'Voltar à palavra anterior' : 'Fechar mapa neural'}
                    >
                        <Icon name="arrow-left" size={20} />
                    </button>

                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                        {history.map((w, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && (
                                    <Icon name="chevron-right" size={14} className="text-purple-500/50 flex-shrink-0" />
                                )}
                                <span
                                    className={`text-sm font-medium truncate ${i === history.length - 1
                                        ? 'text-white font-bold'
                                        : 'text-purple-400/70'
                                        }`}
                                >
                                    {w}
                                </span>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="p-2 rounded-full text-purple-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    aria-label="Fechar mapa neural"
                >
                    <Icon name="x" size={20} />
                </button>
            </div>

            {/* Graph area */}
            <div className="flex-1 relative" style={{ height: `${graphHeight}px` }}>
                {graphData.nodes.length === 0 ? (
                    /* Empty state (react-ui-patterns) */
                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                        <div className="bg-purple-500/20 p-5 rounded-full mb-4">
                            <Icon name="brain" size={40} className="text-purple-400/60" />
                        </div>
                        <p className="text-purple-300 font-medium text-lg mb-2">
                            Sem conexões encontradas
                        </p>
                        <p className="text-purple-400/50 text-sm max-w-[280px]">
                            A palavra "{word}" não foi encontrada em nenhum texto do seu repositório.
                        </p>
                        <button
                            onClick={onClose}
                            className="mt-6 px-6 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-500 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400"
                        >
                            Voltar
                        </button>
                    </div>
                ) : (
                    <Suspense
                        fallback={
                            /* Loading state (react-ui-patterns) */
                            <div className="flex flex-col items-center justify-center h-full">
                                <div className="w-12 h-12 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-purple-400 text-sm">Carregando grafo neural...</p>
                            </div>
                        }
                    >
                        <ForceGraph2D
                            ref={graphRef}
                            graphData={graphData}
                            width={dimensions.width}
                            height={graphHeight}
                            backgroundColor={COLORS.bg}
                            // Node
                            nodeCanvasObject={paintNode}
                            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                                const radius = node.type === 'word' ? 22 : node.type === 'sentence' ? 20 : 18;
                                ctx.beginPath();
                                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                                ctx.fillStyle = color;
                                ctx.fill();
                            }}
                            onNodeClick={handleNodeClick}
                            // Link
                            linkCanvasObject={paintLink}
                            // Physics — spread nodes out to avoid clustering
                            d3AlphaDecay={0.02}
                            d3VelocityDecay={0.25}
                            cooldownTicks={150}
                            warmupTicks={80}
                            d3AlphaMin={0.001}
                            // Custom forces for better spacing
                            onEngineStop={() => graphRef.current?.zoomToFit(400, 80)}
                            dagMode={undefined}
                            // Interaction
                            enableZoomInteraction={true}
                            enablePanInteraction={true}
                            enableNodeDrag={true}
                        />
                    </Suspense>
                )}

                {/* Legend */}
                {graphData.nodes.length > 0 && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-3 px-3 py-2 rounded-xl bg-black/50 backdrop-blur-sm text-[10px]">
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.centralWord }} />
                            <span className="text-purple-300">Palavra</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.sentence }} />
                            <span className="text-blue-300">Frase</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.relatedWord }} />
                            <span className="text-purple-200">Relacionada</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Selected node detail panel */}
            {selectedNode && (
                <div
                    className="animate-in slide-in-from-bottom-4 duration-200"
                    style={{
                        background: COLORS.panelBg,
                        borderTop: '1px solid rgba(139, 92, 246, 0.3)',
                        height: `${panelHeight}px`,
                    }}
                >
                    <div className="px-4 py-3 h-full overflow-y-auto">
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                                {selectedNode.type === 'sentence' ? (
                                    <>
                                        <span className="text-[10px] text-purple-400 font-bold uppercase">Frase</span>
                                        <p className="text-white text-sm leading-relaxed mt-1">
                                            {selectedNode.sentenceText}
                                        </p>
                                        {selectedNode.sentenceTranslation && (
                                            <p className="text-purple-300/70 text-xs italic mt-1">
                                                {selectedNode.sentenceTranslation}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <span className="text-[10px] text-purple-400 font-bold uppercase">Palavra</span>
                                        <p className="text-white font-bold text-lg mt-1">{selectedNode.label}</p>
                                        {selectedNode.pinyin && (
                                            <p className="text-purple-300 text-sm">{selectedNode.pinyin}</p>
                                        )}
                                        {selectedNode.meaning && (
                                            <p className="text-purple-200/70 text-sm mt-1">{selectedNode.meaning}</p>
                                        )}
                                    </>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedNode(null)}
                                className="p-1.5 rounded-full text-purple-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
                                aria-label="Fechar painel de detalhes"
                            >
                                <Icon name="x" size={16} />
                            </button>
                        </div>

                        {/* Navigate to related word */}
                        {selectedNode.type === 'related-word' && (
                            <button
                                onClick={() => {
                                    setHistory(prev => [...prev, selectedNode.label]);
                                    setSelectedNode(null);
                                    onNavigate(selectedNode.label);
                                }}
                                className="mt-2 flex items-center gap-2 px-4 py-2 bg-purple-600/50 text-white rounded-xl text-sm font-medium hover:bg-purple-600/70 transition-colors cursor-pointer w-full justify-center"
                            >
                                <Icon name="brain" size={16} />
                                Explorar conexões de "{selectedNode.label}"
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NeuralGraphModal;
