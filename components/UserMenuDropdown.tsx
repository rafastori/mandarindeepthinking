import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import Icon from './Icon';

interface UserMenuDropdownProps {
    user: User;
    isPuterConnected: boolean;
    puterUsername: string | null;
    onLogout: () => void;
    onConnectPuter: () => void;
    onResetAccount: () => void;
}

/**
 * Menu dropdown exibido ao clicar no avatar do usuário
 * Contém opções: Conectar Puter, Limpar Dados, Sair
 */
export const UserMenuDropdown: React.FC<UserMenuDropdownProps> = ({
    user,
    isPuterConnected,
    puterUsername,
    onLogout,
    onConnectPuter,
    onResetAccount
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Fecha o menu ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleAction = (action: () => void) => {
        setIsOpen(false);
        action();
    };

    return (
        <div className="relative" ref={menuRef}>
            {/* Avatar clicável */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-white/10 p-1 rounded-full border border-white/20 backdrop-blur-sm hover:bg-white/20 transition-all"
                title="Menu do usuário"
            >
                {user.photoURL ? (
                    <img
                        src={user.photoURL}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full border-2 border-brand-200"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-800 flex items-center justify-center text-white">
                        <Icon name="user" size={16} />
                    </div>
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-pop">
                    {/* Header do menu */}
                    <div className="p-4 bg-slate-50 border-b border-slate-100">
                        <p className="text-xs text-slate-500 uppercase font-bold">Olá</p>
                        <p className="text-sm font-bold text-slate-800 truncate">{user.displayName || user.email}</p>
                        {isPuterConnected && puterUsername && (
                            <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                <Icon name="zap" size={12} />
                                Puter: {puterUsername}
                            </p>
                        )}
                    </div>

                    {/* Opções */}
                    <div className="p-2">
                        {/* Conectar ao Puter */}
                        {!isPuterConnected ? (
                            <button
                                onClick={() => handleAction(onConnectPuter)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors"
                            >
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Icon name="volume-2" size={16} className="text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Conectar ao Puter</p>
                                    <p className="text-xs text-slate-500">Áudio com IA</p>
                                </div>
                            </button>
                        ) : (
                            <div className="flex items-center gap-3 px-3 py-2.5 text-slate-500">
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <Icon name="check" size={16} className="text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-green-700">Puter Conectado</p>
                                    <p className="text-xs text-slate-500">Áudio IA ativo</p>
                                </div>
                            </div>
                        )}

                        <div className="h-px bg-slate-100 my-2" />

                        {/* Limpar Dados */}
                        <button
                            onClick={() => handleAction(onResetAccount)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-red-50 text-slate-700 hover:text-red-700 transition-colors"
                        >
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                                <Icon name="trash-2" size={16} className="text-slate-500" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Limpar Dados</p>
                                <p className="text-xs text-slate-500">Resetar progresso</p>
                            </div>
                        </button>

                        <div className="h-px bg-slate-100 my-2" />

                        {/* Sair */}
                        <button
                            onClick={() => handleAction(onLogout)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
                        >
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                                <Icon name="log-out" size={16} className="text-slate-500" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Sair da Conta</p>
                                <p className="text-xs text-slate-500">Desconectar do Google</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserMenuDropdown;
