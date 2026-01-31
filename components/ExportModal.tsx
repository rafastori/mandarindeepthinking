import React, { useState } from 'react';
import Icon from './Icon';

// export type ExportFormat = 'detailed' | 'simple'; // Removido
export type ExportType = 'txt' | 'pdf';

export interface ExportConfig {
    filename: string;
    // format: ExportFormat; // Removido
    type: ExportType;
}

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (config: ExportConfig) => void;
    count: number;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onConfirm, count }) => {
    const [filename, setFilename] = useState(`textos-${new Date().toISOString().slice(0, 10)}`);
    // const [format, setFormat] = useState<ExportFormat>('detailed'); // Removido
    const [type, setType] = useState<ExportType>('txt');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-pop">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Icon name="download" size={24} className="text-brand-600" />
                        Exportar {count} Itens
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <Icon name="x" size={24} />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Filename Input */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Nome do Arquivo</label>
                        <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500">
                            <input
                                type="text"
                                value={filename}
                                onChange={(e) => setFilename(e.target.value)}
                                className="flex-1 outline-none text-slate-700"
                                placeholder="Nome do arquivo..."
                            />
                            <span className="text-slate-400 font-medium">.{type}</span>
                        </div>
                    </div>

                    {/* Type Selection */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Formato do Arquivo</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setType('txt')}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-medium border-2 transition-all ${type === 'txt'
                                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                            >
                                <Icon name="file-text" size={20} />
                                Texto (.txt)
                            </button>
                            <button
                                onClick={() => setType('pdf')}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-medium border-2 transition-all ${type === 'pdf'
                                    ? 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                            >
                                <Icon name="file" size={20} />
                                PDF (.pdf)
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-100 rounded-xl transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={() => onConfirm({ filename, type } as any)}
                        className="flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 shadow-md transition-colors flex items-center justify-center gap-2"
                    >
                        Exportar
                        <Icon name="arrow-right" size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;
