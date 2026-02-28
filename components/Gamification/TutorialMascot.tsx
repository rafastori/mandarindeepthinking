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
        title: "Bem-vindo!",
        content: "Olá! Eu sou o seu guia. Vou te mostrar como aproveitar o app ao máximo para aprender mandarim (ou qualquer idioma) de um jeito divertido!",
        position: 'center'
    },
    {
        targetId: 'nav-leitura',
        title: "Aba de Leitura",
        content: "Aqui é onde a mágica acontece! Leia textos interessantes e, se encontrar uma palavra que não conhece, basta clicar nela para ver a tradução e salvá-la!",
        position: 'top'
    },
    {
        targetId: 'nav-revisao',
        title: "Hora de Praticar",
        content: "As abas Revisão, Cards e Prática usam as palavras que você salvou. O app foca nas suas dificuldades para você nunca mais esquecer!",
        position: 'top'
    },
    {
        targetId: 'nav-jogo',
        title: "Diversão e Jogos",
        content: "Quer dar um tempo nos estudos sérios? No botão de Jogo, você encontra minigames para testar seu vocabulário de forma competitiva!",
        position: 'top'
    },
    {
        targetId: 'header-avatar',
        title: "Sincronize seu Progresso",
        content: "Não esqueça de clicar aqui para entrar com sua conta Google. Assim seus dados ficam salvos na nuvem e você pode estudar em qualquer lugar!",
        position: 'bottom'
    },
    {
        title: "Tudo Pronto!",
        content: "Agora é com você! Explore as abas, salve suas primeiras palavras e comece sua jornada. Bons estudos!",
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
