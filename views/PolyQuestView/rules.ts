export const OFFICIAL_RULES = `
PolyGlot Quest: Manual Oficial de Regras

1. Visão Geral
PolyGlot Quest é um jogo multiplayer de aprendizado de idiomas que mistura cooperação estratégica com competição saudável. O grupo atua como uma equipe de linguistas tentando decifrar um texto estrangeiro sem perder a "Confiança" (vida), enquanto indivíduos tentam se destacar como o Mestre Poliglota.

2. Preparação (Lobby)
- Papéis: Um Host (cria a sala) e Guests (entram na sala).
- Configuração: O Host define o idioma de origem (ex: Alemão), o idioma de destino (ex: Português) e insere o texto base (mínimo de 40 palavras).
- Start: O jogo só inicia quando todos os jogadores marcarem o botão "Estou Pronto".

3. Fase 1: Exploração e Seleção
- Objetivo: Mapear o terreno. O texto completo é exibido na tela.
- Dinâmica: Os jogadores clicam nas palavras que não conhecem.
- Sincronia: Quando um jogador marca uma palavra, ela fica destacada para todos.
- Resultado: Cria-se coletivamente uma lista lateral de "Enigmas" (palavras a serem traduzidas).

4. Fase 2: A Quest (Gameplay Principal)
O texto original é ocultado. As palavras selecionadas viram "Cartas de Enigma".

❤️ Mecânica de Sobrevivência: Barra de Confiança
- O grupo compartilha uma única Barra de Vida (Confiança) que inicia em 100%.
- Erro: Qualquer erro individual reduz a barra em -15%.
- Derrota: Se a barra chegar a 0%, a missão falha (Game Over).

⚖️ Mecânica de Equilíbrio: "Fadiga Tática"
- Para evitar que um único jogador domine a partida: Se um jogador acertar 2 palavras consecutivas, ele entra em estado de Fadiga.
- Efeito: O jogador fica bloqueado de clicar em novos enigmas por 10 segundos. Ele deve usar esse tempo para ajudar os outros via chat ou áudio.

🤝 Mecânica Central: Assistência e "Scaffolding"
Incentiva o aprendizado real em vez do chute.
- O Pedido (SOS): Um jogador clica em "Pedir Ajuda". A carta brilha em vermelho para os outros.
- O Resgate: Outro jogador (Salvador) clica na carta e seleciona a tradução correta.
  * Recompensa Imediata: O Salvador ganha +5 Pontos (Altruísmo).
- O Retorno (Sinônimo): A carta volta para o jogador original, mas agora exibe um Sinônimo ou Definição da palavra (dada pela IA), e não a resposta direta.
- A Conclusão:
  * Se o jogador original acertar com a ajuda do sinônimo: Ganha +5 Pontos (Aprendizado).
  * Se precisar de ajuda novamente: Pode pedir, mas o prêmio cai para +3 Pontos.

🕵️ Evento de Meio de Jogo: "O Desafio do Intruso"
- Gatilho: Ativa automaticamente quando 50% das palavras forem descobertas.
- O Evento: O jogo pausa. Uma janela explica que uma palavra falsa foi inserida no texto pela IA. Todos devem clicar em "Aceitar Desafio".
- A Caçada: O texto reaparece com uma palavra intrusa (ex: "microondas" em um texto medieval).
- Prêmio: O primeiro a encontrar e denunciar a palavra ganha +20 Pontos. O grupo ganha +1 Vida Extra (ou Pulo de Nível).

⚖️ Recurso Extra: Tribunal Gramatical
- Se uma palavra gerar dúvida, os jogadores podem marcá-la para "Julgamento".
- O jogo pausa e abre uma votação democrática entre as opções de tradução.
- Se a maioria acertar, o grupo ganha bônus de XP. Se errar, recebem um feedback educativo com a porcentagem de erro.

💬 Interação Social
- Quick Chat: Botões de reação rápida com frases no idioma de destino (ex: "Bom trabalho!", "Espere!").
- Combo de Revezamento: Se jogadores diferentes acertarem em sequência, o multiplicador de pontos do grupo aumenta.

5. Fase 3: O Boss Final (Reconstrução)
O jogo não acaba quando as cartas terminam.
- O Desafio: A IA seleciona a frase mais complexa do texto e a desmonta em blocos embaralhados.
- Ação: Todos os jogadores, simultaneamente, arrastam os blocos para uma linha do tempo central para reconstruir a frase.
- Verificação:
  * Acerto: Vitória Gloriosa (+50 pontos para todos).
  * Erro: Dano massivo na barra de vida (-20%).

6. Sistema de Pontuação (Resumo)
| Ação | Pontos | Quem Ganha |
|---|---|---|
| Acerto Solo | +10 | Jogador |
| Salvador (Respondeu SOS) | +5 | Jogador que ajudou |
| Aprendiz (Acertou com Sinônimo) | +5 | Jogador que pediu |
| Aprendiz (2ª tentativa) | +3 | Jogador que pediu |
| Encontrar o Intruso | +20 | Jogador (+Bônus Grupo) |
| Vitória no Boss | +50 | Todos |
| Erro | -15% Vida | Dano no Grupo |

7. Encerramento
- Tela de Vitória: Ranking final destacando o "Mestre Poliglota" (Maior Pontuação) e o "MVP Colaborativo" (Mais ajudas).
- Biblioteca: Opção de salvar todas as palavras e frases aprendidas para estudo futuro.

8 Adicionais a lógica:
- na sala de colaboração a pontuação individual também deve ser mostrada em tempo real para todos os jogadores - okk.
- adicionar o botão de ver o texto original - OKKK
- salvar o resultado final do jogo no banco de dados. Deixar salva a prontuação individual de cada jogador para que possa ser usada como histórico e ranking. toda vez que um usuário entrar no jogo ele mostrará qual é o seu nível em pontuação geral somada de todas as partidas - OK.
- fazer com que os dados salvos da bliblioteca da missão entrem no banco de dados da leitura, revisão como se fosse uma importação nativa - OK.
- o idioma de estudo é o primeiro idioma selecionado pelo usuário, logo no final do jogo ele mostrará qual é o seu nível em pontuação geral somada de todas as partidas e da partida atual - OK. 
- Missão Cumprida! A equipe dominou o idioma "DEVE SER O IDIOMA SELECIONADO PELO USUARIO" com as 40 palavras, é o idioma do texto original que deverá ser traduzido para o idioma que o usuário já sabe - OK.
- vamos trabalhar agora com a parte de segurança, preciso fazer o deploy para a vercel, porém a chave deve estar nas variáveis de ambiente da vercel, em anexo estou enviando como configurei, você poderia verificar e fazer o plano de migração de API local para a API escondida nas variáveis da vercel?
`;
