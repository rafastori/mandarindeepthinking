import React from 'react';
import Icon from './Icon';
import { LoginButton } from './LoginButton';
import { User } from 'firebase/auth';

interface HeaderProps {
    user: User | null;
    onLogin: () => void;
    onLogout: () => void;
    onOpenStats: () => void;
    onOpenPronounce: () => void;
    onResetAccount: () => void; // <--- NOVA PROP
}

const Header: React.FC<HeaderProps> = ({ 
    user, 
    onLogin, 
    onLogout, 
    onOpenStats, 
    onOpenPronounce,
    onResetAccount // <--- Recebendo a função
}) => {
    return (
        <header className="bg-brand-700 text-white px-4 py-3 flex justify-between items-center shadow-md flex-shrink-0 z-20">
            <div className="flex items-center gap-2">
                <Icon name="brain-circuit" size={24} className="text-white" />
                <h1 className="text-lg font-bold tracking-tight">MemorizaTudo</h1>
            </div>
            
            <div className="flex items-center gap-3">
                <button onClick={onOpenPronounce} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors mr-1">
                    <Icon name="mic" size={18} />
                </button>
                <button onClick={onOpenStats} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors">
                    <Icon name="bar-chart-2" size={18} />
                </button>
                
                {/* Botão de Reset (Só aparece se logado) */}
                {user && (
                    <button 
                        onClick={onResetAccount} 
                        className="bg-red-500/20 p-2 rounded-full hover:bg-red-500 hover:text-white text-red-200 transition-colors"
                        title="Resetar Banco de Dados"
                    >
                        <Icon name="trash-2" size={18} />
                    </button>
                )}

                <div className="bg-white/20 px-2 py-1 rounded text-xs font-medium backdrop-blur-sm hidden sm:block">Deep Thinking</div>
                <LoginButton user={user} onLogin={onLogin} onLogout={onLogout} />
            </div>
        </header>
    );
};

export default Header;