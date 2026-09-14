# Blindagem Final — Reestruturação UNI WEB

Data: 14/09/2026
Status: **BLINDAGEM CONCLUÍDA**

## 1. Escopo congelado

Esta blindagem encerra a fase de reestruturação do UNI WEB composta por:

1. Dashboard e hierarquia visual;
2. navegação e shell da aplicação;
3. experiência Owner e seleção de cliente;
4. jornada operacional de oportunidades;
5. Radar + Fale com a IA;
6. responsividade e acessibilidade;
7. configurações e linguagem de interface;
8. revisão de segurança, RLS e permissões;
9. auditoria de build e runtime em produção.

Mudanças futuras devem ser tratadas como nova frente evolutiva, sem reabrir esta baseline de forma implícita.

## 2. Invariantes protegidos

A partir desta blindagem, permanecem invariantes:

- isolamento de dados por cliente;
- acesso global somente para `platform_owner` ativo;
- Owner operando um cliente deve permanecer explicitamente identificado na interface;
- o usuário comum não pode trocar arbitrariamente de tenant/empresa;
- gates do método não podem ser contornados por controles de interface;
- Radar e IA devem atuar apenas no contexto do cliente resolvido;
- análise detalhada exige condições de triagem/documentação/seleção previstas no fluxo;
- piso mínimo de disputa não deve ficar abaixo do limite metodológico vigente;
- histórico de auditoria e históricos operacionais append-only permanecem protegidos;
- ações internas de manutenção não devem aparecer na interface normal do produto;
- dados demonstrativos não devem substituir dados reais em produção;
- alterações metodológicas futuras não podem mudar automaticamente Prompt Mestre v1.17 / Playbook v1.2 sem processo próprio de aprovação.

## 3. Proteções de interface

- navegação explícita por módulo;
- separação visual Owner × Cliente;
- modo Owner dentro do cliente sinalizado de forma persistente;
- Dashboard orientado por prioridade e prazo;
- linguagem técnica de infraestrutura removida da experiência normal;
- IA contextual integrada ao Radar por comandos operacionais controlados;
- responsividade preserva acesso às funções críticas em telas menores;
- foco de teclado e redução de movimento suportados;
- autenticação de nova empresa exige senha forte na interface.

## 4. Proteções de dados e backend

- RLS permanece ativo nas tabelas de dados de cliente;
- políticas de `client_settings` exigem associação ao cliente ou papel Owner;
- função de auditoria de configurações não é executável por PUBLIC/anon/authenticated;
- tabelas internas sem políticas de usuário permanecem em default-deny e são destinadas ao backend privilegiado;
- funções Edge sensíveis mantêm autenticação própria/JWT conforme o contrato existente;
- histórico append-only não foi relaxado para permitir rotinas administrativas;
- reset de tenant foi corrigido anteriormente para preservar o histórico imutável em vez de desativar a proteção.

## 5. Evidências de validação

Na auditoria imediatamente anterior à blindagem:

- deploy de produção em estado `READY`;
- domínio principal respondendo HTTP 200;
- sem erros de runtime agrupados na janela posterior ao deploy;
- sem logs de nível `error`/`fatal` na janela verificada;
- advisor de segurança sem alerta de função SECURITY DEFINER exposta;
- advisor de performance sem alerta de reavaliação de `auth.uid()` nas políticas corrigidas;
- build Vercel concluído com sucesso.

Documento de evidência complementar:

`docs/AUDITORIA_FINAL_REESTRUTURACAO_UNI_WEB_2026-09-14.md`

## 6. Ressalvas não bloqueantes

### Supabase Auth — leaked password protection

O projeto Supabase está no plano **Free**. O recurso nativo que consulta senhas vazadas no HaveIBeenPwned é disponibilizado pelo Supabase apenas no plano Pro ou superior. O código web foi reforçado para exigir senha de 12+ caracteres com maiúscula, minúscula, número e símbolo em novas solicitações.

Esta ressalva é classificada como **limitação de plano externo**, não bloqueio funcional da baseline.

### Índices sem uso observado

O advisor de performance informa índices ainda sem uso registrado. Eles não foram removidos porque o projeto tem histórico operacional curto e vários índices sustentam FKs, filas e caminhos ainda pouco acionados. Removê-los com base apenas em estatística inicial poderia degradar a plataforma quando o volume crescer.

Classificação: **manter e reavaliar após histórico real de uso**.

## 7. Regra de mudança após blindagem

Qualquer mudança futura que toque autenticação, RLS, Owner, seleção de cliente, gates, Radar, IA operacional, disputa ou histórico de auditoria deve passar por:

1. análise de impacto;
2. implementação rastreável em Git;
3. build/deploy validado;
4. verificação de runtime;
5. advisors de segurança/performance quando houver mudança de banco;
6. atualização da documentação de baseline se a mudança for estrutural.

## 8. Baseline blindada

Baseline funcional da reestruturação encerrada em 14/09/2026.

Produção principal:

`https://uni-licitacoes-web.vercel.app`

Resultado final desta fase:

**APROVADO E BLINDADO PARA HOMOLOGAÇÃO OPERACIONAL.**
