import React, { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

export default class AppErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error) {
        console.error('[MemorizaTudo] render crash:', error);
    }

    render() {
        if (!this.state.error) return this.props.children;
        const message = this.state.error.message || 'Erro inesperado';
        const stack = this.state.error.stack || '';
        return (
            <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
                <div className="max-w-xl mx-auto bg-white border border-red-100 rounded-2xl shadow-sm p-5">
                    <p className="text-sm font-bold text-red-700">Algo quebrou nesta tela</p>
                    <p className="text-sm text-slate-600 mt-2">{message}</p>
                    {stack ? (
                        <pre className="mt-3 text-[11px] leading-snug text-slate-500 overflow-auto max-h-48 whitespace-pre-wrap">{stack}</pre>
                    ) : null}
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
}
