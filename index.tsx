import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ColorCorrectionRoot from './components/ColorCorrectionRoot';

// Garante que o elemento root existe antes de iniciar
const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Elemento 'root' não encontrado no HTML");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ColorCorrectionRoot>
      <App />
    </ColorCorrectionRoot>
  </React.StrictMode>
);
