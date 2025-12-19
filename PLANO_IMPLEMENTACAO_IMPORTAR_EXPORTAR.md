# Plano de Implementação: Exportar e Importar Dados

Este documento descreve a estratégia técnica para implementar a funcionalidade de backup (exportação) e restauração (importação) dos dados de estudo do usuário (`StudyItem`) no MandarinDeepThinking.

## 1. Visão Geral
O objetivo é permitir que o usuário baixe um arquivo JSON contendo todo o seu histórico de itens de estudo e, posteriormente, possa restaurar esses dados via upload. Isso serve como mecanismo de backup pessoal e migração de dados.

## 2. Estrutura de Dados
O arquivo exportado deverá ser um JSON com o seguinte formato base:

```json
{
  "minVer": "1.0.0",
  "exportedAt": "2023-10-27T10:00:00.000Z",
  "userId": "user_id_ref",
  "itemCount": 150,
  "data": [
    {
      "chinese": "你好",
      "pinyin": "nǐ hǎo",
      "translation": "Olá",
      "language": "zh",
      "type": "word",
      "keywords": [...],
      "tokens": [...],
      "createdAt": "timestamp...",
      "originalSentence": "..."
    },
    ...
  ]
}
```

> **Nota:** O campo `id` do Firestore pode ser exportado para referência, mas na importação, idealmente, cria-se novos IDs ou verifica-se duplicação baseada no conteúdo (ex: `chinese` + `translation`).

## 3. Fluxo de Implementação

### 3.1. Hook de Gerenciamento (`useDataMigration.ts`)
Criar um novo hook ou estender `useStudyItems.ts` para conter a lógica de processamento.

#### Exportação (`exportData`)
1.  Buscar todos os documentos da coleção `users/{uid}/items`.
2.  Mapear os dados removendo referências internas sensíveis ou desnecessárias.
3.  Gerar objeto JSON com metadados (data, versão).
4.  Criar um `Blob` e disparar download automático via âncora `<a>` temporária.

#### Importação (`importData`)
1.  Receber o arquivo do input `type="file"`.
2.  Ler conteúdo via `FileReader`.
3.  Validar se é um JSON válido e se possui a estrutura esperada (`schema validation` básico).
4.  **Estratégia de Escrita:**
    *   *Opção A (Merge):* Percorrer itens e adicionar apenas se não existirem (pode ser custoso verificar um a um).
    *   *Opção B (Append):* Adicionar tudo como novos itens (mais simples, risco de duplicatas).
    *   *Opção C (Overwrite):* Limpar biblioteca atual (usando `clearLibrary`) e inserir os novos. **(Recomendado oferecer escolha ao usuário)**.
5.  Usar `writeBatch` do Firestore para inserção em lote (limite de 500 operações por batch).

### 3.2. Interface do Usuário (UI)
Adicionar opções no `UserMenuDropdown.tsx` ou criar uma modal de "Configurações de Dados".

*   **Botão "Exportar Backup":** Ícone de download. Feedback visual de "Gerando arquivo...".
*   **Botão "Importar Backup":** Ícone de upload.
    *   Ao selecionar arquivo, mostrar resumo: "Arquivo de 25/12/2023 com 500 itens".
    *   Botões de Ação: "Adicionar aos Atuais" ou "Substituir Tudo".

## 4. Detalhes Técnicos e Segurança

### Validação
Ao importar, verificar se cada item possui os campos obrigatórios (`chinese`, `translation`, `language`). Ignorar itens corrompidos para não quebrar a aplicação.

### Performance
Para bibliotecas muito grandes (>1000 itens), a importação deve ser feita em pedaços (chunks) para não bloquear a UI e respeitar os limites do Firestore Batch.

### Exemplo de Código (Skeleton)

```typescript
// Exemplo de função de exportação
const handleExport = async () => {
  const data = items.map(item => ({ ...item })); // Clean data
  const payload = {
    version: 1,
    date: new Date().toISOString(),
    data
  };
  
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-mandarin-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
};
```

## 5. Próximos Passos
1.  Implementar `exportData` em `useStudyItems.ts` (ou novo hook).
2.  Criar componente de UI para acionar as ações.
3.  Implementar `importData` com leitura de arquivo e `batch` write.
4.  Testar com volumes variados de dados.
