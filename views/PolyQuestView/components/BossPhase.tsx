import React, { useState, useEffect } from 'react';
import { PolyQuestRoom } from '../types';
import { generateBossLevel, BossLevelData } from '../../../services/gemini';
import Icon from '../../../components/Icon';

interface BossPhaseProps {
    room: PolyQuestRoom;
    currentUserId: string;
    onStartBoss: (bossData: BossLevelData) => void;
    onDamage: (damage: number, isFatal: boolean) => void;
}

export const BossPhase: React.FC<BossPhaseProps> = ({
    room,
    currentUserId,
    onStartBoss,
    onDamage
}) => {
    const [loading, setLoading] = useState(false);
    const [myBlocks, setMyBlocks] = useState<string[]>([]);
    const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);

    // Initial Boss Generation (Only Host)
    useEffect(() => {
        const initBoss = async () => {
            // Se já tem dados do boss, não gera de novo
            if (room.bossLevel) return;

            // Só o host gera
            if (room.hostId !== currentUserId) return;

            setLoading(true);
            try {
                // Usamos o texto original da sala ou um fallback
                const textContext = room.config.originalText || "PolyQuest Context";
                const bossData = await generateBossLevel(textContext, room.config.targetLang);
                console.log("Boss Generated:", bossData);
                onStartBoss(bossData);
            } catch (error) {
                console.error("Failed to generate boss:", error);
                // Fallback simples se a AI falhar (para não travar o jogo)
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

    // Handle dropping/selecting blocks (Simplified to click for now)
    const handleBlockClick = (block: string) => {
        if (feedback) return; // Wait for feedback to clear

        const newBlocks = [...myBlocks, block];
        setMyBlocks(newBlocks);

        // Check if current construction is a prefix of validity? 
        // Na verdade, a regra simplificada é: Montar a frase toda localmente.
        // Se o usuário clicar em "ATACAR" (Enviar), verificamos.
    };

    const handleReset = () => {
        setMyBlocks([]);
        setFeedback(null);
    };

    const handleAttack = () => {
        if (!room.bossLevel) return;

        const constructedSentence = myBlocks.join('').replace(/\s+/g, '').toLowerCase(); // Comparação simplificada removendo espaços
        const targetSentence = room.bossLevel.originalSentence.replace(/\s+/g, '').toLowerCase();

        if (constructedSentence === targetSentence) {
            setFeedback('success');
            // Delay to show success animation then trigger global win
            setTimeout(() => {
                onDamage(100, true); // Fatal damage
            }, 1000);
        } else {
            setFeedback('error');
            setTimeout(() => {
                setFeedback(null);
                setMyBlocks([]);
                onDamage(10, false); // 10 damage to confidence
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

    const availableBlocks = room.bossLevel.blocks.filter(b =>
        // Simples contagem de ocorrências para permitir blocos repetidos se necessário? 
        // Por simplificação: Removemos da lista de disponíveis os que já foram usados?
        // Melhor: Mostramos todos, mas desabilitamos os usados se contarmos por índice.
        // Como strings podem ser iguais, ideal seria ter IDs nos blocos, mas por hora vamos filtrar por contagem.
        myBlocks.filter(mb => mb === b).length < room.bossLevel.blocks.filter(ob => ob === b).length
    );

    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Header / Boss Status */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl p-6 text-white mb-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Icon name="skull" size={120} />
                </div>

                <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                    <Icon name="swords" />
                    BOSS FINAL
                </h2>

                <p className="text-purple-100 text-lg mb-6 max-w-2xl">
                    Reconstrua a frase correta para derrotar o chefe!
                    <br />
                    <span className="text-sm opacity-75">Tradução: "{room.bossLevel.translation}"</span>
                </p>

                {/* Team Confidence Bar */}
                <div className="flex items-center gap-4">
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
                {myBlocks.length === 0 && (
                    <span className="text-slate-400 italic w-full text-center">
                        Clique nos blocos abaixo para montar a frase...
                    </span>
                )}

                {myBlocks.map((block, idx) => (
                    <span key={idx} className="bg-purple-100 text-purple-800 px-3 py-1.5 rounded-lg border border-purple-200 font-medium animate-in fade-in zoom-in duration-200">
                        {block}
                    </span>
                ))}
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center mb-8">
                <button
                    onClick={handleReset}
                    className="text-slate-500 hover:text-slate-700 font-medium px-4 py-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    Limpar
                </button>

                <button
                    onClick={handleAttack}
                    disabled={myBlocks.length === 0}
                    className={`
                        px-8 py-3 rounded-xl font-bold text-lg shadow-lg flex items-center gap-2 transition-all
                        ${myBlocks.length === 0
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
        </div>
    );
};
