import React from 'react';
import Icon from './Icon';
import { UserMenuDropdown } from './UserMenuDropdown';
import { User } from 'firebase/auth';

interface HeaderProps {
    user: User | null;
    onLogin: () => void;
    onLogout: () => void;
    onOpenStats: () => void;
    onResetAccount: () => void;
    // Props para Puter
    isPuterConnected: boolean;
    puterUsername: string | null;
    onConnectPuter: () => void;
    onDisconnectPuter: () => void;
    // Props para Export/Import
    onExportData: () => void;
    onImportData: (file: File, mode: 'merge' | 'replace') => Promise<{ success: boolean; count: number; error?: string }>;
}

const Header: React.FC<HeaderProps> = ({
    user,
    onLogin,
    onLogout,
    onOpenStats,
    onResetAccount,
    isPuterConnected,
    puterUsername,
    onConnectPuter,
    onDisconnectPuter,
    onExportData,
    onImportData
}) => {
    return (
        <header className="bg-brand-700 text-white px-4 py-3 flex justify-between items-center shadow-md flex-shrink-0 z-20">
            <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain rounded-lg shadow-sm" />
                <h1 className="text-lg font-bold tracking-tight">MemorizaTudo</h1>
            </div>

            <div className="flex items-center gap-3">

                <button onClick={onOpenStats} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors">
                    <Icon name="bar-chart-2" size={18} />
                </button>


                {/* Área de usuário */}
                {user ? (
                    <UserMenuDropdown
                        user={user}
                        isPuterConnected={isPuterConnected}
                        puterUsername={puterUsername}
                        onLogout={onLogout}
                        onConnectPuter={onConnectPuter}
                        onResetAccount={onResetAccount}
                        onDisconnectPuter={onDisconnectPuter}
                        onExportData={onExportData}
                        onImportData={onImportData}
                    />
                ) : (
                    <button
                        onClick={onLogin}
                        className="flex items-center gap-2 bg-white text-slate-700 hover:bg-slate-50 font-medium shadow-sm transition-all rounded-full p-1.5 sm:px-4 sm:py-2 active:scale-95"
                        title="Entrar com Google"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="G" />
                        <span className="hidden sm:block text-sm">Entrar com Google</span>
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
