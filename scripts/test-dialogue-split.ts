/**
 * Testes do split de diálogos longos em subpastas.
 * Executar: npx tsx scripts/test-dialogue-split.ts
 */
import {
    applyChunkAudioOffset,
    allocateAudioRanges,
    buildSplitPreview,
    DEFAULT_TURNS_PER_FOLDER,
    extractDialogueTurns,
    folderPrefix,
    isLargeImportText,
    makeSubfolderName,
    packTurns,
} from '../utils/dialogueSplit';

const SAMPLE = `A: Salve. Posso chiedere, è questo il Dipartimento di Esami Medici dell'Ospedale Huamei?
B: Sì. Posso chiedere, c'è qualcosa in cui posso aiutarla?
A: Avete esami medici per l'ingresso al lavoro qui?
B: Sì. Abbiamo un pacchetto che costa 260 yuan.
A: Quali particolari esaminerà?
B: L'altezza, il peso e la pressione sanguigna di base.
A: Se volessi anche far controllare altri particolari, posso farlo?
B: Sì, può. Può aggiungere singoli elementi.
A: Il referto verrà spedito direttamente al lavoro?
B: No, spetta alla persona andarlo a ritirare.
A: Lo fissi per lunedì prossimo.
B: Ok. Per favore, lasci le sue informazioni di base.`;

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

function run() {
    console.log('extractDialogueTurns');
    const turns = extractDialogueTurns(SAMPLE);
    assert('12 falas A/B', turns.length === 12);
    assert('primeira é A', turns[0].startsWith('A:'));
    assert('última é B', turns[11].startsWith('B:'));

    const long = Array.from({ length: 20 }, (_, i) => SAMPLE.replaceAll('A:', `A${i}:`).replaceAll('B:', `B${i}:`)).join('\n');
    const longTurns = extractDialogueTurns(long);
    assert('20 cópias ≈ 240 falas', longTurns.length === 240);
    assert('texto longo dispara split', isLargeImportText(long) === true);
    assert('aula curta não dispara', isLargeImportText(SAMPLE) === false);

    console.log('pack / nomes');
    const packed = packTurns(longTurns, DEFAULT_TURNS_PER_FOLDER);
    assert('20 pastas com 12 falas', packed.length === 20 && packed.every(g => g.length === 12));
    assert('prefixo NLM', folderPrefix('Curso/NLM') === 'NLM');
    assert('NLM01', makeSubfolderName('NLM', 0, 20) === 'NLM01');
    assert('NLM20', makeSubfolderName('NLM', 19, 20) === 'NLM20');
    assert('3 dígitos se >= 100', makeSubfolderName('NLM', 0, 100) === 'NLM001');

    console.log('buildSplitPreview');
    const preview = buildSplitPreview(long, 'NLM', 12);
    assert('paths NLM/NLM01', preview[0].folderPath === 'NLM/NLM01');
    assert('último NLM/NLM20', preview[19].folderPath === 'NLM/NLM20');
    assert('texto concatenado', preview[0].text.includes('A0:') && preview[0].turnCount === 12);

    console.log('áudio proporcional');
    const ranged = allocateAudioRanges(
        [{ charCount: 100 }, { charCount: 300 }, { charCount: 100 }],
        100
    );
    assert('primeiro começa em 0', ranged[0].audioStart === 0);
    assert('último termina na duração', ranged[2].audioEnd === 100);
    assert('meio leva 60%', Math.abs(ranged[1].audioEnd - ranged[1].audioStart - 60) < 0.01);

    const offset = applyChunkAudioOffset(
        [{ audioStart: 0, audioEnd: 10 }, { translation: 'sem tempo' } as { audioStart?: number; audioEnd?: number; translation?: string }],
        40,
        70
    );
    assert('offset soma o início do chunk', offset[0].audioStart === 40 && offset[0].audioEnd === 50);
    assert('sem tempo herda o trecho', offset[1].audioStart === 40 && offset[1].audioEnd === 70);

    const leftover = packTurns(['a', 'b', 'c'], 12);
    assert('menos falas que o pacote = 1 pasta', leftover.length === 1 && leftover[0].length === 3);

    console.log(`\n${passed} ok, ${failed} falhas`);
    if (failed > 0) process.exit(1);
}

run();
