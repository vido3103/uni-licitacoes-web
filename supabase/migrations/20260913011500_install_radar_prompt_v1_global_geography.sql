-- Prompt Radar UNI v1.0 + pesquisa nacional
create table if not exists public.radar_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  status text not null default 'official' check (status in ('draft','official','retired')),
  content text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.radar_prompt_versions enable row level security;
drop policy if exists radar_prompt_versions_read on public.radar_prompt_versions;
create policy radar_prompt_versions_read on public.radar_prompt_versions for select to authenticated using (true);

insert into public.radar_prompt_versions(version,status,content,config)
values (
 'Prompt Radar UNI v1.0','official',
 'RADAR UNI — DIRETRIZ OFICIAL v1.0\n\nObjetivo: localizar oportunidades públicas potencialmente aderentes ao perfil comercial do cliente antes da Análise Detalhada.\n\n1. Fontes prioritárias: PNCP e Compras.gov.br, preservando fonte oficial, processo, órgão, modalidade, datas, valores e anexos.\n2. Cobertura geográfica: NACIONAL. Não excluir oportunidade por estado, município ou órgão. Estado, município e órgão são filtros de pesquisa escolhidos pelo usuário, nunca barreiras fixas do Radar.\n3. Escopo: usar capacidades, CNAEs, perfil empresarial, termos de inclusão e exclusão do cliente. Para a Luvi, priorizar fornecimento de peças para empilhadeiras, peças e produtos automotivos, lubrificantes, filtros, aquisição de empilhadeiras/paleteiras e locação de empilhadeiras sem operador. Excluir prestação de serviços de manutenção quando o objeto principal for serviço.\n4. Preferência: destacar Dispensa Eletrônica/Contratação Direta com disputa, sem excluir modalidades compatíveis.\n5. Deduplicação: não apresentar como nova uma oportunidade já vinculada/reportada ao mesmo cliente; preservar histórico.\n6. Prazos: não aprovar oportunidade com prazo encerrado. Prazo ausente deve ser sinalizado, não inventado.\n7. Evidências: não inventar itens, quantidades, valores, requisitos ou anexos. Quando anexos oficiais estiverem disponíveis, sincronizar e usar os documentos como fonte primária.\n8. Triagem: classificar apenas aderência preliminar. A aprovação da triagem libera a Análise Detalhada, mas não substitui CFP, Gates, habilitação específica do edital ou decisão de participação.\n9. Itens: quando houver itens estruturados, permitir seleção explícita dos itens que seguirão para Análise Detalhada.\n10. Terminologia: APROVADO PARA ANÁLISE, APROVADO COM RESSALVA quando aplicável, ou NÃO APROVADO, sempre com justificativa rastreável.\n11. Pesquisa detalhada: permitir busca por qualquer estado, município, órgão, CNPJ do órgão, UASG, processo, modalidade, fonte, faixa de valor e período, sem depender do recorte geográfico padrão do perfil do cliente.\n12. Segurança: respeitar tenant, permissões e rastreabilidade por cliente.',
 jsonb_build_object('geography','national','geography_is_filter_only',true,'priority_sources',jsonb_build_array('PNCP','Compras.gov.br'),'priority_modalities',jsonb_build_array('Dispensa Eletrônica','Contratação Direta com disputa'),'deduplicate_per_client',true,'attachments_preferred',true,'item_selection_before_detailed_analysis',true)
)
on conflict(version) do update set status='official',content=excluded.content,config=excluded.config;
update public.radar_prompt_versions set status='retired' where version<>'Prompt Radar UNI v1.0' and status='official';

-- O backend em produção foi atualizado na mesma migração para:
-- 1) remover o bloqueio geográfico fixo de search_radar_opportunities;
-- 2) tratar estado/município/órgão exclusivamente como filtros explícitos;
-- 3) remover estado/município do prefilter_opportunity;
-- 4) registrar Prompt Radar UNI v1.0 em prefilter, match e triagem.
