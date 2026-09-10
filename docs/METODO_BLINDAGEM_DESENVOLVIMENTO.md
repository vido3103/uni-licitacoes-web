# Método de Blindagem do Desenvolvimento

Status: vigente para o desenvolvimento do UNI Licitações Web enquanto o projeto permanecer na branch de integração.

## Objetivo

Reduzir falhas regressivas, inconsistências entre frontend, backend e documentação, e evitar que um ajuste pontual deixe dependências quebradas em outras partes do sistema. Cada mudança funcional deve ser validada de ponta a ponta e a documentação técnica deve permanecer sincronizada com o estado real da aplicação.

## Regra central

Nenhuma alteração é considerada concluída apenas porque compila, publica ou corrige o erro visível. Uma alteração só fecha após validação de cadeia completa: interface → autenticação → regras de tenant → RPC/Edge Function → banco/storage → persistência → retorno para a interface → comportamento de erro → documentação.

## Ciclo obrigatório por mudança

1. Definição do comportamento esperado e do impacto da mudança.
2. Mapeamento das dependências afetadas antes de editar.
3. Implementação isolada na branch de desenvolvimento.
4. Build e verificação de TypeScript.
5. Teste funcional do fluxo principal.
6. Teste de segurança e isolamento por tenant quando houver acesso a dados.
7. Teste de falha/contingência para operações externas, upload, download, RPC, fila e integrações.
8. Reauditoria das funções chamadas direta e indiretamente pela mudança.
9. Conferência de persistência e rastreabilidade no banco.
10. Atualização da documentação correspondente.
11. Registro do checkpoint no Git e só então encerramento da etapa.

## Blindagem de dependências

Ao alterar uma função, tabela, view, política RLS, Edge Function, RPC, enum, status ou contrato de dados, deve-se procurar todas as referências diretas e indiretas ao componente alterado. Helpers movidos de schema, nomes de colunas, estados de workflow e funções SECURITY DEFINER exigem revisão de toda a cadeia de chamadas antes do fechamento.

## Blindagem de frontend

A interface deve refletir o estado real do backend. Não usar dados demonstrativos em módulos já integrados. Nenhum erro técnico bruto como `[object Object]` deve ser mostrado ao usuário. Erros devem ser convertidos em mensagem legível, preservando o detalhe técnico para diagnóstico e auditoria.

## Blindagem de backend e segurança

Toda operação tenant-aware deve validar o usuário autenticado e sua associação ao cliente. Alterações em RPCs e funções encadeadas devem preservar RLS, helpers privados, privilégios e isolamento entre clientes. Quando possível, validar cenários positivo e negativo em transação com rollback.

## Blindagem de documentos

Fluxos de edital, TR, anexos e documentos corporativos devem manter identidade, origem, tenant, oportunidade, usuário, horário, status e caminho de armazenamento. Falha de download automático não significa ausência de documento. Quando a fonte oficial estiver disponível, manter o link, habilitar contingência de upload manual e continuar o fluxo sem reiniciar a análise.

## Blindagem de integrações externas

PNCP e demais fontes devem ter timeout, tratamento de erro, estado de contingência e comportamento idempotente. O sistema não deve perder a oportunidade ou invalidar uma triagem apenas porque uma integração externa falhou temporariamente.

## Blindagem de filas e análise

Antes de considerar um botão de análise funcional, validar que a ação realmente cria ou reutiliza a execução correta, preserva versões de Prompt Mestre, perfil e Playbook, vincula os documentos corretos, registra o estado da fila e apresenta retorno verificável na interface.

## Reauditoria contínua

Sempre que uma falha revelar uma dependência não mapeada, revisar funções irmãs, funções chamadoras e chamadas, migrations relacionadas e documentação técnica. A correção deve abranger a causa sistêmica, não apenas o ponto onde o erro apareceu.

## Documentação viva

Documentos de arquitetura, fluxo operacional, banco, integrações, segurança, módulos e checkpoints devem ser atualizados sempre que o comportamento real mudar. Documentação desatualizada é tratada como defeito de desenvolvimento.

## Critério de conclusão de módulo

Um módulo só pode ser classificado como funcionalmente concluído quando:

- build e TypeScript passam;
- fluxo principal foi executado com dados reais ou cenário controlado equivalente;
- erros e contingências foram testados;
- persistência foi conferida;
- isolamento por tenant foi validado quando aplicável;
- não há dependência conhecida quebrada;
- documentação foi atualizada;
- checkpoint foi registrado no Git;
- promoção para `main` continua sujeita a aprovação explícita.

## Aplicação imediata

O Radar e o fluxo de Triagem → Documentos → Análise Detalhada passam a ser o primeiro módulo submetido integralmente a este método. As falhas recentes em referências de helpers, triagem e upload entram como casos de teste regressivo obrigatórios para as próximas revisões.
