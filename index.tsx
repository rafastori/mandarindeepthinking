import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ColorCorrectionRoot from './components/ColorCorrectionRoot';
import AppErrorBoundary from './components/AppErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Elemento 'root' não encontrado no HTML");
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <AppErrorBoundary>
            <ColorCorrectionRoot>
                <App />
            </ColorCorrectionRoot>
        </AppErrorBoundary>
    </React.StrictMode>
);
