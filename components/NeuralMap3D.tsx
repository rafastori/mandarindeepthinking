import React, {
    useState, useMemo, useCallback, useEffect, useRef,
    Component, ErrorInfo, ReactNode
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Text, Billboard, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import * as d3 from 'd3-force-3d';
import Icon from './Icon';
import NeuralSidebar from './NeuralSidebar';
import { StudyItem, Stats } from '../types';
import { buildGraphForWord, GraphNode, NeuralGraphData } from '../services/neuralGraphService';

/**
 * NeuralMap3D — v2 (R3F + Bloom + d3-force-3d)
 *
 * Fullscreen 3D neural graph rebuilt with @react-three/fiber for premium visuals.
 * Visual metaphor: "Neural Cosmos" — glowing neurons floating in a star field
 * connected by signal pulses that travel along synaptic links.
 *
 * Skills applied:
 * - @3d-web-experience: R3F scene, Bloom postprocessing, proper disposal
 * - @react-best-practices: useMemo, useCallback, stable closures, lazy Canvas
 * - @typescript-expert: Strict null guards, no unsafe `any` leaks
 * - @ui-ux-expert: Loading/empty/error states, glassmorphism sidebar, aria-labels
 */

// ============================================================
// Error Boundary — Catches WebGL/Three.js crashes
// ============================================================
interface EBState { hasError: boolean; error?: Error }

class Graph3DErrorBoundary extends Component<
    { children: ReactNode; onClose: () => void },
    EBState
> {
    state: EBState = { hasError: false };

    static getDerivedStateFromError(error: Error): EBState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[NeuralMap3D] Render crash:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <div className="bg-red-500/20 p-5 rounded-full mb-4">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <p className="text-purple-300 font-medium text-lg mb-2">
                        Erro ao renderizar o mapa 3D
                    </p>
                    <p className="text-purple-400/50 text-sm max-w-[320px] mb-4">
                        {this.state.error?.message || 'Erro inesperado no WebGL.'}
                    </p>
                    <button
                        onClick={this.props.onClose}
                        className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-500 transition-colors cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// ============================================================
// Props & Colors
// ============================================================
export interface NeuralMap3DProps {
    word: string;
    data: StudyItem[];
    savedIds: string[];
    stats?: Stats;
    onNavigate: (newWord: string) => void;
    onClose: () => void;
}

const COLORS = {
    bg: '#030712',
    word: '#8b5cf6',
    sentence: '#3b82f6',
    relatedWord: '#a78bfa',
    proximity: '#7c6ba0',
};

const GROUP_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6'];

// ============================================================
// D3Node3D: Extended GraphNode with 3D coords
// ============================================================
interface D3Node3D extends GraphNode {
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
}

// ============================================================
// Signal Pulse — a glowing dot that travels along a link
// ============================================================
const SignalPulse: React.FC<{
    start: THREE.Vector3;
    end: THREE.Vector3;
    color: string;
    speed?: number;
}> = ({ start, end, color, speed = 1 }) => {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            const t = (state.clock.getElapsedTime() * speed) % 1;
            meshRef.current.position.lerpVectors(start, end, t);
        }
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[0.6, 6, 6]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
    );
};

// ============================================================
// NodeMesh — a glowing neuron sphere with billboard label
// ============================================================
const NodeMesh: React.FC<{
    node: D3Node3D;
    isSelected: boolean;
    isDimmed: boolean;
    color: string;
    onSelect: () => void;
    onDoubleClick: () => void;
}> = ({ node, isSelected, isDimmed, color, onSelect, onDoubleClick }) => {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (groupRef.current) {
            const time = state.clock.getElapsedTime();
            // Gentle floating
            groupRef.current.position.y = (node.y || 0) + Math.sin(time + (node.x || 0)) * 1.5;
            groupRef.current.position.x = node.x || 0;
            groupRef.current.position.z = node.z || 0;

            // Focus-proximity scaling
            const screenPos = groupRef.current.position.clone();
            screenPos.project(state.camera);
            const screenDist = Math.sqrt(screenPos.x * screenPos.x + screenPos.y * screenPos.y);
            const focusProximity = Math.max(0, 1 - Math.min(1, screenDist * 1.5));

            const targetScale = (isSelected ? 2.2 : 1.0) + focusProximity * (isSelected ? 2.0 : 1.2);
            const s = THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.08);
            groupRef.current.scale.set(s, s, s);
        }
    });

    const isProximity = node.type === 'proximity';
    const isSentence = node.type === 'sentence';
    const isWord = node.type === 'word';

    const coreRadius = isWord ? 3.5 : isSentence ? 2.5 : isProximity ? 1.8 : 3;
    const atmosRadius = isWord ? 6 : isSentence ? 4 : isProximity ? 3 : 5;

    // Truncated label for sentences
    const displayLabel = isSentence
        ? (node.label.length > 12 ? node.label.substring(0, 12) + '…' : node.label)
        : node.label;

    return (
        <group
            ref={groupRef}
            onClick={(e) => {
                e.stopPropagation();
                if (e.detail === 2) {
                    onDoubleClick();
                } else {
                    onSelect();
                }
            }}
        >
            {/* Outer atmosphere glow */}
            <mesh>
                <sphereGeometry args={[isSelected ? atmosRadius * 1.3 : atmosRadius, 16, 16]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={isSelected ? 0.25 : (isProximity ? 0.03 : 0.06)}
                />
            </mesh>

            {/* Core neural kernel */}
            <mesh>
                <sphereGeometry args={[isSelected ? coreRadius * 1.2 : coreRadius, 24, 24]} />
                <meshStandardMaterial
                    color={isSelected ? color : '#ffffff'}
                    emissive={color}
                    emissiveIntensity={isSelected ? 8 : (isProximity ? 0.6 : 1.5)}
                    roughness={0}
                    metalness={1}
                    transparent={isProximity}
                    opacity={isProximity ? 0.5 : 1}
                />
            </mesh>

            {/* Billboard label — always faces user */}
            <Billboard
                follow={true}
                lockX={false}
                lockY={false}
                lockZ={false}
                position={[0, isSelected ? coreRadius + 10 : coreRadius + 7, 0]}
            >
                <Text
                    fontSize={isSelected ? 5 : (isSentence ? 2.5 : 3.5)}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                    maxWidth={40}
                    textAlign="center"
                    fillOpacity={isDimmed ? 0.15 : (isProximity ? 0.5 : 1)}
                >
                    {displayLabel.toUpperCase()}
                </Text>
            </Billboard>

            {/* Pinyin label below node */}
            {node.pinyin && !isSentence && (
                <Billboard
                    follow={true}
                    lockX={false}
                    lockY={false}
                    lockZ={false}
                    position={[0, isSelected ? coreRadius + 5 : coreRadius + 3.5, 0]}
                >
                    <Text
                        fontSize={2.2}
                        color="#a78bfa"
                        anchorX="center"
                        anchorY="middle"
                        fillOpacity={isDimmed ? 0.1 : 0.7}
                    >
                        {node.pinyin}
                    </Text>
                </Billboard>
            )}
        </group>
    );
};

// ============================================================
// Links — rendered as lines with signal pulses
// ============================================================
const Links: React.FC<{
    links: any[];
    nodes: D3Node3D[];
    selectedId: string | null;
}> = ({ links, nodes, selectedId }) => {
    return (
        <group>
            {links.map((link, idx) => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;

                const sourceNode = nodes.find(n => n.id === sourceId);
                const targetNode = nodes.find(n => n.id === targetId);

                if (!sourceNode || !targetNode) return null;

                const isRelevant = selectedId === null || sourceNode.id === selectedId || targetNode.id === selectedId;
                const isProximityLink = sourceNode.type === 'proximity' || targetNode.type === 'proximity';

                const opacity = isProximityLink ? 0.06 : (isRelevant ? 0.3 : 0.06);
                const color = isProximityLink ? '#5a4d78' : (isRelevant ? '#818cf8' : '#4338ca');

                const start = new THREE.Vector3(sourceNode.x || 0, sourceNode.y || 0, sourceNode.z || 0);
                const end = new THREE.Vector3(targetNode.x || 0, targetNode.y || 0, targetNode.z || 0);

                return (
                    <React.Fragment key={`link-${idx}`}>
                        <line>
                            <bufferGeometry attach="geometry">
                                <float32BufferAttribute
                                    attach="attributes-position"
                                    args={[new Float32Array([
                                        sourceNode.x || 0, sourceNode.y || 0, sourceNode.z || 0,
                                        targetNode.x || 0, targetNode.y || 0, targetNode.z || 0,
                                    ]), 3]}
                                />
                            </bufferGeometry>
                            <lineBasicMaterial attach="material" color={color} transparent opacity={opacity} />
                        </line>

                        {/* Signal pulse along relevant links */}
                        {isRelevant && !isProximityLink && (
                            <SignalPulse
                                start={start}
                                end={end}
                                color={color}
                                speed={0.3 + Math.random() * 0.5}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </group>
    );
};

// ============================================================
// Scene — the internal R3F scene with simulation
// ============================================================
const NeuralScene: React.FC<{
    graphData: NeuralGraphData;
    word: string;
    onNodeSelect: (node: GraphNode) => void;
    onNodeCenter: (node: GraphNode) => void;
    selectedNodeId: string | null;
}> = ({ graphData, word, onNodeSelect, onNodeCenter, selectedNodeId }) => {
    const [d3Nodes, setD3Nodes] = useState<D3Node3D[]>([]);
    const [d3Links, setD3Links] = useState<any[]>([]);
    const controlsRef = useRef<any>(null);

    // d3-force simulation (3D) — tighter clustering for easier navigation
    const simulation = useMemo(() => {
        return (d3 as any).forceSimulation()
            .numDimensions(3)
            .force('link', (d3 as any).forceLink().id((d: any) => d.id).distance(40))
            .force('charge', (d3 as any).forceManyBody().strength(-200))
            .force('center', (d3 as any).forceCenter(0, 0, 0))
            .force('collision', (d3 as any).forceCollide().radius(20))
            .velocityDecay(0.4);
    }, []);

    useEffect(() => {
        const nodesCopy: D3Node3D[] = graphData.nodes.map(n => ({ ...n }));
        const linksCopy: any[] = graphData.links.map(l => ({ ...l }));

        simulation.nodes(nodesCopy);
        (simulation.force('link') as any).links(linksCopy);

        // Pre-run simulation to stable state
        for (let i = 0; i < 150; i++) simulation.tick();

        setD3Nodes([...nodesCopy]);
        setD3Links([...linksCopy]);

        // Slow reheat for ambient movement
        const timer = setInterval(() => {
            simulation.alphaTarget(0.008).restart();
        }, 3000);

        simulation.on('tick', () => {
            setD3Nodes([...nodesCopy]);
            setD3Links([...linksCopy]);
        });

        return () => {
            simulation.stop();
            clearInterval(timer);
        };
    }, [graphData, simulation]);

    // Helper: Get node color by type
    const getNodeColor = useCallback((node: D3Node3D): string => {
        if (node.type === 'word') return COLORS.word;
        if (node.type === 'sentence') return COLORS.sentence;
        if (node.type === 'proximity') return COLORS.proximity;
        // related-word: use group-based colors for variety
        const connections = node.connectionCount || 0;
        return GROUP_COLORS[connections % GROUP_COLORS.length];
    }, []);

    const handleCenter = useCallback((node: D3Node3D) => {
        if (controlsRef.current) {
            controlsRef.current.target.set(node.x || 0, node.y || 0, node.z || 0);
        }
    }, []);

    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 0, 120]} fov={50} />

            <ambientLight intensity={0.4} />
            <pointLight position={[100, 100, 100]} intensity={2} />
            <Stars radius={200} depth={100} count={5000} factor={6} saturation={0.5} fade speed={1.5} />

            <group>
                <Links
                    links={d3Links}
                    nodes={d3Nodes}
                    selectedId={selectedNodeId}
                />
                {d3Nodes.map(node => (
                    <NodeMesh
                        key={node.id}
                        node={node}
                        isSelected={node.id === selectedNodeId}
                        isDimmed={selectedNodeId !== null && node.id !== selectedNodeId}
                        color={getNodeColor(node)}
                        onSelect={() => {
                            handleCenter(node);
                            onNodeCenter(node);
                        }}
                        onDoubleClick={() => onNodeSelect(node)}
                    />
                ))}
            </group>

            <EffectComposer>
                <Bloom
                    luminanceThreshold={1.0}
                    mipmapBlur
                    intensity={1.4}
                    radius={0.85}
                />
            </EffectComposer>

            <OrbitControls
                ref={controlsRef}
                enableDamping
                dampingFactor={0.05}
                minDistance={20}
                maxDistance={400}
                autoRotate={!selectedNodeId}
                autoRotateSpeed={0.35}
                makeDefault
            />
        </>
    );
};

// ============================================================
// Main Component
// ============================================================
const NeuralMap3D: React.FC<NeuralMap3DProps> = ({
    word, data, savedIds, stats, onNavigate, onClose,
}) => {
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [centeredNodeId, setCenteredNodeId] = useState<string | null>(null);
    const [history, setHistory] = useState<string[]>([word]);
    const containerRef = useRef<HTMLDivElement>(null);

    // ---- Graph data ----
    const graphData: NeuralGraphData = useMemo(
        () => buildGraphForWord(word, data, savedIds),
        [word, data, savedIds]
    );

    // ---- ESC + scroll lock ----
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', h);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', h);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    // ---- Single click: center camera + highlight node ----
    const handleNodeCenter = useCallback((node: GraphNode) => {
        setCenteredNodeId(node.id);
    }, []);

    // ---- Double click: open sidebar with full details ----
    const handleNodeSelect = useCallback((node: GraphNode) => {
        setSelectedNode(node);
        setCenteredNodeId(node.id);
    }, []);

    // ---- Sidebar: navigate to a related node from sidebar ----
    const handleSidebarNodeSelect = useCallback((nodeId: string) => {
        const node = graphData.nodes.find(n => n.id === nodeId);
        if (node) {
            setSelectedNode(node);
            setCenteredNodeId(node.id);
        }
    }, [graphData.nodes]);

    // ---- Sidebar explore action ----
    const handleExplore = useCallback((wordLabel: string) => {
        setHistory(prev => [...prev, wordLabel]);
        setSelectedNode(null);
        onNavigate(wordLabel);
    }, [onNavigate]);

    // ---- Back / breadcrumb ----
    const handleBack = useCallback(() => {
        if (history.length > 1) {
            const h = [...history];
            h.pop();
            setHistory(h);
            setSelectedNode(null);
            onNavigate(h[h.length - 1]);
        } else {
            onClose();
        }
    }, [history, onNavigate, onClose]);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[200] flex flex-col"
            style={{ backgroundColor: COLORS.bg }}
        >
            {/* ── Plasma background ── */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.08) 0%, transparent 40%),
                        radial-gradient(circle at 80% 70%, rgba(244, 63, 94, 0.08) 0%, transparent 40%),
                        radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.05) 0%, transparent 60%)
                    `,
                    filter: 'blur(80px)',
                    animation: 'plasma-shift 20s ease-in-out infinite alternate',
                }}
            />

            {/* ── Header ── */}
            <div
                className="flex items-center justify-between px-4 py-3 z-10"
                style={{
                    background: 'rgba(3, 7, 18, 0.5)',
                    borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
                    backdropFilter: 'blur(12px)',
                    height: '56px',
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
                    <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                        {history.map((w, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && (
                                    <Icon name="chevron-right" size={14} className="text-purple-500/50 flex-shrink-0" />
                                )}
                                <span
                                    className={`text-sm font-medium truncate ${
                                        i === history.length - 1 ? 'text-white font-bold' : 'text-purple-400/70'
                                    }`}
                                >
                                    {w}
                                </span>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-mono text-indigo-400/50 hidden sm:inline-block uppercase tracking-[0.2em]">
                        Synapse 3D
                    </span>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-purple-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        aria-label="Fechar mapa neural"
                    >
                        <Icon name="x" size={20} />
                    </button>
                </div>
            </div>

            {/* ── 3D Viewport ── */}
            <div className="flex-1 relative">
                {graphData.nodes.length === 0 ? (
                    /* Empty state */
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
                            className="mt-6 px-6 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-500 transition-colors cursor-pointer"
                        >
                            Voltar
                        </button>
                    </div>
                ) : (
                    <Graph3DErrorBoundary onClose={onClose}>
                        <Canvas
                            dpr={[1, 2]}
                            onPointerMissed={() => {
                                setSelectedNode(null);
                                setCenteredNodeId(null);
                            }}
                            style={{ background: COLORS.bg }}
                        >
                            <NeuralScene
                                graphData={graphData}
                                word={word}
                                onNodeSelect={handleNodeSelect}
                                onNodeCenter={handleNodeCenter}
                                selectedNodeId={centeredNodeId}
                            />
                        </Canvas>
                    </Graph3DErrorBoundary>
                )}

                {/* Legend */}
                {graphData.nodes.length > 0 && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-3 px-3 py-2 rounded-xl text-[10px]"
                        style={{
                            background: 'rgba(3, 7, 18, 0.6)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(139, 92, 246, 0.1)',
                        }}
                    >
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.word }} />
                            <span className="text-purple-300">Palavra</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.sentence }} />
                            <span className="text-blue-300">Frase</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.relatedWord }} />
                            <span className="text-purple-200">Relacionada</span>
                        </div>
                    </div>
                )}

                {/* Hint text */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                    <p
                        className="text-[10px] uppercase tracking-[0.3em] font-mono px-4 py-1.5 rounded-full"
                        style={{
                            color: 'rgba(99, 102, 241, 0.5)',
                            background: 'rgba(15, 23, 42, 0.5)',
                            border: '1px solid rgba(99, 102, 241, 0.15)',
                            backdropFilter: 'blur(4px)',
                        }}
                    >
                        Clique para Centralizar • Duplo Clique para Detalhes
                    </p>
                </div>
            </div>

            {/* ── Sidebar (glassmorphism) ── */}
            <NeuralSidebar
                selectedNode={selectedNode}
                graphData={graphData}
                onClose={() => setSelectedNode(null)}
                onExplore={handleExplore}
                onNodeSelect={handleSidebarNodeSelect}
            />
        </div>
    );
};

export default NeuralMap3D;
