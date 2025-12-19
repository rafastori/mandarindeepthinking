import React, { useState } from 'react';
import Icon from './Icon';

interface NavigationProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // 1. Itens que SEMPRE aparecem na barra (Principais)
    const mainTabs = [
        { id: 'leitura', icon: 'book-open', label: 'Leitura' },
        { id: 'revisao', icon: 'list', label: 'Revisão' },
        { id: 'cards', icon: 'layers', label: 'Cards' },
    ];

    // 2. Itens que ficam no MENU "Treino" (Secundários) - SEM jogo que agora é destaque
    const trainingTabs = [
        { id: 'pratica', icon: 'edit-3', label: 'Prática' },
        { id: 'lab', icon: 'flask-conical', label: 'Lab' },
        { id: 'criativo', icon: 'sparkles', label: 'Criativo' },
    ];

    // Verifica se alguma aba do menu está ativa para pintar o botão de "Mais"
    const isMoreActive = trainingTabs.some(t => t.id === activeTab);

    const handleMainClick = (id: string) => {
        setIsMenuOpen(false);
        onTabChange(id);
    };

    const handleMenuClick = (id: string) => {
        setIsMenuOpen(false);
        onTabChange(id);
    };

    return (
        <>
            {/* Fundo escuro para fechar o menu ao clicar fora */}
            {isMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}

            {/* O Menu Flutuante */}
            <div className={`
                fixed bottom-20 right-4 z-50 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 w-48
                transition-all duration-200 origin-bottom-right
                ${isMenuOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none translate-y-4'}
            `}>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 py-2">Área de Treino</p>
                <div className="grid grid-cols-1 gap-1">
                    {trainingTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => handleMenuClick(tab.id)}
                            className={`
                                flex items-center gap-3 p-3 rounded-xl transition-colors text-left w-full
                                ${activeTab === tab.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50 text-slate-600'}
                            `}
                        >
                            <Icon name={tab.icon} size={20} className={activeTab === tab.id ? "text-brand-600" : "text-slate-400"} />
                            <span className="text-sm font-medium">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* A Barra Principal */}
            <nav className="bg-white border-t border-slate-200 px-2 pb-safe pt-2 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.03)] flex-shrink-0 z-50 relative">
                <div className="flex justify-around items-center">
                    {/* Renderiza abas principais */}
                    {mainTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => handleMainClick(tab.id)}
                            className={`flex flex-col items-center p-2 rounded-xl transition-all min-w-[64px] ${activeTab === tab.id
                                    ? 'text-brand-600 -translate-y-1'
                                    : 'text-slate-400 active:bg-slate-50'
                                }`}
                        >
                            <Icon
                                name={tab.icon}
                                size={24}
                                className={`mb-1 transition-transform ${activeTab === tab.id ? 'scale-110' : ''}`}
                                fill={activeTab === tab.id ? "currentColor" : "none"}
                            />
                            <span className="text-[10px] font-bold tracking-wide">{tab.label}</span>
                        </button>
                    ))}

                    {/* Botão "Jogo" com DESTAQUE colorido */}
                    <button
                        onClick={() => handleMainClick('jogo')}
                        className={`flex flex-col items-center p-2 rounded-xl transition-all min-w-[64px] ${activeTab === 'jogo'
                                ? '-translate-y-1'
                                : 'active:bg-slate-50'
                            }`}
                    >
                        <div className={`p-2 rounded-xl transition-all ${activeTab === 'jogo'
                                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-200 scale-110'
                                : 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                            }`}>
                            <Icon
                                name="gamepad-2"
                                size={20}
                                className="text-white"
                            />
                        </div>
                        <span className={`text-[10px] font-bold tracking-wide mt-1 ${activeTab === 'jogo' ? 'text-emerald-600' : 'text-slate-500'
                            }`}>Jogo</span>
                    </button>

                    {/* Botão "Treino" (Mais) */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`flex flex-col items-center p-2 rounded-xl transition-all min-w-[64px] ${isMoreActive || isMenuOpen
                                ? 'text-brand-600'
                                : 'text-slate-400 active:bg-slate-50'
                            }`}
                    >
                        <div className={`p-1 rounded-full transition-all ${isMenuOpen ? 'bg-brand-100 rotate-45' : ''}`}>
                            {/* Ícone de Grid ou Plus para indicar "Mais" */}
                            <Icon
                                name="plus"
                                size={24}
                                className={`transition-transform`}
                            />
                        </div>
                        <span className="text-[10px] font-bold tracking-wide mt-1">Treino</span>
                    </button>
                </div>
            </nav>
        </>
    );
};

export default Navigation;