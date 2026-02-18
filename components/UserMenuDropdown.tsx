import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import Icon from './Icon';
import { RecognitionEngine } from '../hooks/useSpeechRecognition';

interface UserMenuDropdownProps {
    user: User;
    isPuterConnected: boolean;
    puterUsername: string | null;
    onLogout: () => void;
    onConnectPuter: () => void;
    onDisconnectPuter: () => void;
    onResetAccount: () => void;
    onExportData: () => void;
    onImportData: (file: File, mode: 'merge' | 'replace') => Promise<{ success: boolean; count: number; error?: string; profile?: { savedIds: string[]; stats: any; totalScore: number } | null }>;
    onExportTextApp?: () => void;
    onImportTextFile?: (file: File) => Promise<{ success: boolean; count: number; error?: string }>;
    engine: RecognitionEngine;
    onEngineChange: (engine: RecognitionEngine) => void;
    // Cloud Sync
    onBackupToCloud?: () => void;
    onRestoreFromCloud?: () => void;
    isSyncing?: boolean;
}

/**
 * Menu dropdown exibido ao clicar no avatar do usuário
 * Contém opções: Conectar Puter, Exportar, Importar, Limpar Dados, Sair
 */
export const UserMenuDropdown: React.FC<UserMenuDropdownProps> = ({
    user,
    isPuterConnected,
    puterUsername,
    onLogout,
    onConnectPuter,
    onDisconnectPuter,
    onResetAccount,
    onExportData,
    onImportData,
    onExportTextApp,
    onImportTextFile,
    engine,
    onEngineChange,
    onBackupToCloud,
    onRestoreFromCloud,
    isSyncing
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importingText, setImportingText] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textFileInputRef = useRef<HTMLInputElement>(null);

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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImportFile(file);
            setShowImportModal(true);
            setIsOpen(false);
        }
        // Reset input para permitir selecionar o mesmo arquivo novamente
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleTextFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onImportTextFile) {
            setIsOpen(false);
            setImportingText(true);
            const result = await onImportTextFile(file);
            setImportingText(false);
            if (result.success) {
                alert(`✅ Importação concluída! ${result.count} itens importados.`);
            } else {
                alert(`❌ Erro: ${result.error}`);
            }
        }
        if (textFileInputRef.current) textFileInputRef.current.value = '';
    };

    const handleImport = async (mode: 'merge' | 'replace') => {
        if (!importFile) return;

        setImporting(true);
        const result = await onImportData(importFile, mode);
        setImporting(false);

        if (result.success) {
            let msg = `✅ Importação concluída! ${result.count} itens importados.`;
            if (result.profile) {
                const extras: string[] = [];
                if (result.profile.savedIds?.length) extras.push(`${result.profile.savedIds.length} favoritos`);
                if (result.profile.stats) extras.push('estatísticas');
                if (result.profile.totalScore) extras.push(`pontuação: ${result.profile.totalScore}`);
                if (extras.length > 0) {
                    msg += `\n\n📊 Perfil restaurado: ${extras.join(', ')}`;
                }
            }
            alert(msg);
        } else {
            alert(`❌ Erro: ${result.error}`);
        }

        setShowImportModal(false);
        setImportFile(null);
    };

    return (
        <>
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
                            {!isPuterConnected && (
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
                            )}

                            {isPuterConnected && (
                                <button
                                    onClick={() => {
                                        if (window.confirm("Deseja sair da conta Puter?")) {
                                            handleAction(onDisconnectPuter);
                                        }
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-orange-50 text-slate-700 hover:text-orange-700 transition-colors"
                                >
                                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                        <Icon name="log-out" size={16} className="text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Sair do Puter</p>
                                        <p className="text-xs text-slate-500">Desconectar áudio IA</p>
                                    </div>
                                </button>
                            )}

                            <div className="h-px bg-slate-100 my-2" />

                            {/* Configurações de Voz */}
                            <div className="px-3 py-2">
                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-2 flex items-center gap-1">
                                    <Icon name="mic" size={12} /> Reconhecimento de Voz
                                </p>
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => onEngineChange('native')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${engine === 'native' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <Icon name="chrome" size={10} /> Nativo
                                    </button>
                                    <button
                                        onClick={() => onEngineChange('whisper')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${engine === 'whisper' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <Icon name="zap" size={10} /> Whisper
                                    </button>
                                </div>
                            </div>

                            <div className="h-px bg-slate-100 my-2" />

                            {/* Exportar Dados */}
                            <button
                                onClick={() => handleAction(onExportData)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition-colors"
                            >
                                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <Icon name="download" size={16} className="text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Exportar Dados</p>
                                    <p className="text-xs text-slate-500">Baixar backup JSON</p>
                                </div>
                            </button>

                            {/* Importar Dados */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-purple-50 text-slate-700 hover:text-purple-700 transition-colors"
                            >
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                    <Icon name="upload" size={16} className="text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Importar Dados</p>
                                    <p className="text-xs text-slate-500">Restaurar backup</p>
                                </div>
                            </button>

                            <div className="h-px bg-slate-100 my-2" />

                            {/* Exportar Texto/Pasta App */}
                            {onExportTextApp && (
                                <button
                                    onClick={() => handleAction(onExportTextApp)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-teal-50 text-slate-700 hover:text-teal-700 transition-colors"
                                >
                                    <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                                        <Icon name="file-text" size={16} className="text-teal-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Exportar Texto/Pasta App</p>
                                        <p className="text-xs text-slate-500">Selecionados (sem stats)</p>
                                    </div>
                                </button>
                            )}

                            {/* Importar Texto/Pasta */}
                            {onImportTextFile && (
                                <button
                                    onClick={() => textFileInputRef.current?.click()}
                                    disabled={importingText}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 transition-colors disabled:opacity-50"
                                >
                                    <div className="w-8 h-8 bg-cyan-100 rounded-full flex items-center justify-center">
                                        {importingText ? (
                                            <div className="w-4 h-4 border-2 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
                                        ) : (
                                            <Icon name="file-plus" size={16} className="text-cyan-600" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Importar Texto/Pasta</p>
                                        <p className="text-xs text-slate-500">JSON (sem stats)</p>
                                    </div>
                                </button>
                            )}

                            <div className="h-px bg-slate-100 my-2" />

                            {/* ☁️ Backup na Nuvem */}
                            {onBackupToCloud && (
                                <button
                                    onClick={() => handleAction(onBackupToCloud)}
                                    disabled={isSyncing}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-sky-50 text-slate-700 hover:text-sky-700 transition-colors disabled:opacity-50"
                                >
                                    <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center">
                                        {isSyncing ? (
                                            <div className="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
                                        ) : (
                                            <Icon name="upload" size={16} className="text-sky-600" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Backup na Nuvem</p>
                                        <p className="text-xs text-slate-500">Salvar dados online</p>
                                    </div>
                                </button>
                            )}

                            {/* ☁️ Restaurar da Nuvem */}
                            {onRestoreFromCloud && (
                                <button
                                    onClick={() => handleAction(onRestoreFromCloud)}
                                    disabled={isSyncing}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-colors disabled:opacity-50"
                                >
                                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                        {isSyncing ? (
                                            <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                        ) : (
                                            <Icon name="download" size={16} className="text-indigo-600" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Restaurar da Nuvem</p>
                                        <p className="text-xs text-slate-500">Baixar último backup</p>
                                    </div>
                                </button>
                            )}

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

                {/* Input file oculto para backup completo */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                />
                {/* Input file oculto para importar texto/pasta */}
                <input
                    ref={textFileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleTextFileSelect}
                    className="hidden"
                />
            </div>

            {/* Modal de confirmação de importação */}
            {showImportModal && importFile && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-purple-50">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Icon name="upload" size={20} className="text-purple-600" />
                                Importar Backup
                            </h3>
                        </div>

                        <div className="p-6">
                            <div className="bg-slate-50 p-4 rounded-xl mb-4">
                                <p className="text-sm text-slate-600">
                                    <span className="font-semibold">Arquivo:</span> {importFile.name}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Tamanho: {(importFile.size / 1024).toFixed(1)} KB
                                </p>
                            </div>

                            <p className="text-sm text-slate-700 mb-4">
                                Como deseja importar os dados?
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => handleImport('merge')}
                                    disabled={importing}
                                    className="w-full flex items-center gap-3 p-4 text-left rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all disabled:opacity-50"
                                >
                                    <Icon name="plus-circle" size={24} className="text-emerald-600" />
                                    <div>
                                        <p className="font-semibold text-slate-800">Adicionar aos Atuais</p>
                                        <p className="text-xs text-slate-500">Mantém dados existentes e adiciona novos</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleImport('replace')}
                                    disabled={importing}
                                    className="w-full flex items-center gap-3 p-4 text-left rounded-xl border-2 border-slate-200 hover:border-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                                >
                                    <Icon name="refresh-cw" size={24} className="text-red-600" />
                                    <div>
                                        <p className="font-semibold text-slate-800">Substituir Tudo</p>
                                        <p className="text-xs text-red-500">⚠️ Apaga dados atuais primeiro</p>
                                    </div>
                                </button>
                            </div>

                            {importing && (
                                <div className="mt-4 flex items-center justify-center gap-2 text-purple-600">
                                    <div className="w-5 h-5 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                                    <span className="text-sm font-medium">Importando...</span>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100">
                            <button
                                onClick={() => {
                                    setShowImportModal(false);
                                    setImportFile(null);
                                }}
                                disabled={importing}
                                className="w-full py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default UserMenuDropdown;

