/**
 * Testes do formato de backup/importação (sem IndexedDB / Firebase).
 * Executar: npx tsx scripts/test-backup-service.ts
 */
import {
    applyIdRemapToComments,
    applyIdRemapToProfile,
    assembleChunks,
    BACKUP_VERSION,
    base64ToBlob,
    blobToBase64,
    buildBackupPayload,
    extractItems,
    hasBackupExtras,
    mergeProfiles,
    normalizeBackupGraph,
    normalizeImportedItem,
    normalizeStudyItemId,
    parseBackupPayload,
    payloadHasContent,
    sanitizeForJson,
    splitUtf8,
} from '../services/backupService';
import type { LocalProfile } from '../services/localDB';

let passed = 0;
let failed = 0;

function assert(name: string, cond: boolean, detail?: unknown) {
    if (cond) {
        passed++;
        console.log(`  ok  ${name}`);
    } else {
        failed++;
        console.error(`  FAIL ${name}`, detail ?? '');
    }
}

async function run() {
    console.log('extractItems');
    assert('data[]', extractItems({ data: [{ a: 1 }] }).length === 1);
    assert('items[] (cloud legado)', extractItems({ items: [{ a: 1 }, { a: 2 }] }).length === 2);
    assert('array nu (repo)', extractItems([{ chinese: 'x' }]).length === 1);
    assert('vazio', extractItems({}).length === 0);

    console.log('hasBackupExtras');
    assert('profile objeto', hasBackupExtras({ profile: { savedIds: [] } }) === true);
    assert('profile null (texto/pasta)', hasBackupExtras({ data: [], profile: null }) === false);
    assert('comentários', hasBackupExtras({ comments: [{ id: 'c1' }] }) === true);
    assert('array nu', hasBackupExtras([{ chinese: 'x' }]) === false);

    console.log('normalizeStudyItemId');
    assert('number', normalizeStudyItemId(2469) === 'legacy_2469');
    assert('numeric string', normalizeStudyItemId('2469') === 'legacy_2469');
    assert('já migrado', normalizeStudyItemId('legacy_2469') === 'legacy_2469');
    assert('local id', normalizeStudyItemId('local_123_abc') === 'local_123_abc');
    assert('vazio', normalizeStudyItemId('') === '');

    console.log('normalizeImportedItem');
    const extra = normalizeImportedItem({
        id: 42,
        chinese: '你好',
        translation: 'oi',
        customField: 'keep-me',
        tokens: ['你', '好'],
    });
    assert('id remap', extra?.item.id === 'legacy_42');
    assert('remappedFrom', extra?.remappedFrom === '42');
    assert('preserva campo extra', (extra?.item as any).customField === 'keep-me');
    assert('rejeita sem translation', normalizeImportedItem({ chinese: 'x' }) === null);

    console.log('applyIdRemapToProfile');
    const remap = new Map([['42', 'legacy_42'], ['99', 'legacy_99']]);
    const remappedProfile = applyIdRemapToProfile({
        savedIds: ['42', 'keep'],
        stats: {
            correct: 1, wrong: 0, history: [], wordCounts: {},
            favoriteConfigs: { '42': { id: '42', mode: 'relative' } },
            studyMoreIds: ['99'],
        },
        totalScore: 10,
        activeFolderFilters: [],
        colorCorrections: { '42': [{ word: 'a', colorIndex: 1 }] },
    }, remap);
    assert('savedIds', remappedProfile.savedIds[0] === 'legacy_42' && remappedProfile.savedIds[1] === 'keep');
    assert('colorCorrections', !!remappedProfile.colorCorrections?.['legacy_42']);
    assert('favoriteConfigs', !!remappedProfile.stats.favoriteConfigs?.['legacy_42']);
    assert('studyMoreIds', remappedProfile.stats.studyMoreIds?.[0] === 'legacy_99');

    console.log('applyIdRemapToComments');
    const comments = applyIdRemapToComments([
        { id: 'c1', targetType: 'sentence', targetKey: '42', text: 'nota', createdAt: '', updatedAt: '' },
        { id: 'c2', targetType: 'word', targetKey: 'hola', text: 'x', createdAt: '', updatedAt: '' },
    ], remap);
    assert('sentence key', comments[0].targetKey === 'legacy_42');
    assert('word key intacta', comments[1].targetKey === 'hola');

    console.log('normalizeBackupGraph');
    const graph = normalizeBackupGraph({
        items: [{ id: 7, chinese: 'ciao', translation: 'oi' }],
        profile: { savedIds: ['7'], stats: { correct: 0, wrong: 0, history: [], wordCounts: {} }, totalScore: 0, activeFolderFilters: [] },
        comments: [{ id: 'c', targetType: 'sentence', targetKey: '7', text: 'n', createdAt: '', updatedAt: '' }],
        voiceRecordings: [{ wordId: '7', mimeType: 'audio/webm', createdAt: '', updatedAt: '', audioBase64: 'AA==' }],
    });
    assert('graph item id', graph.items[0].id === 'legacy_7');
    assert('graph savedIds', graph.profile?.savedIds[0] === 'legacy_7');
    assert('graph comment', graph.comments[0].targetKey === 'legacy_7');
    assert('graph voice', graph.voiceRecordings[0].wordId === 'legacy_7');

    console.log('mergeProfiles');
    const current: LocalProfile = {
        savedIds: ['a'],
        stats: { correct: 50, wrong: 2, history: [], wordCounts: {}, points: 900 },
        totalScore: 900,
        activeFolderFilters: ['Pasta'],
        colorCorrections: { a: [{ word: 'x', colorIndex: 0 }] },
        readingMode: 'study',
        readingPrefs: { showTranslation: true, fontSize: 'md' },
    };
    const incoming: LocalProfile = {
        savedIds: ['b'],
        stats: { correct: 1, wrong: 0, history: [], wordCounts: {}, points: 10 },
        totalScore: 10,
        activeFolderFilters: [],
        colorCorrections: { b: [{ word: 'y', colorIndex: 2 }] },
        readingMode: 'simple',
        readingPrefs: { showTranslation: false, fontSize: 'lg' },
    };
    const merged = mergeProfiles(current, incoming, 'merge');
    assert('merge une favoritos', merged.savedIds.includes('a') && merged.savedIds.includes('b'));
    assert('merge preserva XP', merged.stats.correct === 50 && merged.totalScore === 900);
    assert('merge une cores', !!merged.colorCorrections?.a && !!merged.colorCorrections?.b);
    assert('merge preserva prefs', merged.readingMode === 'study');

    const replaced = mergeProfiles(current, incoming, 'replace');
    assert('replace usa stats do backup', replaced.stats.correct === 1 && replaced.totalScore === 10);
    assert('replace troca favoritos', replaced.savedIds.length === 1 && replaced.savedIds[0] === 'b');

    console.log('chunk roundtrip');
    const big = 'olá 你好 🎉 '.repeat(5000);
    const chunks = splitUtf8(big, 700);
    const joined = assembleChunks(chunks.map((t, i) => ({ i, t })));
    assert('reassembly', joined === big);
    assert('vários chunks', chunks.length > 5);
    const shuffled = assembleChunks([
        { i: 2, t: 'C' },
        { i: 0, t: 'A' },
        { i: 1, t: 'B' },
    ]);
    assert('ordem dos chunks', shuffled === 'ABC');

    console.log('parseBackupPayload');
    const fileFmt = parseBackupPayload({
        version: '2.2.0',
        data: [{ chinese: 'a', translation: 'b' }],
        profile: { savedIds: ['x'] },
        comments: [],
        sessions: [],
    });
    assert('file usa data', fileFmt.data.length === 1 && fileFmt.profile?.savedIds[0] === 'x');

    const cloudFmt = parseBackupPayload({
        version: '2.2.0',
        items: [{ chinese: 'a', translation: 'b' }],
        profile: { savedIds: [] },
        comments: [{ id: 'c' }],
        sessions: [{ id: 's' }],
    });
    assert('cloud legado usa items', cloudFmt.data.length === 1 && cloudFmt.comments.length === 1);

    const bare = parseBackupPayload([{ chinese: 'a', translation: 'b' }]);
    assert('array nu', bare.data.length === 1 && bare.profile === null);

    console.log('payloadHasContent / buildBackupPayload');
    const statsOnly = buildBackupPayload({
        items: [],
        profile: { ...incoming, stats: { correct: 3, wrong: 0, history: [], wordCounts: {} } },
        comments: [],
        sessions: [],
        voiceRecordings: [],
    });
    assert('versão atual', statsOnly.version === BACKUP_VERSION);
    assert('exporta stats sem itens', payloadHasContent(statsOnly) === true);
    assert('inclui campo voice vazio', Array.isArray(statsOnly.voiceRecordings) && statsOnly.voiceRecordings.length === 0);
    assert('vazio de verdade', payloadHasContent(buildBackupPayload({
        items: [],
        profile: {
            savedIds: [],
            stats: { correct: 0, wrong: 0, history: [], wordCounts: {} },
            totalScore: 0,
            activeFolderFilters: [],
        },
        comments: [],
        sessions: [],
    })) === false);

    console.log('sanitizeForJson');
    const dirty = sanitizeForJson({ a: 1, b: undefined as number | undefined, c: { d: undefined as string | undefined, e: 'ok' } }) as {
        a: number;
        c: { e: string; d?: string };
        b?: number;
    };
    assert('remove undefined', !('b' in dirty) && !('d' in dirty.c) && dirty.c.e === 'ok');

    console.log('voice base64 roundtrip');
    const blob = new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'audio/webm' });
    const b64 = await blobToBase64(blob);
    const back = base64ToBlob(b64, 'audio/webm');
    const round = new Uint8Array(await back.arrayBuffer());
    assert('bytes iguais', round.length === 4 && round[0] === 1 && round[3] === 250);

    console.log(`\n${passed} ok, ${failed} falhas`);
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
