// Paleta de 15 cores vibrantes (mantém paridade com a do modo Estudo)
export const HIGHLIGHT_COLORS: { text: string; bg: string }[] = [
    { text: '#b91c1c', bg: '#fee2e2' },
    { text: '#0369a1', bg: '#e0f2fe' },
    { text: '#15803d', bg: '#dcfce7' },
    { text: '#7e22ce', bg: '#f3e8ff' },
    { text: '#c2410c', bg: '#ffedd5' },
    { text: '#0e7490', bg: '#cffafe' },
    { text: '#a16207', bg: '#fef9c3' },
    { text: '#be185d', bg: '#fce7f3' },
    { text: '#4338ca', bg: '#e0e7ff' },
    { text: '#166534', bg: '#d1fae5' },
    { text: '#9333ea', bg: '#ede9fe' },
    { text: '#ea580c', bg: '#fff7ed' },
    { text: '#0891b2', bg: '#ecfeff' },
    { text: '#b45309', bg: '#fffbeb' },
    { text: '#dc2626', bg: '#fef2f2' },
];

export const cleanPunctuation = (text: string): string =>
    text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'´]/g, '').trim();

export const formatTokensToText = (tokens: string[]): string => {
    let result = '';
    tokens.forEach((token, i) => {
        const isPunctuation = /^[.,!?;:。，！？；：、]+$/.test(token);
        if (i === 0) {
            result = token;
        } else if (isPunctuation) {
            result += token;
        } else {
            const lastChar = result.slice(-1);
            const isCJK = /[一-鿿぀-ゟ゠-ヿ]/.test(lastChar)
                || /[一-鿿぀-ゟ゠-ヿ]/.test(token[0] || '');
            result += isCJK ? token : ' ' + token;
        }
    });
    return result;
};
