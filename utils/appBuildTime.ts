/** Data/hora de build em America/Sao_Paulo, ex.: 06/09/2026 19:05 */
export function formatSaoPauloBuildTime(date = new Date()): string {
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || '';
    return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}
