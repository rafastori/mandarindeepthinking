---
description: Evaluate and apply relevant skills before executing tasks
---
# Skill Evaluation Workflow

Sempre que iniciar uma nova tarefa complexa ou execução, você (a IA) DEVE seguir os passos abaixo para garantir as melhores práticas do repositório de skills:

1. **Identificar o Contexto:** Analise o código/tarefa atual e identifique quais tecnologias ou padrões estão envolvidos (Ex: Next.js, React, Tailwind, Firebase, UI/UX, Debugging).
2. **Buscar Skills Relevantes:** Verifique mentalmente ou busque na pasta `.agent/skills/` quais habilidades (skills) cobrem o contexto da tarefa. Se preciso, use o modo de visualização para ler as instruções da skill correspondente.
3. **Informar o Usuário:** Antes de rodar comandos ou modificar arquivos em larga escala, informe o usuário de maneira breve sobre quais skills específicas estão sendo levadas em consideração para aquela tarefa (Ex: "Vou aplicar as regras da skill `@react-best-practices` e `@typescript-expert` para refatorar este componente").
4. **Aplicar e Executar:** Prossiga com a execução (criação de arquivos, debugging, modificação de código) garantindo rigorosamente que as diretrizes das skills escolhidas estão sendo seguidas.
