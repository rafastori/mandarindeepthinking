import { pipeline, env } from '@xenova/transformers';

// Configuração para carregar modelos do CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

// Configurações para estabilidade em produção (Vercel/Bundled)
// Desabilitamos multi-threading e proxy para evitar que o ONNX tente carregar sub-workers
// que costumam falhar ao serem resolvidos em ambientes com code-splitting (Vite).
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;

console.log('Whisper Worker: Inicializado (Single Thread Mode).');

let transcriber: any = null;

// Função para carregar o modelo
const loadModel = async (model: string = 'Xenova/whisper-base') => {
    if (transcriber) {
        self.postMessage({ status: 'ready', message: 'Modelo já carregado.' });
        return;
    }

    try {
        transcriber = await pipeline('automatic-speech-recognition', model, {
            progress_callback: (p: any) => {
                if (p.status === 'progress' && typeof p.progress === 'number') {
                    self.postMessage({ status: 'progress', progress: p.progress });
                }
            }
        });
        self.postMessage({ status: 'ready', message: 'Modelo Whisper carregado!' });
    } catch (err: any) {
        console.error('Worker error loading model:', err);
        self.postMessage({ status: 'error', error: err.message });
    }
};

// Processa mensagens do thread principal
self.onmessage = async (event: any) => {
    const { type, audio, language, model, prompt } = event.data;

    if (type === 'load') {
        await loadModel(model);
    } else if (type === 'transcribe') {
        if (!transcriber) {
            await loadModel();
        }

        try {
            self.postMessage({ status: 'processing', message: 'Transcrevendo áudio...' });

            const output = await transcriber(audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
                language: language || 'chinese',
                task: 'transcribe',
                prompt: prompt, // Passa o texto esperado como dica para o modelo
                return_timestamps: false
            });

            self.postMessage({ status: 'result', transcript: output.text });
        } catch (err: any) {
            self.postMessage({ status: 'error', error: err.message });
        }
    }
};
