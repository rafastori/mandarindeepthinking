import React from 'react';
import Icon from '../../../components/Icon';
import { PolyQuestRoom } from '../types';

interface IntruderChallengeProps {
    room: PolyQuestRoom;
    currentUserId: string;
    onResolveIntruder: (selectedWord: string) => void;
}

export const IntruderChallenge: React.FC<IntruderChallengeProps> = ({ room, currentUserId, onResolveIntruder }) => {

    // Simplificação: Pegar as palavras originais e inserir intruso numa posição aleatória
    // Em produção, isso seria persistido no banco para garantir ordem igual. 
    // Para protótipo, vamos inserir cosmeticamente se não formos "muito rigorosos" com sync visual de posição

    // Melhor abordagem com o que temos:
    // O texto original está em room.config.originalText ou em room.originalText (precisamos checar types).
    // Supondo room.config.originalText (string).

    const originalText = room.config.originalText;
    const intruderWord = room.intruderWord || "INTRUSO";

    // Split simples
    const words = originalText.split(/\s+/);

    // Inserção Aleatória Determinística (Baseada no tamanho para ser "fixa" sem salvar index)
    // Para simplificar: Vamos inserir no meio
    const insertIndex = Math.floor(words.length / 2);

    // Criamos uma lista de exibição com metadados
    const displayWords = [
        ...words.slice(0, insertIndex),
        intruderWord,
        ...words.slice(insertIndex)
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/95 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in border-4 border-red-500">

                {/* Header do Evento */}
                <div className="bg-red-600 p-6 text-white text-center">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <Icon name="alert-triangle" size={32} className="text-yellow-300 animate-pulse" />
                        <h2 className="text-3xl font-black uppercase tracking-wider">Desafio do Intruso</h2>
                        <Icon name="alert-triangle" size={32} className="text-yellow-300 animate-pulse" />
                    </div>
                    <p className="text-red-100 font-medium text-lg">
                        A IA sabotou o texto histórico! Encontre a palavra que não pertence a esta época ou contexto.
                    </p>
                </div>

                {/* Área de Caça */}
                <div className="p-8">
                    <div className="flex flex-wrap gap-2 text-lg leading-loose justify-center">
                        {displayWords.map((word, index) => {
                            // Limpar pontuação para comparação justa
                            const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

                            return (
                                <button
                                    key={index}
                                    onClick={() => onResolveIntruder(cleanWord)}
                                    className="
                                        px-2 py-1 rounded hover:bg-red-100 hover:text-red-700 hover:scale-110 
                                        transition-all cursor-pointer border border-transparent hover:border-red-300
                                    "
                                >
                                    {word}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-100 p-4 text-center border-t border-slate-200">
                    <p className="text-sm text-slate-600">
                        Clique na palavra suspeita para denunciar.
                        Recompensa: <span className="font-bold text-emerald-600">+20 Pontos</span> + Vida Extra.
                    </p>
                </div>
            </div>
        </div>
    );
};
