import React, { useState, useEffect, useRef } from 'react';
import Icon from '../Icon';

interface TutorialStep {
    targetId?: string;
    title: string;
    content: string;
    position: 'center' | 'bottom' | 'top' | 'left' | 'right';
}

interface TutorialMascotProps {
    onClose: () => void;
}

const steps: TutorialStep[] = [
    {
        title: "Bem-vindo! 👋",
        content: "Olá! Eu sou o seu guia. Em poucos passos vou te mostrar tudo o que o app faz para você aprender mandarim (ou qualquer idioma) lendo textos de verdade e memorizando de forma inteligente. Vamos lá!",
        position: 'center'
    },
    {
        targetId: 'nav-leitura',
        title: "📖 Leitura — o coração do app",
        content: "Cole ou importe um texto e leia. Toque em qualquer palavra para ver pinyin, tradução e ouvir a pronúncia — e salve-a com um clique. Ao salvar, a frase fica colorida automaticamente para fixar o que você aprendeu. Há ainda o Modo Simples (leitura limpa) onde você pode deixar comentários nas palavras e frases.",
        position: 'top'
    },
    {
        targetId: 'nav-revisao',
        title: "🔖 Revisão — suas palavras salvas",
        content: "Tudo o que você salvou aparece aqui. Use a 🔍 busca, filtre só as palavras que você errou e veja as “Pendentes” da revisão programada. Toque na ⭐ estrela para definir a frequência (repetição espaçada) e no 🎙️ microfone para gravar e comparar a sua pronúncia. Em “Selecionar” você gerencia idioma e exclui várias de uma vez.",
        position: 'top'
    },
    {
        targetId: 'nav-cards',
        title: "🃏 Cards de memorização",
        content: "Os Cards transformam suas palavras salvas em flashcards. Vire o card, diga se acertou e o app prioriza o que você ainda tem dificuldade — do jeitinho da curva do esquecimento.",
        position: 'top'
    },
    {
        targetId: 'nav-treino',
        title: "🎯 Treino (Pronúncia, Prática e Lab)",
        content: "Toque em “Treino” para abrir mais exercícios: Pronúncia (fale e receba feedback), Prática (escrita/digitação) e Lab (experimentos com IA). Todos focam nas palavras que você salvou e nos seus erros.",
        position: 'top'
    },
    {
        targetId: 'header-neural',
        title: "🧠 Mapa Neural",
        content: "Aqui você visualiza as conexões entre as suas palavras num mapa interativo (2D e 3D). É ótimo para enxergar relações de significado e descobrir vizinhos de uma palavra que você está estudando.",
        position: 'bottom'
    },
    {
        targetId: 'header-folders',
        title: "🗂️ Pastas",
        content: "Organize seus textos e palavras em pastas por aula, livro ou tema. Ao selecionar pastas, TODAS as abas (Leitura, Revisão, Cards, Treino) passam a focar só naquele conteúdo.",
        position: 'bottom'
    },
    {
        targetId: 'header-stats',
        title: "📊 Estatísticas e Sessão",
        content: "Acompanhe seu progresso: tempo de estudo, precisão, sequência de dias e suas palavras mais difíceis. O troféu da Sessão mostra um resumo do que você fez — e sua sessão vai sendo salva sozinha enquanto você navega entre as abas.",
        position: 'bottom'
    },
    {
        targetId: 'header-avatar',
        title: "👤 Conta, Áudio e Dados",
        content: "Entre com sua conta Google para guardar tudo na nuvem e estudar em qualquer lugar. Neste menu você também ativa o Áudio com IA (Puter / Whisper) e, em “Dados”, faz Backup na nuvem, exporta e importa todo o seu progresso.",
        position: 'bottom'
    },
    {
        title: "Tudo pronto! 🚀",
        content: "Agora é com você: importe um texto, salve suas primeiras palavras e volte aqui sempre que precisar (Menu → Tutorial / Dicas). Bons estudos!",
        position: 'center'
    }
];

export const TutorialMascot: React.FC<TutorialMascotProps> = ({ onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
    const mascotRef = useRef<HTMLDivElement>(null);

    const step = steps[currentStep];

    useEffect(() => {
        if (step.targetId) {
            const element = document.getElementById(step.targetId);
            if (element) {
                setHighlightRect(element.getBoundingClientRect());
                // Scroll para o elemento se necessário
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            setHighlightRect(null);
        }
    }, [currentStep, step.targetId]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = () => {
        localStorage.setItem('tutorial_seen', 'true');
        onClose();
    };

    // Renderiza o Mascote (SVG Simpático)
    const MascotSVG = () => (
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 animate-bounce-slow">
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
                {/* Corpo (Azul vibrante/Brand) */}
                <rect x="15" y="20" width="70" height="70" rx="30" fill="#4F46E5" />
                {/* Barriga branca */}
                <rect x="25" y="55" width="50" height="30" rx="20" fill="white" opacity="0.2" />
                {/* Olhos Expressionais */}
                <circle cx="35" cy="45" r="12" fill="white" />
                <circle cx="65" cy="45" r="12" fill="white" />
                <circle cx="35" cy="45" r="5" fill="#1E1B4B" />
                <circle cx="65" cy="45" r="5" fill="#1E1B4B" />
                {/* Bico/Sorriso */}
                <path d="M40 60 Q50 70 60 60" fill="none" stroke="#FBBF24" strokeWidth="5" strokeLinecap="round" />
                {/* Sobrancelhas fofas */}
                <path d="M25 30 Q35 25 45 32" fill="none" stroke="white" strokeWidth="3" opacity="0.8" />
                <path d="M55 32 Q65 25 75 30" fill="none" stroke="white" strokeWidth="3" opacity="0.8" />
            </svg>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden pointer-events-none">
            {/* Overlay Escuro com Máscara */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto transition-all duration-500"
                style={{
                    clipPath: highlightRect
                        ? `polygon(0% 0%, 0% 100%, ${highlightRect.left}px 100%, ${highlightRect.left}px ${highlightRect.top}px, ${highlightRect.right}px ${highlightRect.top}px, ${highlightRect.right}px ${highlightRect.bottom}px, ${highlightRect.left}px ${highlightRect.bottom}px, ${highlightRect.left}px 100%, 100% 100%, 100% 0%)`
                        : 'none'
                }}
            />

            {/* Container do Passo do Tutorial */}
            <div
                className={`
                    flex flex-col items-center gap-6 max-w-sm w-full transition-all duration-500 pointer-events-auto
                    ${step.position === 'center' ? 'relative' : 'absolute'}
                `}
                style={highlightRect ? {
                    top: step.position === 'bottom' ? `${highlightRect.bottom + 20}px` : 'auto',
                    bottom: step.position === 'top' ? `${window.innerHeight - highlightRect.top + 20}px` : 'auto',
                    left: '50%',
                    transform: 'translateX(-50%)'
                } : {}}
            >
                {/* Balão de Fala */}
                <div className="bg-white rounded-3xl p-6 shadow-2xl border-4 border-brand-500 relative animate-pop">
                    {/* Triângulo do balão */}
                    <div className={`
                        absolute w-6 h-6 bg-white border-r-4 border-b-4 border-brand-500 rotate-45 left-1/2 -translate-x-1/2
                        ${step.position === 'top' ? '-bottom-3 rotate-45' : '-top-3 -rotate-[135deg]'}
                        ${step.position === 'center' ? 'hidden' : ''}
                    `} />

                    <h3 className="text-xl font-black text-brand-700 mb-2">{step.title}</h3>
                    <p className="text-slate-600 font-medium leading-relaxed">{step.content}</p>

                    {/* Controles */}
                    <div className="flex items-center justify-between mt-6 gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-400 font-bold hover:text-slate-600 transition-colors text-sm"
                        >
                            Pular
                        </button>

                        <div className="flex items-center gap-2">
                            {currentStep > 0 && (
                                <button
                                    onClick={handleBack}
                                    className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                                >
                                    <Icon name="arrow-left" size={20} />
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className="px-6 py-2 bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all active:scale-95 flex items-center gap-2"
                            >
                                {currentStep === steps.length - 1 ? 'Começar!' : 'Próximo'}
                                <Icon name="chevron-right" size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* O Mascote */}
                <MascotSVG />
            </div>

            {/* Estilos Adicionais */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 3s ease-in-out infinite;
                }
                .animate-pop {
                    animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                @keyframes pop {
                    0% { transform: scale(0.8); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}} />
        </div>
    );
};

export default TutorialMascot;
