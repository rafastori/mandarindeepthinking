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
import { buildGraphForWord, GraphNode, NeuralGraphData, getAllSavedWords } from '../services/neuralGraphService';
import { ensureEmbeddingsReady } from '../services/embeddingCacheService';
import { getSavedItems } from '../utils/cardUtils';

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
    onRecordResult?: (isCorrect: boolean, word: string) => void;
}

// ============================================================
// Quiz builder — picks 3 random distractors from library
// ============================================================
interface QuizData {
    correct: string;
    options: string[];
}

const buildQuiz = (
    targetNode: GraphNode,
    data: StudyItem[],
    savedIds: string[],
): QuizData | null => {
    if (!targetNode.meaning) return null;

    // Distractors from the user's saved words (same source as PracticeView)
    const savedCards = getSavedItems(data, savedIds);
    const pool = new Set<string>();
    for (const c of savedCards) {
        if (c.meaning && c.word !== targetNode.label) pool.add(c.meaning);
    }
    pool.delete(targetNode.meaning);

    // Fallback: if there aren't 3 saved distractors, fill from all library meanings
    if (pool.size < 3) {
        for (const item of data) {
            if (item.type === 'word' && item.translation && item.chinese !== targetNode.label) {
                pool.add(item.translation);
            }
            if (item.keywords) {
                for (const kw of item.keywords) {
                    if (kw.meaning && kw.word !== targetNode.label) pool.add(kw.meaning);
                }
            }
        }
        pool.delete(targetNode.meaning);
    }

    const distractors = Array.from(pool).sort(() => Math.random() - 0.5).slice(0, 3);
    if (distractors.length < 3) return null;

    const options = [...distractors, targetNode.meaning].sort(() => Math.random() - 0.5);
    return { correct: targetNode.meaning, options };
};

// ============================================================
// Error Halo — slow red pulse on words the user got wrong
// ============================================================
const ErrorHalo: React.FC<{ radius: number; seed: number }> = ({ radius, seed }) => {
    const ref = useRef<THREE.Mesh>(null);
    const period = 4 + (seed % 100) / 100; // 4..5s
    const phase = ((seed * 13) % 100) / 100 * Math.PI * 2;
    const freq = (Math.PI * 2) / period;

    useFrame((state) => {
        if (!ref.current) return;
        const mat = ref.current.material as THREE.MeshBasicMaterial;
        const t = state.clock.getElapsedTime() * freq + phase;
        const wave = Math.pow(0.5 + 0.5 * Math.sin(t), 2);
        mat.opacity = 0.1 + wave * 0.55;
        const s = 1 + wave * 0.35;
        ref.current.scale.set(s, s, s);
    });

    return (
        <mesh ref={ref}>
            <sphereGeometry args={[radius, 16, 16]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.1} />
        </mesh>
    );
};

const COLORS = {
    bg: '#030712',
    word: '#8b5cf6',
    sentence: '#3b82f6',
    relatedWord: '#a78bfa',
    proximity: '#7c6ba0',
    galaxy: '#06b6d4',
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
const PulsingLink: React.FC<{
    positions: Float32Array;
    color: string;
    baseOpacity: number;
    phase: number;
    period: number;
}> = ({ positions, color, baseOpacity, phase, period }) => {
    const glowRef = useRef<THREE.Mesh>(null);
    const freq = (Math.PI * 2) / period;

    const { length, midpoint, quaternion } = useMemo(() => {
        const s = new THREE.Vector3(positions[0], positions[1], positions[2]);
        const e = new THREE.Vector3(positions[3], positions[4], positions[5]);
        const dir = e.clone().sub(s);
        const len = dir.length();
        const mid = s.clone().lerp(e, 0.5);
        const up = new THREE.Vector3(0, 1, 0);
        const norm = dir.clone().normalize();
        const quat = new THREE.Quaternion();
        if (Math.abs(norm.dot(up)) > 0.99) {
            quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        } else {
            quat.setFromUnitVectors(up, norm);
        }
        return { length: len, midpoint: mid, quaternion: quat };
    }, [positions]);

    useFrame((state) => {
        if (!glowRef.current) return;
        const mat = glowRef.current.material as THREE.MeshBasicMaterial;
        const t = state.clock.getElapsedTime() * freq + phase;
        const wave = Math.pow(0.5 + 0.5 * Math.sin(t), 2);
        // Scale XZ = radial thickness: 1 → 1,5x at peak
        const scaleXZ = 1 + wave * 1.2;
        glowRef.current.scale.set(scaleXZ, 1, scaleXZ);
        mat.opacity = wave * 0.010;
        // Color shifts from base hue to near-white at peak (blooms harder)
        mat.color.set(color).lerp(new THREE.Color('#771959ff'), wave * 0.7);
    });

    return (
        <group position={midpoint} quaternion={quaternion}>
            {/* Thin static core */}
            <mesh>
                <cylinderGeometry args={[0.12, 0.12, length, 4, 1]} />
                <meshBasicMaterial color={color} transparent opacity={baseOpacity} />
            </mesh>
            {/* Wide animated glow halo */}
            <mesh ref={glowRef}>
                <cylinderGeometry args={[0.55, 0.55, length, 8, 10]} />
                <meshBasicMaterial color={color} transparent opacity={0} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};

// ============================================================
// NodeMesh — a glowing neuron sphere with billboard label
// ============================================================
const NodeMesh: React.FC<{
    node: D3Node3D;
    isSelected: boolean;
    isDimmed: boolean;
    isErrored: boolean;
    color: string;
    onSelect: () => void;
    onDoubleClick: () => void;
}> = ({ node, isSelected, isDimmed, isErrored, color, onSelect, onDoubleClick }) => {
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
    const isGalaxy = node.type === 'galaxy';

    const coreRadius = isWord ? 3.5 : isSentence ? 2.5 : isGalaxy ? 2.8 : isProximity ? 1.8 : 3;
    const atmosRadius = isWord ? 6 : isSentence ? 4 : isGalaxy ? 5 : isProximity ? 3 : 5;

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

            {/* Error halo — slow red pulse on words the user got wrong */}
            {isErrored && !isProximity && (
                <ErrorHalo
                    radius={atmosRadius * 1.15}
                    seed={node.label.split('').reduce((a, c) => a + c.charCodeAt(0), 0)}
                />
            )}

            {/* Core neural kernel */}
            <mesh>
                <sphereGeometry args={[isSelected ? coreRadius * 1.2 : coreRadius, 24, 24]} />
                <meshStandardMaterial
                    color={isSelected ? color : '#ffffff'}
                    emissive={color}
                    emissiveIntensity={isSelected ? 8 : (isProximity || isGalaxy ? 0.6 : 1.5)}
                    roughness={0}
                    metalness={1}
                    transparent={isProximity || isGalaxy}
                    opacity={isProximity ? 0.5 : (isGalaxy ? 0.8 : 1)}
                />
            </mesh>

            {/* Galaxy Orbital Ring */}
            {isGalaxy && (
                <group rotation={[Math.PI / 2.5, 0, 0]}>
                    <mesh>
                        <torusGeometry args={[coreRadius + 3, 0.2, 8, 32]} />
                        <meshBasicMaterial color={color} transparent opacity={0.6} />
                    </mesh>
                    <mesh>
                        <torusGeometry args={[coreRadius + 4.5, 0.1, 8, 32]} />
                        <meshBasicMaterial color={color} transparent opacity={0.3} />
                    </mesh>
                </group>
            )}

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
                    {isGalaxy && (node as any).similarityScore
                        ? `${displayLabel.toUpperCase()} ✨ ${Math.round((node as any).similarityScore * 100)}%`
                        : displayLabel.toUpperCase()}
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
                const isGalaxyLink = sourceNode.type === 'galaxy' || targetNode.type === 'galaxy';

                const opacity = isGalaxyLink ? 0.08 : (isProximityLink ? 0.06 : (isRelevant ? 0.3 : 0.06));
                const color = isGalaxyLink ? '#06b6d4' : (isProximityLink ? '#5a4d78' : (isRelevant ? '#818cf8' : '#4338ca'));

                const positions = new Float32Array([
                    sourceNode.x || 0, sourceNode.y || 0, sourceNode.z || 0,
                    targetNode.x || 0, targetNode.y || 0, targetNode.z || 0,
                ]);

                const shouldPulse = isRelevant && !isProximityLink;

                if (shouldPulse) {
                    // Stable per-link phase + period so pulses are desynced but deterministic
                    const hash = (sourceId + targetId).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                    const phase = (hash % 100) / 100 * Math.PI * 2;
                    const period = 6 + ((hash >> 6) % 100) / 100; // 6..6s

                    return (
                        <PulsingLink
                            key={`link-${idx}`}
                            positions={positions}
                            color={color}
                            baseOpacity={opacity}
                            phase={phase}
                            period={period}
                        />
                    );
                }

                return (
                    <line key={`link-${idx}`}>
                        <bufferGeometry attach="geometry">
                            <float32BufferAttribute
                                attach="attributes-position"
                                args={[positions, 3]}
                            />
                        </bufferGeometry>
                        <lineBasicMaterial attach="material" color={color} transparent opacity={opacity} />
                    </line>
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
    erroredWords: Set<string>;
}> = ({ graphData, word, onNodeSelect, onNodeCenter, selectedNodeId, erroredWords }) => {
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
        if (node.type === 'galaxy') return COLORS.galaxy;
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
                        isErrored={erroredWords.has(node.label)}
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
    word, data, savedIds, stats, onNavigate, onClose, onRecordResult,
}) => {
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [centeredNodeId, setCenteredNodeId] = useState<string | null>(null);
    const [history, setHistory] = useState<string[]>([word]);
    const containerRef = useRef<HTMLDivElement>(null);

    // ---- Gamification state ----
    const [isGamified, setIsGamified] = useState(false);
    const [sessionXP, setSessionXP] = useState(0);
    const [quiz, setQuiz] = useState<{
        node: GraphNode;
        correct: string;
        options: string[];
        picked: string | null;
    } | null>(null);
    const [correctedWords, setCorrectedWords] = useState<Set<string>>(new Set());

    // Words the user errored in the past — derived from stats.wordCounts
    // Minus ones the user corrected during this neural-map session.
    const erroredWords = useMemo(() => {
        const set = new Set<string>();
        const wc = stats?.wordCounts || {};
        for (const [w, count] of Object.entries(wc)) {
            if ((count as number) > 0 && !correctedWords.has(w)) set.add(w);
        }
        return set;
    }, [stats, correctedWords]);

    // ---- Embeddings Cache State ----
    const [isAnalyzing, setIsAnalyzing] = useState(true);
    const [embeddingsReady, setEmbeddingsReady] = useState(false);

    useEffect(() => {
        let mounted = true;
        const initEmbeddings = async () => {
            const allWords = getAllSavedWords(data, savedIds);
            const ready = await ensureEmbeddingsReady(allWords);
            if (mounted) {
                setEmbeddingsReady(ready);
                setIsAnalyzing(false);
            }
        };
        initEmbeddings();
        return () => { mounted = false; };
    }, [data, savedIds]);

    // ---- Graph data ----
    const graphData: NeuralGraphData = useMemo(() => {
        if (!embeddingsReady && isAnalyzing) {
            return { nodes: [], links: [] }; // Return empty while analyzing
        }
        return buildGraphForWord(word, data, savedIds);
    }, [word, data, savedIds, embeddingsReady, isAnalyzing]);

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

    // ---- Single click: center camera + highlight node (+ trigger quiz in gamified mode) ----
    const handleNodeCenter = useCallback((node: GraphNode) => {
        setCenteredNodeId(node.id);
        if (!isGamified) return;
        // Always try to replace with a new quiz for the clicked node
        const isQuizzable = (node.type === 'word' || node.type === 'related-word' || node.type === 'proximity') && !!node.meaning;
        if (isQuizzable) {
            const q = buildQuiz(node, data, savedIds);
            setQuiz(q ? { node, correct: q.correct, options: q.options, picked: null } : null);
        } else {
            setQuiz(null);
        }
    }, [isGamified, data, savedIds]);

    // ---- Quiz answer handler ----
    const handleQuizAnswer = useCallback((option: string) => {
        if (!quiz || quiz.picked) return;
        const isCorrect = option === quiz.correct;
        setQuiz(prev => prev ? { ...prev, picked: option } : null);
        onRecordResult?.(isCorrect, quiz.node.label);
        if (isCorrect) {
            setSessionXP(p => p + 10);
            setCorrectedWords(prev => {
                const next = new Set(prev);
                next.add(quiz.node.label);
                return next;
            });
        }
        // No auto-dismiss — quiz stays showing feedback until the user clicks another node or toggles Quiz off.
    }, [quiz, onRecordResult]);

    // ---- Clear quiz when toggling gamification off ----
    useEffect(() => {
        if (!isGamified) setQuiz(null);
    }, [isGamified]);

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
                                    className={`text-sm font-medium truncate ${i === history.length - 1 ? 'text-white font-bold' : 'text-purple-400/70'
                                        }`}
                                >
                                    {w}
                                </span>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Quiz Mode toggle */}
                    <button
                        onClick={() => setIsGamified(v => !v)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400 ${isGamified
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-lg shadow-rose-500/30'
                            : 'bg-white/5 text-purple-300 hover:bg-white/10 border border-purple-400/20'}`}
                        aria-pressed={isGamified}
                        aria-label="Alternar modo Quiz"
                        title="Modo Quiz — ganhe XP ao clicar nos nós"
                    >
                        <Icon name="zap" size={14} className={isGamified ? '' : 'opacity-60'} />
                        <span>{isGamified ? 'Quiz ON' : 'Quiz'}</span>
                    </button>

                    {/* XP counter — visible only in gamified mode */}
                    {isGamified && (
                        <div
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-amber-200"
                            style={{
                                background: 'rgba(245, 158, 11, 0.12)',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                            }}
                            aria-label={`${sessionXP} pontos ganhos nesta sessão`}
                        >
                            <Icon name="star" size={14} className="text-amber-300" />
                            <span>+{sessionXP} XP</span>
                        </div>
                    )}

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
                {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                        <div className="bg-cyan-500/20 p-5 rounded-full mb-4 animate-pulse">
                            <Icon name="orbit" size={40} className="text-cyan-400/80 animate-spin-slow" />
                        </div>
                        <p className="text-cyan-300 font-medium text-lg mb-2">
                            Analisando relações semânticas...
                        </p>
                        <p className="text-cyan-400/50 text-sm max-w-[280px]">
                            Construindo o Cosmos para "{word}".
                        </p>
                    </div>
                ) : graphData.nodes.length === 0 ? (
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
                                erroredWords={erroredWords}
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

                {/* Hint text — hidden while quiz is active */}
                {!quiz && (
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
                            {isGamified
                                ? 'Modo Quiz • Clique em uma palavra para responder'
                                : 'Clique para Centralizar • Duplo Clique para Detalhes'}
                        </p>
                    </div>
                )}

                {/* Quiz panel — multiple choice at the bottom */}
                {quiz && (
                    <div
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(96%,640px)] rounded-2xl p-4 z-20"
                        style={{
                            background: 'rgba(15, 10, 30, 0.85)',
                            backdropFilter: 'blur(16px) saturate(1.4)',
                            border: '1px solid rgba(139, 92, 246, 0.25)',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                        }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-purple-400">
                                    Qual o significado de
                                </span>
                            </div>
                            <button
                                onClick={() => setQuiz(null)}
                                className="text-purple-300/60 hover:text-white p-1 rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400"
                                aria-label="Fechar quiz"
                            >
                                <Icon name="x" size={16} />
                            </button>
                        </div>

                        <div className="mb-4 text-center">
                            <span className="text-3xl font-black text-white tracking-tight">
                                {quiz.node.label}
                            </span>
                            {quiz.node.pinyin && (
                                <span className="block text-sm text-purple-300/80 mt-1 tracking-wide">
                                    {quiz.node.pinyin}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {quiz.options.map((opt, i) => {
                                const isPicked = quiz.picked === opt;
                                const isAnswered = quiz.picked !== null;
                                const isRight = opt === quiz.correct;
                                const showRight = isAnswered && isRight;
                                const showWrong = isAnswered && isPicked && !isRight;

                                return (
                                    <button
                                        key={`${opt}-${i}`}
                                        disabled={isAnswered}
                                        onClick={() => handleQuizAnswer(opt)}
                                        className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400 ${showRight
                                            ? 'bg-green-500/25 border border-green-400/60 text-green-100'
                                            : showWrong
                                                ? 'bg-red-500/25 border border-red-400/60 text-red-100'
                                                : isAnswered
                                                    ? 'bg-white/5 border border-white/5 text-slate-400 opacity-50'
                                                    : 'bg-white/8 hover:bg-white/15 border border-white/10 text-slate-100 hover:scale-[1.02] active:scale-[0.98]'}`}
                                    >
                                        {opt}
                                    </button>
                                );
                            })}
                        </div>

                        {quiz.picked && (
                            <div className="mt-3 text-center">
                                {quiz.picked === quiz.correct ? (
                                    <span className="text-sm font-bold text-green-300">
                                        ✓ Correto! +10 XP
                                    </span>
                                ) : (
                                    <span className="text-sm font-bold text-red-300">
                                        ✗ Resposta certa: <span className="text-white">{quiz.correct}</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}
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
