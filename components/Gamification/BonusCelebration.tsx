import React, { useEffect, useState } from 'react';
import { Zap, Star, Trophy, Sparkles, X } from 'lucide-react';

export type BonusType = 'streak10' | 'streak30' | null;

interface BonusCelebrationProps {
    bonusType: BonusType;
    bonusPoints: number;
    onClose: () => void;
}

const BonusCelebration: React.FC<BonusCelebrationProps> = ({ bonusType, bonusPoints, onClose }) => {
    const [confetti, setConfetti] = useState<Array<{ id: number; left: number; delay: number; color: string; size: number }>>([]);
    const [showContent, setShowContent] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (!bonusType) return;

        // Generate confetti particles
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#F472B6', '#34D399', '#FCD34D'];
        const particles = Array.from({ length: 60 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 0.5,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 8 + 4,
        }));
        setConfetti(particles);

        // Animate content in
        setTimeout(() => setShowContent(true), 200);

        // Auto-close after 3 seconds
        const timer = setTimeout(() => handleClose(), 3500);
        return () => clearTimeout(timer);
    }, [bonusType]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    };

    if (!bonusType) return null;

    const isStreak30 = bonusType === 'streak30';

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
            onClick={handleClose}
        >
            {/* Dark overlay with radial glow */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Radial glow effect */}
            <div className={`absolute inset-0 opacity-60 ${isStreak30 ? 'bg-gradient-radial from-amber-500/40 via-transparent to-transparent' : 'bg-gradient-radial from-purple-500/40 via-transparent to-transparent'}`}
                style={{ background: `radial-gradient(circle at center, ${isStreak30 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(139, 92, 246, 0.4)'} 0%, transparent 50%)` }}
            />

            {/* Confetti */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {confetti.map((particle) => (
                    <div
                        key={particle.id}
                        className="absolute animate-confetti-fall"
                        style={{
                            left: `${particle.left}%`,
                            top: '-20px',
                            animationDelay: `${particle.delay}s`,
                            width: `${particle.size}px`,
                            height: `${particle.size}px`,
                            backgroundColor: particle.color,
                            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                            transform: `rotate(${Math.random() * 360}deg)`,
                        }}
                    />
                ))}
            </div>

            {/* Main celebration card */}
            <div
                className={`relative z-10 transform transition-all duration-500 ${showContent ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Glowing ring effect */}
                <div className={`absolute -inset-4 rounded-full blur-xl animate-pulse ${isStreak30 ? 'bg-amber-500/50' : 'bg-purple-500/50'}`} />

                <div className={`relative bg-gradient-to-br ${isStreak30 ? 'from-amber-500 via-orange-500 to-red-500' : 'from-violet-500 via-purple-500 to-fuchsia-500'} rounded-3xl p-1 shadow-2xl`}>
                    <div className="bg-slate-900/90 backdrop-blur-xl rounded-[22px] p-6 text-center min-w-[280px]">
                        {/* Close button */}
                        <button
                            onClick={handleClose}
                            className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Icon with animation */}
                        <div className={`relative mx-auto mb-4 w-20 h-20 rounded-full flex items-center justify-center animate-bounce-slow ${isStreak30 ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-violet-400 to-purple-500'}`}>
                            <div className="absolute inset-0 rounded-full animate-ping opacity-30"
                                style={{ backgroundColor: isStreak30 ? '#F59E0B' : '#8B5CF6' }}
                            />
                            {isStreak30 ? (
                                <Trophy className="w-10 h-10 text-white drop-shadow-lg" />
                            ) : (
                                <Zap className="w-10 h-10 text-white fill-current drop-shadow-lg" />
                            )}
                        </div>

                        {/* Sparkles decoration */}
                        <div className="absolute top-8 left-8 animate-spin-slow">
                            <Sparkles className="w-6 h-6 text-yellow-400" />
                        </div>
                        <div className="absolute top-12 right-10 animate-spin-slow" style={{ animationDelay: '0.5s' }}>
                            <Star className="w-5 h-5 text-pink-400 fill-current" />
                        </div>

                        {/* Title */}
                        <h2 className={`text-2xl font-black mb-2 bg-gradient-to-r ${isStreak30 ? 'from-amber-300 via-yellow-200 to-amber-300' : 'from-violet-300 via-pink-200 to-violet-300'} bg-clip-text text-transparent animate-pulse`}>
                            {isStreak30 ? '🔥 INCRÍVEL! 🔥' : '⚡ COMBO! ⚡'}
                        </h2>

                        {/* Subtitle */}
                        <p className="text-white/90 text-lg font-semibold mb-3">
                            {isStreak30 ? '30 Acertos Seguidos!' : '10 Acertos Seguidos!'}
                        </p>

                        {/* Bonus points */}
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${isStreak30 ? 'bg-amber-500/20 border border-amber-400/50' : 'bg-purple-500/20 border border-purple-400/50'}`}>
                            <Star className={`w-5 h-5 fill-current ${isStreak30 ? 'text-amber-400' : 'text-purple-400'}`} />
                            <span className={`text-xl font-bold ${isStreak30 ? 'text-amber-300' : 'text-purple-300'}`}>
                                +{bonusPoints} pts
                            </span>
                        </div>

                        {/* Motivational message */}
                        <p className="text-white/60 text-sm mt-3">
                            {isStreak30 ? 'Você é uma máquina! Continue assim!' : 'Você está pegando fogo! 🔥'}
                        </p>
                    </div>
                </div>
            </div>

            {/* CSS for confetti animation */}
            <style>{`
                @keyframes confetti-fall {
                    0% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) rotate(720deg);
                        opacity: 0;
                    }
                }
                .animate-confetti-fall {
                    animation: confetti-fall 3s ease-out forwards;
                }
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 1s ease-in-out infinite;
                }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 3s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default BonusCelebration;
