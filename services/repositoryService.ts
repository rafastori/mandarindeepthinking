import { StudyItem } from '../types';
import { generateRawText, processTextWithGemini } from './gemini';

export interface RepositoryNode {
    type: 'folder' | 'file';
    name: string;
    path: string;
    children?: RepositoryNode[];
    language: string;
    txtKey?: string; // The import.meta.glob key for the .txt file
    jsonKey?: string; // The import.meta.glob key for the .json file
}

class RepositoryService {
    private rawFiles: Record<string, () => Promise<string>>;
    private jsonFiles: Record<string, () => Promise<any>>;

    constructor() {
        // Obter todos os arquivos de texto como string raw
        // 'query: "?raw"' no Vite 5 converte o arquivo para texto bruto.
        this.rawFiles = import.meta.glob('../MemorizaTudo-Repo/**/*.txt', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

        // Obter os arquivos json
        this.jsonFiles = import.meta.glob('../MemorizaTudo-Repo/**/*.json');
    }

    /**
     * Retorna a árvore de diretórios baseada nos arquivos iterados.
     * Pastas terminadas em "-Import" são intencionalmente ignoradas da visualização.
     */
    public getRepositoryTree(): RepositoryNode[] {
        const root: RepositoryNode[] = [];

        Object.keys(this.rawFiles).forEach((txtKey) => {
            // txtKey: '../MemorizaTudo-Repo/Alemão/2403 - mod2.txt'
            // Remover o prefixo base para pegar o caminho relativo
            const relativePath = txtKey.replace('../MemorizaTudo-Repo/', '');

            // Ignorar pastas "-Import" da UI
            if (relativePath.includes('-Import/')) {
                return;
            }

            const parts = relativePath.split('/');
            const language = parts[0];

            let currentNodeList = root;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isFile = i === parts.length - 1;

                let existingNode = currentNodeList.find(n => n.name === part);

                if (!existingNode) {
                    existingNode = {
                        type: isFile ? 'file' : 'folder',
                        name: part,
                        path: parts.slice(0, i + 1).join('/'),
                        language: language,
                        children: isFile ? undefined : []
                    };

                    if (isFile) {
                        existingNode.txtKey = txtKey;

                        // Inferir o nome do JSON correspondente:
                        // Nome original do arquivo sem o mod2, ou padronizado:
                        // Alemão -> Alemão-Import
                        const dirPath = parts.slice(0, -1).join('/'); // ex: Alemão
                        const fileName = part.replace('.txt', '').split(' - ')[0]; // remove - mod2, etc. (se houver variação)

                        const importDir = dirPath + '-Import';
                        const jsonExpectedKey = `../MemorizaTudo-Repo/${importDir}/${fileName}.json`;

                        existingNode.jsonKey = jsonExpectedKey;
                    }

                    currentNodeList.push(existingNode);
                }

                if (!isFile && existingNode.children) {
                    currentNodeList = existingNode.children;
                }
            }
        });

        return root;
    }

    /**
     * Busca o conteúdo do arquivo TXT e retorna como string
     */
    public async getRawText(txtKey: string): Promise<string> {
        const fetcher = this.rawFiles[txtKey];
        if (!fetcher) throw new Error("Texto não encontrado: " + txtKey);
        return await fetcher();
    }

    /**
     * Busca o conteúdo do arquivo JSON
     */
    public async getJsonData(jsonKey: string): Promise<{ items: StudyItem[] }> {
        const fetcher = this.jsonFiles[jsonKey];
        if (!fetcher) {
            // fallback tentativo caso mod2 ou similar passe
            console.warn("Rota principal falhou, tentaremos regex ou similar.", jsonKey);
            throw new Error(`Arquivo estruturado não encontrado para importação: ${jsonKey}. Talvez ele ainda não tenha sido processado no repositório.`);
        }

        const module = await fetcher();
        return module.default || module;
    }

    // --- AUTO SYNC DEV TOOLS ---

    /**
     * Tenta buscar as tarefas pendentes do servidor local Node (Dev Only)
     */
    public async checkDevSyncOrphans(): Promise<any> {
        try {
            const res = await fetch('/api/dev/repo-status');
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.warn("Dev sync offline", e);
            return null;
        }
    }

    /**
     * Salva o arquivo fisicamente usando o endpoint local
     */
    public async saveFileToRepo(relativePath: string, content: any, isJson: boolean): Promise<boolean> {
        try {
            const res = await fetch('/api/dev/repo-save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ relativePath, content, isJson })
            });
            return res.ok;
        } catch (e) {
            console.error("Save to repo failed", e);
            return false;
        }
    }

    /**
     * Fluxo completo de orquestração a ser chamado pela UI (RepositoryModal)
     */
    public async runFullAutoSync(
        onProgress: (msg: string) => void
    ) {
        if (!import.meta.env.DEV) return;

        const tasks = await this.checkDevSyncOrphans();
        if (!tasks) return;

        const { missingTranslations, missingJson } = tasks;

        if (missingTranslations.length === 0 && missingJson.length === 0) {
            onProgress("Repositório OK");
            return;
        }

        // 1. Resolver Traduções Faltantes (Gerar TXTs a partir do Inglês)
        for (const task of missingTranslations) {
            const { file, targetLang } = task;
            onProgress(`Traduzindo ${file} para ${targetLang}...`);

            try {
                // Buscar o texto mestre em inglês
                const englishRes = await fetch(`/MemorizaTudo-Repo/Inglês/${file}?raw`);
                if (!englishRes.ok) continue;
                const englishText = await englishRes.text();

                // Pedir ao Gemini para traduzir o texto
                // Reciclando nossa prompt customizada da API do Gemini
                const promptToTranslate = `Traduza EXATAMENTE este texto para ${targetLang}, sem adicionar explicações adicionais, e mantendo a mesma formatação:\n\n${englishText}`;

                // Pode usar generateRawText passando um customPrompt forte
                const translatedText = await generateRawText(targetLang, promptToTranslate);

                // Salvar fisicamente
                await this.saveFileToRepo(`${targetLang}/${file}`, translatedText, false);
            } catch (e) {
                console.error(`Erro ao traduzir ${file} para ${targetLang}`, e);
            }
        }

        // 2. Resolver JSONs Faltantes (Criar Processamento Segmentado)
        for (const task of missingJson) {
            const { file, targetLang, targetFolder } = task;
            onProgress(`Segmentando ${file} (${targetLang})...`);

            try {
                // Ao invés de usar fetch do Vite Server que sofre reload com arquivos recém criados,
                // vamos puxar direto o raw txt (Ovite server pode estar desatualizado por segundos)
                // Usando a rota de dev:
                const textRes = await fetch(`/MemorizaTudo-Repo/${targetLang}/${file}.txt?raw`);
                if (!textRes.ok) continue;

                const textToSegment = await textRes.text();

                // Segmentar! (Magia Gemini)
                const studyItems = await processTextWithGemini(textToSegment, 'direct', targetLang as any);

                // Salvar JSON no Disco
                const relativePath = `${targetLang}-Import/${file}.json`;
                await this.saveFileToRepo(relativePath, studyItems, true);
            } catch (e) {
                console.error(`Erro ao segmentar ${file} (${targetLang})`, e);
            }
        }

        onProgress("Sincronização concluída");
    }
}

export const repositoryService = new RepositoryService();
