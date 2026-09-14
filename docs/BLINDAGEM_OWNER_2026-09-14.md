# Blindagem do Fluxo Owner — UNI WEB

Data: 14/09/2026
Escopo: ambiente Owner homologado.
Status: BLINDADO.

## Baseline funcional protegida

A partir desta blindagem, o ambiente Owner deve preservar obrigatoriamente:

1. Isolamento Owner × Cliente e seleção explícita do cliente operado.
2. Retorno ao Owner sem logout e sem perda da identidade administrativa.
3. Painel Owner alimentado apenas por dados reais do backend.
4. Gestão de solicitações de acesso via fluxo administrativo protegido.
5. Oportunidades Owner com filtros funcionais e abertura no cliente correto.
6. Negócios, Inteligência, Habilitação, Documentos, Usuários, Relatórios e Configurações ligados aos respectivos dados reais.
7. Busca global funcional.
8. Notificações Owner baseadas em pendências e solicitações reais.
9. Ajuda ligada ao painel de IA.
10. Tema Claro/Escuro/Automático persistente.
11. Logo UNI como Home do ambiente atual.
12. Logout real e limpeza do contexto de tenant na saída.

## Regras de regressão

Qualquer alteração futura no Owner deve ser rejeitada se:

- substituir dados reais por valores demonstrativos;
- deixar botão, filtro, card acionável ou atalho sem ação correspondente;
- expuser UUID técnico como principal identificação visual quando houver nome/login disponível;
- quebrar a abertura direta do cliente/módulo/oportunidade;
- remover filtros homologados da página Oportunidades;
- permitir vazamento de dados entre tenants;
- alterar o visual-base aprovado sem autorização;
- quebrar a persistência do tema ou do menu lateral;
- eliminar registros de auditoria append-only;
- contornar RLS usando privilégios elevados no frontend.

## Controles técnicos verificados

- Vercel production deployment: READY.
- Next.js build: concluído.
- TypeScript: concluído sem erro.
- Runtime errors pós-deploy: nenhum encontrado.
- Aplicação pública: HTTP 200.
- `private.is_client_member()` mantém reconhecimento explícito do `platform_owner` ou membership de tenant.
- `private.is_platform_owner()` valida papel ativo `platform_owner`.
- Service Role não é exposta no frontend.

## Ressalvas conhecidas e aceitas

O Supabase Advisor registra:

- INFO: RLS habilitado sem policy em `company_access_requests`. A tabela permanece deliberadamente indisponível diretamente ao usuário e é operada pelo fluxo administrativo protegido.
- INFO: RLS habilitado sem policy em `tenant_reset_append_only_archive`. O arquivo histórico permanece deliberadamente fechado ao cliente.
- WARN: proteção nativa de senhas vazadas do Supabase Auth desativada. O UNI mantém política própria de senha forte no cadastro; ativação nativa dependerá da disponibilidade/configuração do plano Supabase.

Essas ressalvas não reabrem a homologação do Owner e não autorizam redução de segurança.

## Gate de continuidade

Fluxo Owner: HOMOLOGADO E BLINDADO.

A próxima etapa somente deve iniciar após confirmação do usuário. Até essa confirmação, alterações no Owner devem ser restritas a correções de regressão ou falhas observadas na homologação real.
