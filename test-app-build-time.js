/**
 * Build timestamp — run: node test-app-build-time.js
 * Mirrors utils/appBuildTime.ts
 */

function formatSaoPauloBuildTime(date = new Date()) {
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const get = (type) => parts.find(p => p.type === type)?.value || '';
    return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

let failed = 0;
function assert(cond, label) {
    if (!cond) {
        failed += 1;
        console.error('FAIL', label);
    } else console.log('ok  ', label);
}

const sample = formatSaoPauloBuildTime(new Date('2026-09-06T22:05:00.000Z'));
assert(sample === '06/09/2026 19:05', `PT-BR São Paulo stamp (${sample})`);
assert(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(formatSaoPauloBuildTime()), 'live stamp matches dd/mm/aaaa hh:mm');

if (failed) {
    console.error(failed, 'failed');
    process.exit(1);
}
console.log('\nall build-time checks passed');
