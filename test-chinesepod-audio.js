/**
 * Standalone checks for ChinesePod filename / folder matching.
 * Run: node test-chinesepod-audio.js
 *
 * Mirrors utils/chinesePodAudio.ts — keep both in sync if the pattern changes.
 */

const AUDIO_EXT = /\.(mp3|m4a|wav|aac)$/i;
const FILE_RE = /chinesepod[_-]?c(\d{3,6})(dg|pr|rv)?(?:\.[^.]+)?$/i;
const C_ID_RE = /(?:^|[^a-z0-9])c(\d{3,6})(?:[^0-9]|$)/i;
const SEGMENT_ID_RE = /^\d{3,6}$/;
const EMBEDDED_ID_RE = /(?:^|[^\d])(\d{4,6})(?:[^\d]|$)/g;

function isSuffix(value) {
    return value === 'dg' || value === 'pr' || value === 'rv';
}

function parseChinesePodFilename(fileName) {
    if (!fileName) return null;
    const base = fileName.split(/[/\\]/).pop() || fileName;
    if (!AUDIO_EXT.test(base)) return null;
    const stem = base.replace(AUDIO_EXT, '');
    const match = stem.match(FILE_RE);
    if (!match) return null;
    const suffixRaw = match[2]?.toLowerCase() || null;
    return {
        lessonId: match[1],
        suffix: suffixRaw && isSuffix(suffixRaw) ? suffixRaw : null,
        fileName: base,
    };
}

function extractLessonIdsFromFolderPath(folderPath) {
    if (!folderPath) return [];
    const ids = new Set();
    const segments = folderPath.split(/[/\\]/).map(s => s.trim()).filter(Boolean);
    for (const segment of segments) {
        if (SEGMENT_ID_RE.test(segment)) ids.add(segment);
        const cMatch = segment.match(C_ID_RE);
        if (cMatch) ids.add(cMatch[1]);
        EMBEDDED_ID_RE.lastIndex = 0;
        let embedded;
        while ((embedded = EMBEDDED_ID_RE.exec(segment)) !== null) {
            ids.add(embedded[1]);
        }
    }
    return Array.from(ids);
}

function resolveLessonIdForView(folderFilters, itemFolderPaths) {
    const fromFilters = folderFilters
        .filter(path => path && path !== '__uncategorized__')
        .flatMap(path => extractLessonIdsFromFolderPath(path));
    const uniqueFilters = [...new Set(fromFilters)];
    if (uniqueFilters.length === 1) return uniqueFilters[0];
    if (uniqueFilters.length > 1) return null;
    const fromItems = itemFolderPaths.flatMap(path => extractLessonIdsFromFolderPath(path));
    const uniqueItems = [...new Set(fromItems)];
    return uniqueItems.length === 1 ? uniqueItems[0] : null;
}

function pickPreferredRecord(records, lessonId, preferred = 'dg') {
    const forLesson = records.filter(r => r.lessonId === lessonId);
    const order = [preferred, ...['dg', 'pr', 'rv'].filter(s => s !== preferred)];
    for (const suffix of order) {
        const hit = forLesson.find(r => r.suffix === suffix);
        if (hit) return hit;
    }
    return forLesson.find(r => r.suffix == null) || forLesson[0];
}

let failed = 0;
function assertEqual(actual, expected, label) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        failed += 1;
        console.error(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`);
    } else {
        console.log(`ok   ${label}`);
    }
}

assertEqual(parseChinesePodFilename('chinesepod_C2458dg.mp3'), { lessonId: '2458', suffix: 'dg', fileName: 'chinesepod_C2458dg.mp3' }, 'dg filename');
assertEqual(parseChinesePodFilename('chinesepod_C2463pr.mp3'), { lessonId: '2463', suffix: 'pr', fileName: 'chinesepod_C2463pr.mp3' }, 'pr filename');
assertEqual(parseChinesePodFilename('chinesepod_C2458rv.mp3'), { lessonId: '2458', suffix: 'rv', fileName: 'chinesepod_C2458rv.mp3' }, 'rv filename');
assertEqual(parseChinesePodFilename('CHINESEPOD_c2466DG.MP3'), { lessonId: '2466', suffix: 'dg', fileName: 'CHINESEPOD_c2466DG.MP3' }, 'case-insensitive');
assertEqual(parseChinesePodFilename('chinesepod_C2463.pdf'), null, 'pdf ignored');
assertEqual(parseChinesePodFilename('random.mp3'), null, 'unrelated mp3 ignored');
assertEqual(extractLessonIdsFromFolderPath('2458'), ['2458'], 'exact folder id');
assertEqual(extractLessonIdsFromFolderPath('Chinês/2458'), ['2458'], 'nested folder');
assertEqual(extractLessonIdsFromFolderPath('C2458'), ['2458'], 'C-prefixed segment');
assertEqual(extractLessonIdsFromFolderPath('Aula 1'), [], 'short classroom name ignored');
assertEqual(resolveLessonIdForView(['2458'], ['2458']), '2458', 'filter 2458');
assertEqual(resolveLessonIdForView(['2458', '2463'], ['2458', '2463']), null, 'mixed filters');
assertEqual(resolveLessonIdForView([], ['2456', '2456']), '2456', 'shared item folder');

const picked = pickPreferredRecord([
    { lessonId: '2458', suffix: 'pr', fileName: 'pr' },
    { lessonId: '2458', suffix: 'dg', fileName: 'dg' },
    { lessonId: '2463', suffix: 'dg', fileName: 'other' },
], '2458', 'dg');
assertEqual(picked?.fileName, 'dg', 'prefer digestivo');

function selectImportCandidates(entries, mode = 'dg-only') {
    const selected = [];
    let skippedOtherSuffix = 0;
    const lessons = new Set();
    for (const entry of entries) {
        if (mode === 'dg-only') {
            if (entry.parsed.suffix === 'dg') {
                selected.push(entry);
                lessons.add(entry.parsed.lessonId);
            } else skippedOtherSuffix += 1;
            continue;
        }
        selected.push(entry);
        lessons.add(entry.parsed.lessonId);
    }
    return { selected, skippedOtherSuffix, lessonIds: [...lessons].sort() };
}

const mixed = [
    { file: 'a', parsed: { lessonId: '2458', suffix: 'dg', fileName: 'chinesepod_C2458dg.mp3' } },
    { file: 'b', parsed: { lessonId: '2458', suffix: 'pr', fileName: 'chinesepod_C2458pr.mp3' } },
    { file: 'c', parsed: { lessonId: '2463', suffix: 'rv', fileName: 'chinesepod_C2463rv.mp3' } },
    { file: 'd', parsed: { lessonId: '2463', suffix: 'dg', fileName: 'chinesepod_C2463dg.mp3' } },
];
const dgOnly = selectImportCandidates(mixed, 'dg-only');
assertEqual(dgOnly.selected.map(e => e.parsed.fileName), ['chinesepod_C2458dg.mp3', 'chinesepod_C2463dg.mp3'], 'dg-only keeps digestivos');
assertEqual(dgOnly.skippedOtherSuffix, 2, 'dg-only skips pr/rv');
assertEqual(dgOnly.lessonIds, ['2458', '2463'], 'dg-only lesson ids');

if (failed > 0) {
    console.error(`\n${failed} failed`);
    process.exit(1);
}
console.log('\nall chinesepod matching checks passed');
