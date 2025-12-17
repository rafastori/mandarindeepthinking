import React, { useState, useEffect } from 'react';
import { PolyQuestRoom } from '../types';
import { generateBossLevel, BossLevelData } from '../../../services/gemini';
import Icon from '../../../components/Icon';

interface BossPhaseProps {
    room: PolyQuestRoom;
    currentUserId: string;
    onStartBoss: (bossData: BossLevelData) => void;
    onDamage: (damage: number, isFatal: boolean) => void;
    onAddBlock: (text: string) => Promise<void>;
    onRemoveBlock: (blockId: string) => Promise<void>;
    onReorderBlocks: (newOrder: any[]) => Promise<void>;
}

const USER_COLORS = [
    'border-pink-500 bg-pink-100 text-pink-900',
    'border-blue-500 bg-blue-100 text-blue-900',
    'border-green-500 bg-green-100 text-green-900',
    'border-yellow-500 bg-yellow-100 text-yellow-900',
    'border-purple-500 bg-purple-100 text-purple-900',
    'border-orange-500 bg-orange-100 text-orange-900',
];

const getUserColor = (userId: string) => {
    // Simple hash to pick a color
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % USER_COLORS.length;
    return USER_COLORS[index];
};

export const BossPhase: React.FC<BossPhaseProps> = ({
    room,
    currentUserId,
    onStartBoss,
    onDamage,
    onAddBlock,
    onRemoveBlock,
    onReorderBlocks
}) => {
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);
    const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);

    // DnD Handlers
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedBlockIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // Optional: Set ghost image
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggedBlockIndex === null) return;
        if (draggedBlockIndex === targetIndex) return;

        const placedBlocks = room.bossState?.placedBlocks || [];
        const newBlocks = [...placedBlocks];
        const [movedBlock] = newBlocks.splice(draggedBlockIndex, 1);
        newBlocks.splice(targetIndex, 0, movedBlock);

        await onReorderBlocks(newBlocks);
        setDraggedBlockIndex(null);
    };

    // Initial Boss Generation (Only Host)
    useEffect(() => {
        const initBoss = async () => {
            if (room.bossLevel) return;
            if (room.hostId !== currentUserId) return;

            setLoading(true);
            try {
                const textContext = room.config.originalText || "PolyQuest Context";
                const bossData = await generateBossLevel(textContext, room.config.sourceLang);
                console.log("Boss Generated:", bossData);
                onStartBoss(bossData);
            } catch (error) {
                console.error("Failed to generate boss:", error);
                onStartBoss({
                    originalSentence: "Error generating boss level please try again",
                    translation: "Erro ao gerar nível do chefe, tente novamente",
                    blocks: ["Error", "generating", "boss", "level"]
                });
            } finally {
                setLoading(false);
            }
        };

        initBoss();
    }, [room.phase, room.bossLevel, room.hostId, currentUserId, room.config.originalText, room.config.targetLang, onStartBoss]);

    const placedBlocks = room.bossState?.placedBlocks || [];

    const handleBlockClick = (blockText: string) => {
        if (feedback) return;
        onAddBlock(blockText);
    };

    const handleRemoveBlock = (blockId: string) => {
        if (feedback) return;
        onRemoveBlock(blockId);
    };

    const handleAttack = () => {
        if (!room.bossLevel) return;

        // Construct sentence from shared state
        // FIX: Remove all whitespace, punctuation, and symbols to avoid issues with different language punctuations (e.g., Chinese commas)
        const normalize = (str: string) => str.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

        const constructedSentence = normalize(placedBlocks.map(b => b.text).join(''));
        const targetSentence = normalize(room.bossLevel.originalSentence);

        if (constructedSentence === targetSentence) {
            setFeedback('success');
            setTimeout(() => {
                onDamage(100, true); // Fatal damage
            }, 1000);
        } else {
            setFeedback('error');
            setTimeout(() => {
                setFeedback(null);
                // Maybe clear blocks on fail? Or keep them for correction? 
                // Let's keep them (collaborative fixing).
                // Just penalty.
                onDamage(10, false);
            }, 1000);
        }
    };

    if (loading || !room.bossLevel) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                <Icon name="skull" size={64} className="text-purple-600 animate-pulse mb-4" />
                <h2 className="text-2xl font-bold text-slate-800 mb-2">O Chefe Final Desperta...</h2>
                <p className="text-slate-500 animate-bounce">Aguarde enquanto o desafio é gerado...</p>
            </div>
        );
    }

    // Available blocks: Initial blocks minus Used blocks (by count)
    // To permit duplicates if the sentence has duplicates, we check counts.
    const availableBlocks = room.bossLevel.blocks.filter(b =>
        placedBlocks.filter(pb => pb.text === b).length < room.bossLevel!.blocks.filter(ob => ob === b).length
    );

    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Header / Boss Status */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl p-6 text-white mb-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Icon name="skull" size={120} />
                </div>

                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                            <Icon name="swords" />
                            BOSS FINAL (Colaborativo)
                        </h2>
                        <p className="text-purple-100 text-lg mb-2 max-w-2xl">
                            Reconstruam a frase JUNTOS!
                            <br />
                            <span className="text-sm opacity-75 font-semibold">Pista (Tradução): "{room.bossLevel.translation}"</span>
                        </p>
                    </div>
                    {/* Players Legend */}
                    <div className="bg-purple-800/50 p-2 rounded-lg text-xs">
                        {room.players.map(p => (
                            <div key={p.id} className="flex items-center gap-2 mb-1">
                                <span className={`w-3 h-3 rounded-full border ${getUserColor(p.id).split(' ')[0].replace('border', 'bg')}`}></span>
                                <div className="flex flex-col leading-tight">
                                    <span className="font-bold">{p.name} ({p.score || 0} pts)</span>
                                    <span className="text-[9px] opacity-75 uppercase font-bold text-white/80">LVL {p.totalScore || 0}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Team Confidence Bar */}
                <div className="flex items-center gap-4 mt-4">
                    <Icon name="heart" className="text-red-400" />
                    <div className="flex-1 h-4 bg-purple-900/50 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-500"
                            style={{ width: `${room.confidence}%` }}
                        />
                    </div>
                    <span className="font-mono">{Math.round(room.confidence || 0)}%</span>
                </div>
            </div>

            {/* Construction Area */}
            <div className={`
                bg-white rounded-xl p-6 shadow-sm border-2 min-h-[120px] flex flex-wrap items-center gap-2 mb-6 transition-colors
                ${feedback === 'success' ? 'border-green-500 bg-green-50' : ''}
                ${feedback === 'error' ? 'border-red-500 bg-red-50' : 'border-slate-200'}
            `}>
                {placedBlocks.length === 0 && (
                    <span className="text-slate-400 italic w-full text-center">
                        Clan, cliquem nos blocos abaixo para montar a frase...
                    </span>
                )}

                {placedBlocks.map((block, idx) => (
                    <div
                        key={block.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        className={`
                            group relative px-4 py-2 rounded-lg font-bold shadow-sm animate-in zoom-in duration-200 cursor-move
                            ${getUserColor(block.placedBy)}
                            ${draggedBlockIndex === idx ? 'opacity-50' : ''}
                        `}
                    >
                        {block.text}
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemoveBlock(block.id); }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="flex justify-end items-center mb-8">
                <button
                    onClick={handleAttack}
                    disabled={placedBlocks.length === 0}
                    className={`
                        px-8 py-3 rounded-xl font-bold text-lg shadow-lg flex items-center gap-2 transition-all
                        ${placedBlocks.length === 0
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-105 active:scale-95 hover:shadow-purple-500/25'
                        }
                    `}
                >
                    <Icon name="zap" />
                    ATACAR
                </button>
            </div>

            {/* Available Blocks */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {availableBlocks.map((block, idx) => (
                    <button
                        key={`${block}-${idx}`}
                        onClick={() => handleBlockClick(block)}
                        className="bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 px-4 py-3 rounded-xl text-slate-700 text-lg font-medium transition-all shadow-sm active:scale-95 text-center"
                    >
                        {block}
                    </button>
                ))}
            </div>
        </div >
    );
};
