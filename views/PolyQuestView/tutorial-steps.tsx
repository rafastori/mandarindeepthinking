import React from 'react';
import Icon from '../../components/Icon';
import BossSprite from './components/BossSprite';
import { BOSSES, RULES } from './rules';
import { PLAYER_CLASSES } from './types';

export interface TutorialStep {
    title: string;
    subtitle?: string;
    chapter: string;        // ex.: "Visão geral", "Fase 1"
    body: React.ReactNode;
    visual?: React.ReactNode;   // ilustração no topo
    tip?: React.ReactNode;      // dica destacada no rodapé
    accent?: 'gold' | 'rose' | 'emerald' | 'violet' | 'sky';
}

// Mocks visuais reutilizados dentro dos slides
const QuestCardMock: React.FC<{ word: string; locked?: boolean; resolved?: boolean; needsHelp?: boolean }> = ({ word, locked, resolved, needsHelp }) => (
    <div className={`relative rounded-2xl border-2 p-3 min-h-[100px] w-32 flex flex-col items-center justify-center gap-1 ${
        resolved ? 'bg-emerald-500/15 border-emerald-400/40' :
        needsHelp ? 'bg-rose-500/20 border-rose-400 border-dashed animate-pulse' :
        'bg-white/5 border-white/15'
    }`}>
        {needsHelp && <Icon name="life-buoy" size={14} className="absolute top-2 right-2 text-rose-300" />}
        <Icon name={resolved ? 'check' : 'lock'} size={20} className={resolved ? 'text-emerald-300' : 'text-white/40'} />
        <span className="font-bold text-sm text-white">{word}</span>
        <span className="text-[9px] text-white/50 uppercase tracking-wider">
            {resolved ? 'pronto' : needsHelp ? 'sos!' : locked ? 'travado' : 'tocar'}
        </span>
    </div>
);

const SfxButton: React.FC<{ icon: string; label: string; sub?: string; color: string }> = ({ icon, label, sub, color }) => (
    <div className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border ${color} bg-white/5`}>
        <Icon name={icon} size={14} />
        <span className="text-[10px] font-bold">{label}</span>
        {sub && <span className="text-[9px] opacity-70">{sub}</span>}
    </div>
);

const dragonBoss = BOSSES.find(b => b.sprite === 'dragon')!;
const lichBoss = BOSSES.find(b => b.sprite === 'lich')!;

const ComboMock: React.FC<{ count: number; mult: number; hot?: boolean }> = ({ count, mult, hot }) => (
    <div className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-white shadow-md ${hot ? 'bg-gradient-to-br from-orange-500 to-rose-600' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}>
        <span className="text-lg font-black leading-none">×{mult.toFixed(mult === Math.floor(mult) ? 0 : 2)}</span>
        <span className="text-[8px] uppercase tracking-wider opacity-80 font-bold">{count} acertos</span>
    </div>
);

export const TUTORIAL_STEPS: TutorialStep[] = [
    // ───────────────────────────────────────────────
    {
        chapter: 'Visão geral',
        title: 'Bem-vindo ao PolyQuest',
        subtitle: 'Um RPG cooperativo de idiomas',
        accent: 'gold',
        visual: (
            <div className="flex items-end justify-center gap-3 h-32">
                <div className="text-5xl animate-bounce">🧙</div>
                <div className="text-5xl animate-bounce" style={{ animationDelay: '0.1s' }}>🎵</div>
                <div className="text-5xl animate-bounce" style={{ animationDelay: '0.2s' }}>⚔️</div>
            </div>
        ),
        body: (
            <p>
                Você e sua party (até <b className="text-amber-300">6 jogadores</b>) entram em uma masmorra
                de palavras estrangeiras. O objetivo: <b>decifrar o texto</b>, sobreviver às surpresas e
                derrotar o <b className="text-rose-300">Boss Final</b> que tenta impedir o aprendizado.
            </p>
        ),
        tip: 'Tudo é cooperativo: a vida é compartilhada, mas a pontuação é individual.',
    },
    // ───────────────────────────────────────────────
    {
        chapter: 'Como entrar',
        title: 'Crie ou entre em uma sala',
        accent: 'sky',
        visual: (
            <div className="flex items-center justify-center gap-3">
                <div className="bg-white/10 border border-white/20 rounded-2xl p-3 w-40">
                    <div className="flex items-center gap-2 mb-1">
                        <Icon name="users" size={14} className="text-sky-300" />
                        <span className="text-xs font-bold text-white">Sala da Aurora</span>
                    </div>
                    <div className="text-[10px] text-white/60">de → pt · Iniciante</div>
                    <div className="flex gap-1 mt-1.5">
                        {['🧑', '👩', '👨'].map((e, i) => <span key={i} className="text-base">{e}</span>)}
                    </div>
                </div>
                <Icon name="arrow-right" size={22} className="text-amber-300" />
                <div className="bg-amber-400/20 border-2 border-amber-400 rounded-2xl px-3 py-4 text-center">
                    <Icon name="lock-open" size={20} className="text-amber-300 mx-auto mb-1" />
                    <span className="text-xs font-bold text-amber-200">Entrar</span>
                </div>
            </div>
        ),
        body: (
            <p>
                Na tela inicial, escolha <b>Criar Sala</b> (você vira o líder, define idioma, dificuldade
                e a fonte do texto) ou <b>Entrar</b> em uma sala aberta de outro jogador.
            </p>
        ),
        tip: 'O texto pode vir da sua biblioteca pessoal ou ser gerado pela IA.',
    },
    // ───────────────────────────────────────────────
    {
        chapter: 'Preparação',
        title: 'Escolha sua classe',
        subtitle: 'Cada classe tem um perk único com cooldown',
        accent: 'violet',
        visual: (
            <div className="grid grid-cols-3 gap-2">
                {PLAYER_CLASSES.map(cls => (
                    <div
                        key={cls.id}
                        className="rounded-xl border-2 p-2 text-center"
                        style={{ borderColor: cls.color, backgroundColor: `${cls.color}26` }}
                    >
                        <div className="text-3xl mb-1">{cls.icon}</div>
                        <div className="text-xs font-black" style={{ color: cls.color }}>{cls.name}</div>
                    </div>
                ))}
            </div>
        ),
        body: (
            <div className="space-y-1.5 text-sm">
                {PLAYER_CLASSES.map(cls => (
                    <div key={cls.id}>
                        <span className="text-base mr-1.5">{cls.icon}</span>
                        <b style={{ color: cls.color }}>{cls.name}</b> — {cls.perkDesc}
                    </div>
                ))}
            </div>
        ),
        tip: 'Coordenem as classes! Em uma party diversificada, cada perk se complementa.',
    },
    // ───────────────────────────────────────────────
    {
        chapter: 'Fase 1',
        title: 'Exploração',
        subtitle: 'Mapeiem o terreno coletivamente',
        accent: 'emerald',
        visual: (
            <div className="bg-black/30 rounded-xl p-3 text-base leading-relaxed border border-white/10">
                Hoje vou{' '}
                <span className="bg-amber-400 text-slate-900 font-bold px-1 rounded">aprender</span>{' '}
                a{' '}
                <span className="bg-amber-400 text-slate-900 font-bold px-1 rounded">conjugar</span>{' '}
                verbos em alemão...
            </div>
        ),
        body: (
            <p>
                O texto inteiro aparece. <b className="text-amber-300">Toquem</b> nas palavras que vocês
                <b> não conhecem</b>. As escolhas aparecem para todos em tempo real e formam a lista de enigmas
                da próxima fase.
            </p>
        ),
        tip: 'Quanto mais palavras escolherem, maior a quest — mas também mais XP a ganhar.',
    },
    // ───────────────────────────────────────────────
    {
        chapter: 'Fase 2',
        title: 'A Quest',
        subtitle: 'Cada palavra vira uma carta',
        accent: 'gold',
        visual: (
            <div className="flex justify-center gap-2">
                <QuestCardMock word="aprender" />
                <QuestCardMock word="conjugar" resolved />
                <QuestCardMock word="verbos" needsHelp />
            </div>
        ),
        body: (
            <p>
                Toque numa carta para tentar resolvê-la. Você verá <b>4 alternativas</b> de tradução —
                escolha a correta. Acerto: <b className="text-amber-300">+10 pts</b> e a carta vira ✓ verde.
                Erro: <b className="text-rose-300">-{RULES.WRONG_DAMAGE} HP da party</b>.
            </p>
        ),
        tip: 'Quando outro jogador está em uma carta, você vê a foto/cor dele bloqueando.',
    },
    // ───────────────────────────────────────────────
    {
        chapter: 'Fase 2',
        title: 'SOS, Dica e Eliminar',
        subtitle: 'Ferramentas dentro da carta aberta',
        accent: 'rose',
        visual: (
            <div className="flex justify-center gap-2">
                <SfxButton icon="life-buoy" label="SOS" sub="grátis" color="border-rose-400/50 text-rose-300" />
                <SfxButton icon="sun" label="Dica" sub={`-${RULES.HINT_COST} HP`} color="border-amber-400/50 text-amber-300" />
                <SfxButton icon="x-circle" label="Eliminar" sub={`-${RULES.ELIMINATE_COST} HP`} color="border-sky-400/50 text-sky-300" />
            </div>
        ),
        body: (
            <div className="space-y-2 text-sm">
                <p><b className="text-rose-300">SOS</b> — passa a carta para outro jogador. Se ele acertar, ganha {RULES.HELP_GIVEN_POINTS} pts e você recebe um <b>sinônimo</b> pra tentar de novo.</p>
                <p><b className="text-amber-300">Dica</b> — revela o sinônimo direto (custa {RULES.HINT_COST} HP da party).</p>
                <p><b className="text-sky-300">Eliminar</b> — remove 2 alternativas erradas (custa {RULES.ELIMINATE_COST} HP).</p>
            </div>
        ),
        tip: 'O HP é compartilhado: usem com cuidado se a barra estiver baixa.',
    },
    // ───────────────────────────────────────────────
    {
        chapter: 'Fase 2',
        title: 'Combo da Party',
        subtitle: 'Acertos em sequência viram multiplicador',
        accent: 'rose',
        visual: (
            <div className="flex items-end justify-center gap-3">
                <ComboMock count={2} mult={1.0} />
                <Icon name="arrow-right" size={20} className="text-white/50" />
                <ComboMock count={3} mult={1.25} hot />
                <Icon name="arrow-right" size={20} className="text-white/50" />
                <ComboMock count={5} mult={1.5} hot />
                <Icon name="arrow-right" size={20} className="text-white/50" />
                <ComboMock count={8} mult={2.0} hot />
            </div>
        ),
        body: (
            <p>
                Acertos consecutivos da <b>party inteira</b> formam um combo. O multiplicador escala em
                <b className="text-amber-300"> 3, 5 e 8 acertos</b>, podendo dobrar seus pontos. Tem <b>{RULES.COMBO_TIMEOUT_MS / 1000}s</b>{' '}
                entre acertos pra manter o combo vivo.
            </p>
        ),
        tip: 'Errar zera o combo. Pensem antes de chutar quando estiver alto.',
    },
    // ───────────────────────────────────────────────
    {
        chapter: 'Evento especial',
        title: 'O Intruso',
        subtitle: 'Aos 50% das palavras decifradas, o caos chega',
        accent: 'rose',
        visual: (
            <div className="bg-rose-500/20 border-2 border-rose-500 border-dashed rounded-xl p-3 animate-pulse">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <Icon name="alert-triangle" size={18} className="text-amber-300" />
                    <span className="text-xs font-black text-amber-300 uppercase tracking-widest">Desafio do Intruso</span>
                </div>
                <p className="text-xs text-white/80 text-center">
                    Hoje vou aprender a <b className="text-amber-300 underline decoration-wavy">smartphone</b> verbos…
                </p>
            </div>
        ),
        body: (
            <p>
                Sem aviso, o jogo pausa: a IA inseriu uma <b className="text-rose-300">palavra falsa</b>{' '}
                no texto. Vocês têm <b>{RULES.INTRUDER_TIMEOUT_MS / 1000}s</b> para clicar nela.
                Acerto: <b className="text-emerald-300">+{RULES.INTRUDER_POINTS} pts e +{RULES.INTRUDER_HEAL} HP</b>.
                Erro/timeout: <b className="text-rose-300">-{RULES.INTRUDER_FAIL_DAMAGE} HP</b>.
            </p>
        ),
        tip: 'A palavra costuma destoar do tema (ex.: "smartphone" num texto medieval).',
    },
    // ───────────────────────────────────────────────
    {
        chapter: 'Fase 3',
        title: 'O Boss Final',
        subtitle: 'Quando todas as palavras forem decifradas',
        accent: 'violet',
        visual: (
            <div className="flex items-center justify-center">
                <BossSprite boss={lichBoss} state="idle" size={130} />
            </div>
        ),
        body: (
            <p>
                Um boss único aparece (escolhido aleatoriamente entre 4: Lich, Dragão, Sombra, Oráculo).
                Ele tem <b>HP próprio</b> que escala com o tamanho da party. Vocês precisam <b>reconstruir
                uma frase embaralhada</b> arrastando blocos para vencer.
            </p>
        ),
        tip: 'Cada boss tem um estilo de fala próprio. Prestem atenção nos taunts!',
    },
    // ───────────────────────────────────────────────
    {
        chapter: 'Fase 3',
        title: 'O Boss ataca',
        subtitle: `A cada ${RULES.BOSS_ATTACK_INTERVAL_MS / 1000}s, ele dá um golpe na party`,
        accent: 'rose',
        visual: (
            <div className="flex items-center justify-center gap-4">
                <BossSprite boss={dragonBoss} state="wounded" size={100} isAttacking />
                <div className="text-center">
                    <Icon name="clock" size={24} className="text-rose-400 animate-pulse mx-auto" />
                    <div className="text-2xl font-mono font-black text-rose-400 leading-none">5s</div>
                    <div className="text-[9px] uppercase tracking-widest text-white/50 font-bold">próximo ataque</div>
                </div>
            </div>
        ),
        body: (
            <p>
                Atenção ao timer: o boss desfere ataques em intervalos. Cliquem nos blocos para montar a
                frase, arrastem para reordenar e <b className="text-amber-300">ATAQUEM</b> antes do tempo
                acabar. Frase certa = boss morre. Frase errada = vocês tomam dano.
            </p>
        ),
        tip: 'Guerreiros podem usar Investida pra dar -25 HP direto no boss sem precisar montar a frase.',
    },
    // ───────────────────────────────────────────────
    {
        chapter: 'Final',
        title: 'Vitória ou Derrota',
        accent: 'gold',
        visual: (
            <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center mb-1">
                        <Icon name="crown" size={28} className="text-amber-300" />
                    </div>
                    <span className="text-xs font-black text-amber-300">VITÓRIA</span>
                </div>
                <span className="text-white/30 text-2xl">/</span>
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-rose-900/40 border-2 border-rose-500 flex items-center justify-center mb-1">
                        <Icon name="skull" size={28} className="text-rose-400" />
                    </div>
                    <span className="text-xs font-black text-rose-400">DERROTA</span>
                </div>
            </div>
        ),
        body: (
            <p>
                <b className="text-amber-300">Vitória:</b> +{RULES.BOSS_VICTORY_POINTS} pts pra todos, podium dos
                melhores e biblioteca da missão pra salvar as palavras nos seus estudos.<br />
                <b className="text-rose-400">Derrota:</b> a party caiu. Você ainda mantém os pontos ganhos e
                pode tentar de novo.
            </p>
        ),
        tip: 'Toda partida fica registrada no seu histórico (LVL = soma de todos os pontos).',
    },
    // ───────────────────────────────────────────────
    {
        chapter: 'Pronto!',
        title: 'Boa caçada, aventureiro',
        subtitle: 'Você pode rever este tutorial a qualquer momento',
        accent: 'gold',
        visual: (
            <div className="flex flex-col items-center gap-2">
                <Icon name="help-circle" size={48} className="text-amber-300" />
                <span className="text-xs text-white/60 italic">Botão no canto superior direito</span>
            </div>
        ),
        body: (
            <p>
                Quando precisar revisar regras ou esclarecer dúvidas, clique no <b className="text-amber-300">?</b>{' '}
                no canto superior direito da tela do PolyQuest. Que comece a aventura!
            </p>
        ),
    },
];
