import React, { useState } from 'react';
import Icon from '../components/Icon';

// Importando os Jogos
// Importante: Verifique se o 'index' dentro de LingoArena tem um 'export default' ou 'export const'
import LingoArena from './LingoArena'; 
import PolyQuest from './PolyQuest';

const GamesHub: React.FC = () => {
  const [activeGame, setActiveGame] = useState<'menu' | 'lingo' | 'poly'>('menu');

  // Renderiza o Jogo 1: LingoArena (Antigo)
  if (activeGame === 'lingo') {
    // Passamos uma prop onBack caso o jogo suporte botão de voltar
    // Se o seu componente antigo não aceita props, você terá que adicionar um botão de voltar dentro dele depois
    return (
        <div className="h-full w-full">
            <button 
                onClick={() => setActiveGame('menu')} 
                className="fixed top-4 left-4 z-50 bg-white/80 p-2 rounded-full shadow-md hover:bg-white transition-all"
                title="Sair do Jogo"
            >
                <Icon name="arrow-left" size={20} className="text-slate-600" />
            </button>
            {/* @ts-ignore - Ignoramos erro de tipagem caso o LingoArena ainda não aceite props */}
            <LingoArena />
        </div>
    );
  }

  // Renderiza o Jogo 2: PolyQuest (Novo)
  if (activeGame === 'poly') {
    return <PolyQuest onBack={() => setActiveGame('menu')} />;
  }

  // Renderiza o Menu (Hub)
  return (
    <div className="p-6 max-w-4xl mx-auto min-h-[80vh] flex flex-col justify-center">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 mb-3">
            Arcade de Línguas
        </h1>
        <p className="text-slate-500 text-lg">Escolha sua arena de aprendizado</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card LingoArena */}
        <button 
          onClick={() => setActiveGame('lingo')}
          className="group relative overflow-hidden bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:border-emerald-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
            <Icon name="grid" size={100} className="text-emerald-600" />
          </div>
          
          <div className="relative z-10">
            <div className="bg-emerald-100 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
              <Icon name="grid" size={28} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-emerald-700 transition-colors">
              LingoArena
            </h3>
            <p className="text-slate-500 leading-relaxed group-hover:text-slate-600">
              O clássico jogo de memória e vocabulário. Conecte palavras e significados.
            </p>
          </div>
        </button>

        {/* Card PolyQuest */}
        <button 
          onClick={() => setActiveGame('poly')}
          className="group relative overflow-hidden bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:border-indigo-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
             <Icon name="users" size={100} className="text-indigo-600" />
          </div>
          
          <div className="relative z-10">
             <div className="flex justify-between items-start mb-6">
                <div className="bg-indigo-100 w-14 h-14 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                  <Icon name="users" size={28} />
                </div>
                <span className="bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-indigo-200 shadow-lg">
                  Novo
                </span>
             </div>
            
            <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-indigo-700 transition-colors">
              PolyQuest
            </h3>
            <p className="text-slate-500 leading-relaxed group-hover:text-slate-600">
              A nova aventura multiplayer. Desafie amigos e conquiste o ranking.
            </p>
          </div>
        </button>

      </div>
    </div>
  );
};

export default GamesHub;