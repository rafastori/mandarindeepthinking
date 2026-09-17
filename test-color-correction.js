/**
 * Correção por cores: parse do DeepSeek, lotes de 3 e isolamento de erro.
 * Executar: node test-color-correction.js
 */
import assert from 'assert';
import {
    chunkArray,
    extractMessageText,
    normalizeArrayResult,
    parseJsonFromText,
    processBatchesIsolated,
    sanitizeColorOutputs,
    stripThinkBlocks,
} from './lib/openrouter.js';

function ok(name, cond) {
    assert.ok(cond, name);
    console.log(`  ok  ${name}`);
}

console.log('parse / think tags');
ok('strip think', stripThinkBlocks('<think>raciocinio longo</think>\n{"a":1}') === '{"a":1}');
ok(
    'parse json depois do think',
    parseJsonFromText('<think>bla bla</think>\n```json\n{"results":[{"sentenceId":"1"}]}\n```').results[0].sentenceId === '1'
);
ok(
    'parse array misturado com texto',
    parseJsonFromText('Aqui vai:\n[{"sentenceId":"s1","coloredTranslation":[{"word":"casa","colorIndex":0}]}]\nfim')[0].sentenceId === 's1'
);

const truncated = '{"results":[{"sentenceId":"a","coloredTranslation":[{"word":"oi","colorIndex":1}]},{"sentenceId":"b","coloredTranslation":[{"word":"x"';
const repaired = parseJsonFromText(truncated);
ok('repara JSON truncado', repaired.results[0].sentenceId === 'a');

console.log('extractMessageText');
ok('content string', extractMessageText({ content: '{"ok":true}' }) === '{"ok":true}');
ok(
    'content array',
    extractMessageText({ content: [{ type: 'text', text: '{"ok":true}' }] }) === '{"ok":true}'
);
ok(
    'não usa reasoning se content existe',
    extractMessageText({ content: '{"ok":true}', reasoning: 'pensei muito' }) === '{"ok":true}'
);
ok(
    'fallback reasoning_content',
    extractMessageText({ content: '', reasoning_content: '{"ok":true}' }) === '{"ok":true}'
);

console.log('normalize / sanitize');
ok(
    'wrapper results',
    normalizeArrayResult({ results: [{ sentenceId: '1', coloredTranslation: [{ word: 'a', colorIndex: 0 }] }] }).length === 1
);
const sanitized = sanitizeColorOutputs([
    { sentenceId: 10, coloredTranslation: [{ word: 'casa', colorIndex: 2 }, { word: '', colorIndex: 1 }] },
    { sentenceId: 'x', coloredTranslation: 'nope' },
    { coloredTranslation: [{ word: 'a', colorIndex: 0 }] },
]);
ok('sanitize mantém frase válida', sanitized.length === 1 && sanitized[0].sentenceId === '10');
ok('sanitize descarta token vazio', sanitized[0].coloredTranslation.length === 1);

console.log('lotes de 3');
ok('7 frases em lotes de 3 → 3+3+1', chunkArray(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3).length === 3);
ok('primeiro lote tem 3', chunkArray(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3)[0].length === 3);
ok('último lote tem 1', chunkArray(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3)[2].length === 1);

console.log('erro em um lote não apaga os outros');
const { collected, errors } = await processBatchesIsolated(
    [[1], [2], [3]],
    async (chunk) => {
        if (chunk[0] === 2) throw new Error('boom');
        return [`ok-${chunk[0]}`];
    }
);
ok('coletou 2 lotes', collected.flat().join(',') === 'ok-1,ok-3');
ok('registrou 1 erro', errors.length === 1);

console.log('color-correction tests passed');
