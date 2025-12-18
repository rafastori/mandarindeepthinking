import React from 'react';
import Icon from './Icon';

interface PuterSuggestionModalProps {
    onConnect: () => void;
    onDismiss: () => void;
}

/**
 * Modal que sugere ao usuário criar uma conta Puter para melhorar o áudio
 * Exibido após o primeiro login com Google
 */
export const PuterSuggestionModal: React.FC<PuterSuggestionModalProps> = ({ onConnect, onDismiss }) => {
    return (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-pop">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
                {/* Header com gradiente */}
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 text-white text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <Icon name="volume-2" size={32} className="text-white" />
                    </div>
                    <h2 className="text-xl font-bold mb-1">Melhore seu Áudio com IA!</h2>
                    <p className="text-blue-100 text-sm">Vozes naturais para melhor aprendizado</p>
                </div>

                {/* Conteúdo */}
                <div className="p-6">
                    <p className="text-slate-600 text-sm mb-4">
                        Conecte-se ao <span className="font-bold text-slate-800">Puter</span> para ter acesso a vozes de alta qualidade geradas por Inteligência Artificial.
                    </p>

                    <ul className="space-y-3 mb-6">
                        <li className="flex items-center gap-3 text-sm text-slate-700">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Icon name="check" size={14} className="text-green-600" />
                            </div>
                            <span>Rápido e <span className="font-semibold">gratuito</span></span>
                        </li>
                        <li className="flex items-center gap-3 text-sm text-slate-700">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Icon name="check" size={14} className="text-green-600" />
                            </div>
                            <span>Vozes naturais em <span className="font-semibold">vários idiomas</span></span>
                        </li>
                        <li className="flex items-center gap-3 text-sm text-slate-700">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Icon name="check" size={14} className="text-green-600" />
                            </div>
                            <span>Melhor <span className="font-semibold">pronúncia e entonação</span></span>
                        </li>
                    </ul>

                    {/* Botões */}
                    <div className="space-y-3">
                        <button
                            onClick={onConnect}
                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <Icon name="zap" size={18} />
                            Conectar ao Puter
                        </button>
                        <button
                            onClick={onDismiss}
                            className="w-full py-3 px-4 text-slate-500 hover:text-slate-700 font-medium transition-colors text-sm"
                        >
                            Agora não
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PuterSuggestionModal;
