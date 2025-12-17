
import React, { useMemo } from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom, PolyQuestPlayer, GAME_CONSTANTS } from '../types';

interface ExplorationPhaseProps {
    room: PolyQuestRoom;
    currentUserId: string;
    onToggleWord: (word: string) => void;
    onFinishExploration: () => void;
}

export const ExplorationPhase: React.FC<ExplorationPhaseProps> = ({
    room,
    currentUserId,
    onToggleWord,
    onFinishExploration,
}) => {
    const isHost = room.hostId === currentUserId;

    // Simples tokenização mantendo pontuação e espaços para reconstrução visual
    // Separa por espaços mas mantém pontuação acoplada por enquanto, ou melhor:
    // Uma regex que captura palavras e não-palavras
    const tokens = useMemo(() => {
        // Match sequence of alphanumeric characters OR non-alphanumeric (punctuation/spaces)
        // Isso é simplificado. Para línguas como chinês precisaria de segmentador específico, 
        // mas vamos assumir separação por espaço/pontuação para línguas ocidentais por enquanto.
        // Para o MVP (alemão -> português), split por espaço é o 'ok' inicial, 
        // mas melhor usar regex para isolar pontuação se possível

        const text = room.config.originalText;
        // Regex: (palavras) ou (espaços/pontuação)
        // \w+ pega palavras alpha-numericas (incluindo underline, mas ok)
        // Em unicode (para acentos) precisa de flag u ou range específico
        // Vamos tentar algo mais robusto para pt/de
        return text.split(/(\s+|[.,!?;:()])/).filter(t => t.length > 0);
    }, [room.config.originalText]);

    const isWord = (token: string) => {
        // Verifica se tem pelo menos uma letra, ignorando pontuação pura
        return /[a-zA-Z\u00C0-\u00FF]/.test(token);
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
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Icon name="search" className="text-emerald-600" />
                            Fase 1: Exploração
                        </h2>
                        <p className="text-slate-500">
                            Clique nas palavras que você <span className="font-bold text-slate-700">não conhece</span> ou que parecem importantes.
                        </p>
                    </div>
                    {isHost && (
                        <button
                            onClick={onFinishExploration}
                            disabled={uniqueSelectedWords.length === 0}
                            className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            <span>Iniciar Quest</span>
                            <Icon name="arrow-right" size={20} />
                        </button>
                    )}
                </div>

                <div className="prose prose-lg max-w-none leading-loose text-slate-700">
                    {tokens.map((token, index) => {
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
                                <span className="font-semibold text-slate-800">{word}</span>
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
