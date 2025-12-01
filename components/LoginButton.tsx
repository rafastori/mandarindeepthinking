import React from 'react';
import { User } from 'firebase/auth';
import Icon from './Icon';

interface LoginButtonProps {
    user: User | null;
    onLogin: () => void;
    onLogout: () => void;
}

export const LoginButton: React.FC<LoginButtonProps> = ({ user, onLogin, onLogout }) => {
  // --- LOGADO ---
  if (user) {
    return (
      <div className="flex items-center gap-2 bg-white/10 p-1 pr-2 rounded-full border border-white/20 backdrop-blur-sm">
        {/* Avatar */}
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

        {/* Nome (Apenas Desktop) */}
        <div className="hidden sm:flex flex-col mr-2">
          <span className="text-[10px] text-brand-100 uppercase font-bold leading-none">Olá</span>
          <span className="text-xs font-bold text-white leading-none">{user.displayName?.split(' ')[0]}</span>
        </div>

        {/* Botão Sair */}
        <button 
            onClick={onLogout} 
            className="text-white/70 hover:text-red-300 transition-colors p-1"
            title="Sair"
        >
            <Icon name="log-out" size={18} />
        </button>
      </div>
    );
  }

  // --- DESLOGADO ---
  return (
    <button
      onClick={onLogin}
      className="flex items-center gap-2 bg-white text-slate-700 hover:bg-slate-50 font-medium shadow-sm transition-all rounded-full p-1.5 sm:px-4 sm:py-2 active:scale-95"
      title="Entrar com Google"
    >
      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="G" />
      <span className="hidden sm:block text-sm">Entrar com Google</span>
    </button>
  );
};