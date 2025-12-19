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
    // Novas props para Puter
    isPuterConnected: boolean;
    isPuterEnabled: boolean;
    puterUsername: string | null;
    onConnectPuter: () => void;
    onDisconnectPuter: () => void;
    onTogglePuter: () => void;
}

const Header: React.FC<HeaderProps> = ({
    user,
    onLogin,
    onLogout,
    onOpenStats,
    onResetAccount,
    isPuterConnected,
    isPuterEnabled,
    puterUsername,
    onConnectPuter,
    onDisconnectPuter,
    onTogglePuter
}) => {
    const [showPuterMenu, setShowPuterMenu] = React.useState(false);
    const puterMenuRef = React.useRef<HTMLDivElement>(null);

    // Fecha menu ao clicar fora
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (puterMenuRef.current && !puterMenuRef.current.contains(event.target as Node)) {
                setShowPuterMenu(false);
            }
        };
        if (showPuterMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPuterMenu]);

    const handlePuterAction = (action: () => void) => {
        action();
        setShowPuterMenu(false);
    };

    return (
        <header className="bg-brand-700 text-white px-4 py-3 flex justify-between items-center shadow-md flex-shrink-0 z-20">
            <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain rounded-lg shadow-sm" />
                <h1 className="text-lg font-bold tracking-tight">MemorizaTudo</h1>
            </div>

            <div className="flex items-center gap-3">
                {/* Indicador de Áudio IA - Interativo */}
                <div className="relative" ref={puterMenuRef}>
                    <button
                        onClick={() => setShowPuterMenu(!showPuterMenu)}
                        className={`p-2 rounded-full transition-all active:scale-90 ${isPuterConnected
                            ? isPuterEnabled ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-500/50 text-slate-300'
                            : 'bg-white/20 text-white/70 hover:bg-white/30'
                            }`}
                        title={isPuterConnected ? `Puter: ${puterUsername} (${isPuterEnabled ? 'Ativo' : 'Desativado'})` : 'Conectar Puter (Áudio IA)'}
                    >
                        <Icon name={isPuterConnected && isPuterEnabled ? "zap" : "volume-2"} size={18} />
                    </button>

                    {showPuterMenu && (
                        <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 flex gap-1 z-50 animate-pop min-w-max">
                            {!isPuterConnected ? (
                                <button
                                    onClick={() => handlePuterAction(onConnectPuter)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2 transition-colors"
                                    title="Logar no Puter"
                                >
                                    <Icon name="log-in" size={18} />
                                    <span className="text-xs font-bold pr-1">Logar Puter</span>
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => handlePuterAction(onTogglePuter)}
                                        className={`p-2 rounded-lg transition-colors ${isPuterEnabled ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                        title={isPuterEnabled ? 'Desativar Áudio IA' : 'Ativar Áudio IA'}
                                    >
                                        <Icon name={isPuterEnabled ? "power" : "zap"} size={18} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (window.confirm("Deseja sair da conta Puter?")) {
                                                handlePuterAction(onDisconnectPuter);
                                            }
                                        }}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Sair do Puter"
                                    >
                                        <Icon name="log-out" size={18} />
                                    </button>
                                    <div className="w-px bg-slate-100 mx-0.5" />
                                    <button
                                        onClick={() => setShowPuterMenu(false)}
                                        className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Voltar"
                                    >
                                        <Icon name="x" size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

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