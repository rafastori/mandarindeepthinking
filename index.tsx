import React from 'react';
import ReactDOM from 'react-dom/client';
import AppErrorBoundary from './components/AppErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Elemento 'root' não encontrado no HTML");
}

const root = ReactDOM.createRoot(rootElement);

function BootError({ error }: { error: unknown }) {
    const text = error instanceof Error ? `${error.message}\n${error.stack || ''}` : String(error);
    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-xl mx-auto bg-white border border-red-100 rounded-2xl p-5">
                <p className="text-sm font-bold text-red-700">Não foi possível abrir o MemorizaTudo</p>
                <pre className="mt-3 text-[11px] leading-snug text-slate-500 overflow-auto max-h-64 whitespace-pre-wrap">{text}</pre>
                <button
                    type="button"
                    className="mt-4 px-4 py-2 rounded-full bg-brand-600 text-white text-sm font-semibold"
                    onClick={() => window.location.reload()}
                >
                    Recarregar
                </button>
            </div>
        </div>
    );
}

root.render(
    <div className="h-screen w-full flex items-center justify-center text-slate-400">Carregando...</div>
);

Promise.all([
    import('./components/ColorCorrectionRoot'),
    import('./App'),
]).then(([{ default: ColorCorrectionRoot }, { default: App }]) => {
    root.render(
        <React.StrictMode>
            <AppErrorBoundary>
                <ColorCorrectionRoot>
                    <App />
                </ColorCorrectionRoot>
            </AppErrorBoundary>
        </React.StrictMode>
    );
}).catch((error) => {
    console.error('[MemorizaTudo] falha ao carregar o app:', error);
    root.render(<BootError error={error} />);
});
