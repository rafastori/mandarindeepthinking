---
description: Evaluate and apply relevant skills before executing tasks
---
# Skill Evaluation Workflow

Sempre que iniciar uma nova tarefa complexa ou execução, você (a IA) DEVE seguir os passos abaixo para garantir as melhores práticas do repositório de skills:

1. **Identificar o Contexto:** Analise o código/tarefa atual e identifique quais tecnologias ou padrões estão envolvidos (Ex: Next.js, React, Tailwind, Firebase, UI/UX, Debugging).
2. **Atalho de Skills Mais Usadas (Default):** Por padrão, para a maioria das tarefas no projeto, considere pré-ativadas e aplique as seguintes skills principais (mesmo que não explicitamente solicitadas), pois são a base do projeto:
   - **`@react-best-practices` / `@react-expert`**: Para criação e refatoração de componentes, hooks e gerenciamento de estado.
   - **`@typescript-expert`**: Para tipagem rigorosa, interfaces e types (como no `types.ts`).
   - **`@tailwind-expert` / `@ui-ux-expert`**: Para estilização, layout responsivo e correção de overflow (frequente em telas pequenas).
   - **`@debugging-expert`**: Para resolução de erros de API ou falhas lógicas.
   *(Nota: Deixe claro que outras skills podem e devem ser utilizadas dependendo da especificidade do que for utilizado no projeto, mas estas geralmente são as mais usadas).*
3. **Buscar Skills Específicas Adicionais:** Verifique mentalmente ou busque na pasta `.agent/skills/` quais outras habilidades (skills) cobrem o contexto específico da tarefa. Se preciso, use o modo de visualização para ler as instruções da skill correspondente.
4. **Informar o Usuário:** Antes de rodar comandos ou modificar arquivos em larga escala, informe o usuário de maneira breve sobre quais skills específicas (além do atalho padrão) estão sendo levadas em consideração para aquela tarefa.
5. **Aplicar e Executar:** Prossiga com a execução (criação de arquivos, debugging, modificação de código) garantindo rigorosamente que as diretrizes das skills escolhidas estão sendo seguidas.
