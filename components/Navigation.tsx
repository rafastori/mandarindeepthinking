import React from 'react';
import Icon from './Icon';

interface NavBtnProps {
    id: string;
    label: string;
    icon: string;
    isActive: boolean;
    setTab: (id: string) => void;
    highlight?: boolean;
}

const NavBtn: React.FC<NavBtnProps> = ({ id, label, icon, isActive, setTab, highlight }) => {
    return (
        <button onClick={() => setTab(id)} className={`flex flex-col items-center justify-center w-full h-full pt-2 pb-2 transition-all ${isActive ? 'text-brand-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <div className={`mb-1 p-1 rounded-xl transition-all duration-300 ${isActive ? 'bg-brand-100 px-4' : ''} ${!isActive && highlight ? 'text-brand-500' : ''}`}>
                <Icon name={icon} size={20} className={isActive ? "stroke-[2.5]" : "stroke-2"} />
            </div>
            <span className="text-[10px] font-bold tracking-wide">{label}</span>
        </button>
    );
};

interface NavigationProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
    return (
        <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 shadow-[0_-5px_20px_rgba(0,0,0,0.03)] z-50 h-[70px] flex justify-around items-center pb-safe">
            <NavBtn id="leitura" label="Leitura" icon="book-open" isActive={activeTab === 'leitura'} setTab={onTabChange} />
            <NavBtn id="revisao" label="Revisão" icon="list" isActive={activeTab === 'revisao'} setTab={onTabChange} />
            <NavBtn id="pratica" label="Prática" icon="pen-tool" isActive={activeTab === 'pratica'} setTab={onTabChange} />
            <NavBtn id="jogo" label="Jogo" icon="gamepad-2" isActive={activeTab === 'jogo'} setTab={onTabChange} />
            <NavBtn id="lab" label="Lab" icon="flask-conical" isActive={activeTab === 'lab'} setTab={onTabChange} highlight />
            <NavBtn id="cards" label="Cards" icon="layers" isActive={activeTab === 'cards'} setTab={onTabChange} />
        </nav>
    );
};

export default Navigation;