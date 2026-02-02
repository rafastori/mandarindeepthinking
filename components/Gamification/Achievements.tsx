import React from 'react';
import { Lock, Check } from 'lucide-react';
import { Achievement as AchievementType, InventoryItem } from '../../types';

interface AchievementsProps {
    achievements: AchievementType[];
    inventory: InventoryItem[];
}

// All possible achievements for display
const ALL_ACHIEVEMENTS: Omit<AchievementType, 'unlockedAt' | 'progress'>[] = [
    { id: 'first_correct', name: 'Primeira Vitória', description: 'Acerte 1 palavra', icon: '⭐', target: 1 },
    { id: 'streak_3', name: 'Fogo!', description: '3 dias seguidos', icon: '🔥', target: 3 },
    { id: 'streak_7', name: 'Imparável', description: '7 dias seguidos', icon: '⚡', target: 7 },
    { id: 'streak_30', name: 'Máquina', description: '30 dias seguidos', icon: '🏆', target: 30 },
    { id: 'correct_10', name: 'Aprendiz', description: 'Acerte 10 palavras', icon: '📖', target: 10 },
    { id: 'correct_50', name: 'Estudante', description: 'Acerte 50 palavras', icon: '🎓', target: 50 },
    { id: 'correct_100', name: 'Mestre', description: 'Acerte 100 palavras', icon: '🧠', target: 100 },
    { id: 'time_60', name: 'Dedicado', description: '1 hora de estudo', icon: '🕐', target: 3600 },
    { id: 'time_300', name: 'Maratonista', description: '5 horas de estudo', icon: '⏱️', target: 18000 },
];

const Achievements: React.FC<AchievementsProps> = ({ achievements, inventory }) => {
    const unlockedIds = new Set(achievements.filter(a => a.unlockedAt).map(a => a.id));

    return (
        <div className="space-y-6">
            {/* Achievements Section */}
            <div>
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                    🏆 Conquistas
                </h3>
                <div className="grid grid-cols-3 gap-2">
                    {ALL_ACHIEVEMENTS.map(ach => {
                        const isUnlocked = unlockedIds.has(ach.id);
                        const unlockedAch = achievements.find(a => a.id === ach.id);

                        return (
                            <div
                                key={ach.id}
                                className={`relative rounded-xl p-3 text-center transition-all ${isUnlocked
                                        ? 'bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30'
                                        : 'bg-white/5 border border-white/10 opacity-50'
                                    }`}
                            >
                                <div className={`text-3xl mb-1 ${isUnlocked ? '' : 'grayscale'}`}>
                                    {ach.icon}
                                </div>
                                <p className="text-xs text-white font-medium truncate">{ach.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{ach.description}</p>

                                {isUnlocked ? (
                                    <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                ) : (
                                    <div className="absolute top-1 right-1 w-4 h-4 bg-slate-600 rounded-full flex items-center justify-center">
                                        <Lock className="w-2 h-2 text-slate-400" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Inventory Section */}
            <div>
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                    🎒 Inventário
                </h3>
                {inventory.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                        {inventory.map(item => (
                            <div
                                key={item.id}
                                className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-3 text-center"
                            >
                                <div className="text-3xl mb-1">{item.icon}</div>
                                <p className="text-xs text-white font-medium truncate">{item.name}</p>
                                <p className="text-[10px] text-slate-400">{item.type}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white/5 rounded-xl p-6 text-center text-slate-400">
                        <p className="text-sm">Nenhum item ainda.</p>
                        <p className="text-xs mt-1">Continue estudando para ganhar recompensas!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Achievements;
