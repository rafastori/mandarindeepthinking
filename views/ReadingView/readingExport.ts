import { StudyItem } from '../../types';
import { ExportConfig } from '../../components/ExportModal';

const NO_SPACE_BEFORE = ',.-!?;:)]}"'»›…。，！？；：）】」』、';
const NO_SPACE_AFTER = '([{"'«‹（【「『';

export function formatTokensToText(tokens: string[]): string {
    if (!tokens || tokens.length === 0) return '';

    let result = '';
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const prevToken = i > 0 ? tokens[i - 1] : '';
        const skipSpace = i > 0 && (
            (token.length > 0 && NO_SPACE_BEFORE.includes(token[0])) ||
            (prevToken.length > 0 && NO_SPACE_AFTER.includes(prevToken[prevToken.length - 1]))
        );
        if (i > 0 && !skipSpace) {
            result += ' ';
        }
        result += token;
    }
    return result;
}

export async function saveBlob(blob: Blob, filename: string, extension: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${extension}`;

    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        a.target = '_blank';
    }

    a.style.display = 'none';
    document.body.appendChild(a);

    await new Promise<void>((resolve) => {
        setTimeout(() => {
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                resolve();
            }, 100);
        }, 0);
    });
}

export async function exportSelectedTexts(opts: {
    filteredData: StudyItem[];
    selectedIds: Set<string>;
    config: ExportConfig;
    onDone: () => void;
}) {
    const { filename, type } = opts.config;
    const selectedItems = opts.filteredData.filter(item => opts.selectedIds.has(item.id.toString()));
    if (selectedItems.length === 0) return;

    try {
        const exportItems = selectedItems.map(item => ({
            text: formatTokensToText(item.tokens),
            translation: item.translation || ''
        }));

        const response = await fetch('/api/export-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: exportItems, filename, type })
        });

        if (!response.ok) {
            const errorText = await response.text();
            try {
                const error = JSON.parse(errorText);
                throw new Error(error.error || 'Erro ao exportar');
            } catch {
                throw new Error(`Erro ${response.status}: ${errorText}`);
            }
        }

        const blob = await response.blob();
        await saveBlob(blob, filename, type);
        opts.onDone();
    } catch (error: any) {
        console.error('[Export] ERRO CAPTURADO:', error);
        alert(`Erro ao exportar: ${error.message || error}`);
    }
}
