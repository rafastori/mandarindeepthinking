
import React, { useMemo, useState, useEffect } from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom, PolyQuestPlayer, GAME_CONSTANTS } from '../types';
import { usePuterSpeech } from '../../../hooks/usePuterSpeech';
import { tokenizeTextWithAI } from '../../../services/gemini';

interface ExplorationPhaseProps {
    room: PolyQuestRoom;
    currentUserId: string;
    onToggleWord: (word: string) => void;
    onFinishExploration: () => void;
    onUpdateConfig?: (config: Partial<{ tokens: string[] }>) => void;  // Para salvar tokens
}

export const ExplorationPhase: React.FC<ExplorationPhaseProps> = ({
    room,
    currentUserId,
    onToggleWord,
    onFinishExploration,
    onUpdateConfig,
}) => {
    const { speak } = usePuterSpeech();
    const isHost = room.hostId === currentUserId;

    // Estado para tokens e loading
    const [tokens, setTokens] = useState<string[]>([]);
    const [isTokenizing, setIsTokenizing] = useState(false);
    const [tokenError, setTokenError] = useState<string | null>(null);

    // Efeito para carregar/gerar tokens
    useEffect(() => {
        // Se já temos tokens da room, usa eles
        if (room.config.tokens && room.config.tokens.length > 0) {
            setTokens(room.config.tokens);
            return;
        }

        // Idiomas CJK que precisam de tokenização por IA (não têm espaços entre palavras)
        const CJK_LANGUAGES = ['zh', 'ja', 'ko'];
        const isCJK = CJK_LANGUAGES.includes(room.config.sourceLang);

        // Se NÃO é CJK, usa tokenização local (split por espaços) - SEM custo de API
        if (!isCJK) {
            console.log('[ExplorationPhase] Using LOCAL tokenization for Western language:', room.config.sourceLang);
            const localTokens = room.config.originalText
                .split(/(\s+|[.,!?;:()])/)
                .filter(t => t.length > 0);
            setTokens(localTokens);

            // Salva na sala para outros jogadores
            if (isHost && onUpdateConfig && localTokens.length > 0) {
                onUpdateConfig({ tokens: localTokens });
            }
            return;
        }

        // Apenas para idiomas CJK: usa IA para tokenização correta
        const generateTokens = async () => {
            setIsTokenizing(true);
            setTokenError(null);

            try {
                console.log('[ExplorationPhase] Using AI tokenization for CJK language:', room.config.sourceLang);
                const aiTokens = await tokenizeTextWithAI(
                    room.config.originalText,
                    room.config.sourceLang
                );

                console.log('[ExplorationPhase] Got tokens:', aiTokens.length);
                setTokens(aiTokens);

                // Se temos callback para salvar, salva os tokens na sala (só host faz isso)
                if (isHost && onUpdateConfig && aiTokens.length > 0) {
                    console.log('[ExplorationPhase] Saving tokens to room...');
                    onUpdateConfig({ tokens: aiTokens });
                }
            } catch (error) {
                console.error('[ExplorationPhase] Tokenization failed:', error);
                setTokenError('Erro ao processar texto. Tente recarregar.');

                // Fallback local para não travar o jogo completamente
                const fallbackTokens = room.config.originalText
                    .split(/(\s+|[.,!?;:()]|[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+)/)
                    .filter(t => t.length > 0);
                setTokens(fallbackTokens);
            } finally {
                setIsTokenizing(false);
            }
        };

        generateTokens();
    }, [room.config.tokens, room.config.originalText, room.config.sourceLang, isHost, onUpdateConfig]);

    const isWord = (token: string) => {
        // Verifica se é uma palavra clicável (não apenas espaço ou pontuação pura)
        const trimmed = token.trim();
        if (trimmed.length === 0) return false;
        if (/^[\s.,!?;:()]+$/.test(trimmed)) return false;

        // Aceita letras latinas, CJK, Hangul, Hiragana, Katakana
        return /[\p{L}\p{N}]/u.test(trimmed);
    };

    const handleWordClick = (token: string) => {
        if (!isWord(token)) return;
        // Limpar token de pontuação se aderido (ex: "Hola," -> "Hola")
        // Mas nossa tokenização acima tenta separar.
        // Se o token for "Hola", ok.
        onToggleWord(token.trim());
    };

    const uniqueSelectedWords = useMemo(() => {
        return Array.from(new Set(room.selectedWords));
    }, [room.selectedWords]);

    return (
        <div className="flex flex-col h-full gap-4 md:flex-row">
            {/* Área do Texto (Esquerda/Centro) */}
            <div className="flex-1 bg-white rounded-2xl p-6 shadow-lg border border-slate-200 overflow-y-auto">
                <div className="mb-6">
                    {/* Title Row */}
                    <div className="mb-4">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Icon name="search" className="text-emerald-600" />
                            Fase 1: Exploração
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Clique nas palavras que você <span className="font-bold text-slate-700">não conhece</span> ou que parecem importantes.
                        </p>
                    </div>

                    {/* Scoreboard and Action Row - Only for Host */}
                    {isHost && (
                        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                            {/* Scoreboard (All Players) */}
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                                {room.players.map(p => (
                                    <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 shadow-sm flex-shrink-0">
                                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] uppercase font-bold text-slate-600">
                                            {p.name[0]}
                                        </div>
                                        <div className="flex flex-col leading-tight">
                                            <span className="text-[10px] font-bold text-slate-800">{p.score || 0} pts</span>
                                            <span className="text-[8px] font-semibold text-blue-600 uppercase">LVL {p.totalScore || 0}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Action Button */}
                            <button
                                onClick={onFinishExploration}
                                disabled={uniqueSelectedWords.length === 0}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 flex-shrink-0"
                            >
                                <span>Iniciar Quest</span>
                                <Icon name="arrow-right" size={18} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="prose prose-lg max-w-none leading-loose text-slate-700">
                    {/* Loading State */}
                    {isTokenizing && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Icon name="loader" size={48} className="text-emerald-600 animate-spin mb-4" />
                            <p className="text-slate-600 font-medium">Processando texto com IA...</p>
                            <p className="text-slate-400 text-sm mt-1">Identificando palavras para estudo</p>
                        </div>
                    )}

                    {/* Error State */}
                    {tokenError && !isTokenizing && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center mb-4">
                            <Icon name="alert-circle" size={24} className="text-red-500 mx-auto mb-2" />
                            <p className="text-red-700 font-medium">{tokenError}</p>
                        </div>
                    )}

                    {/* Tokens Display */}
                    {!isTokenizing && tokens.map((token, index) => {
                        const cleanToken = token.trim();
                        const validWord = isWord(cleanToken);
                        const isSelected = room.selectedWords.includes(cleanToken);

                        if (!validWord) {
                            return <span key={index} className="whitespace-pre-wrap">{token}</span>;
                        }

                        return (
                            <span
                                key={index}
                                onClick={() => handleWordClick(cleanToken)}
                                className={`
                                    cursor-pointer px-1 py-0.5 rounded transition-all duration-200 inline-block
                                    ${isSelected
                                        ? 'bg-amber-200 text-amber-900 font-semibold shadow-sm transform scale-105 border-b-2 border-amber-400'
                                        : 'hover:bg-slate-100 hover:text-emerald-700'}
                                `}
                            >
                                {token}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Sidebar Enigmas (Direita) */}
            <div className="w-full md:w-80 bg-slate-50 rounded-2xl p-4 shadow-inner border border-slate-200 flex flex-col">
                <div className="mb-4">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Icon name="book" size={18} />
                        Enigmas Selecionados ({uniqueSelectedWords.length})
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                    {uniqueSelectedWords.length === 0 ? (
                        <div className="text-center text-slate-400 py-8 italic">
                            Nenhuma palavra selecionada ainda...
                        </div>
                    ) : (
                        uniqueSelectedWords.map((word, idx) => (
                            <div
                                key={idx}
                                className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm flex justify-between items-center group animate-in slide-in-from-left-2"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-800">{word}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            speak(word, (room.config.sourceLang || 'zh') as 'zh' | 'de' | 'pt' | 'en');
                                        }}
                                        className="p-1 rounded-full text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                        title="Ouvir pronúncia"
                                    >
                                        <Icon name="volume-2" size={16} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => onToggleWord(word)}
                                    className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Remover"
                                >
                                    <Icon name="x" size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500 text-center">
                    Crie coletivamente a lista de palavras para a próxima fase.
                </div>
            </div>
        </div>
    );
};
