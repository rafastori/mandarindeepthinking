Dominó Mexicano - Plano de Implementação Final
Jogo estilo Mexican Train adaptado para aprendizado de idiomas e termos técnicos.

Mecânica de Peças
Geração do Deck
IA gera 13 termos únicos (equivalente a 0-12) + suas traduções/definições
Sistema gera 91 peças com todas as combinações possíveis
Cada peça: Termo_X | Tradução_Y (onde X ≠ Y, exceto nas duplas)
Conexão de Peças
[Hund|Gato] ←→ [Katze|Trabalho] ←→ [Arbeit|Cão] ←→ [Hund|...]
     ↑              ↑                    ↑
    "Gato" = tradução de "Katze" ←───────┘
Regras
2-6 jogadores (15 peças p/ 2-4, 12 peças p/ 5-6)
Hub central: Peça dupla pré-selecionada (ex: Hund|Cão)
Trens pessoais + Trem Mexicano (comunal)
Automações: compra, marcação "aberto", passagem de turno
Vitória: Primeiro sem peças (ou menos peças se travado)
Proposed Changes
[Phase 1: Types]
[NEW] 
views/DominoView/types.ts
DominoContext: 'language' | 'medicine' | 'computing' | 'engineering' | 'chemistry' | 'biology' | 'law' | 'custom'
DominoPiece: { id, termIndex, definitionIndex, termText, definitionText, isHub }
DominoRoom: { players, trains, boneyard, hubPiece, currentTurn, config }
[Phase 2: Hook & AI]
[NEW] 
views/DominoView/hooks/useDominoRoom.ts
Adaptado de 
usePolyQuestRoom
: createRoom, joinRoom, startGame, placePiece, autoDrawAndPlay

[MODIFY] 
services/gemini.ts
Nova função generateDominoTerms(context, config) → retorna 13 pares { term, definition }

[MODIFY] 
api/generate.js
Novo handler type === 'domino_terms'

[Phase 3: Components]
Componente	Função
DominoView/index.tsx	Fluxo principal
DominoLobby.tsx	Config: contexto, idiomas, dificuldade
GameBoard.tsx	Hub + trens radiando
DominoPiece.tsx	Visual da peça
PlayerHand.tsx	Mão do jogador
Verificação
Gerar 13 termos para diferentes contextos
Validar geração das 91 combinações
Testar mecânica de trens e conexões
Multiplayer com 2-6 jogadores
