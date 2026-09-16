# Homologação Profunda — Owner / Clientes

Data: 16/09/2026
Status: APROVADO E BLINDADO

## Validação
A página **Clientes** do ambiente Owner foi homologada em profundidade após validação técnica e validação visual/interativa pelo usuário.

## Escopo validado
- carregamento de clientes a partir do backend real;
- estado de habilitação persistido em `client_habilitation_reviews`;
- aprovação/rejeição de solicitações de acesso pelo fluxo protegido `company-access-requests`;
- entrada no perfil do cliente por **Operar no perfil**;
- isolamento Owner × Cliente;
- RLS e autorização do Owner;
- propagação consistente da habilitação/revogação para `clients`, capacidades selecionadas e matrículas do Radar;
- auditoria append-only dos eventos de habilitação;
- ausência de métricas fictícias como fonte operacional;
- deploy de produção e Quality Gate validados.

## Correção incorporada durante a homologação
A revogação de habilitação passou a reverter de forma coerente o estado operacional do cliente, evitando que um cliente não habilitado permaneça com status `ready` ou com participação/monitoramento do Radar ativos. A RPC pública de habilitação também foi blindada para preservar a checagem de Owner durante a execução privilegiada.

## Estado de referência validado
LUVI EMPILHADEIRAS: cliente `ready` e habilitado.

## Regra de blindagem
Alterações futuras na página Clientes não podem quebrar:
1. autorização exclusiva do Owner para habilitação;
2. consistência entre habilitação, status do cliente e Radar;
3. isolamento entre tenants;
4. trilha de auditoria;
5. navegação para o perfil correto do cliente;
6. baseline visual aprovado do UNI.

A partir desta aprovação, **Clientes** está congelada como baseline homologada do fluxo Owner. A próxima etapa da homologação profunda é **Oportunidades**.
