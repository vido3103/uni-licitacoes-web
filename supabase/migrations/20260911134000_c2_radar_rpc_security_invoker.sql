-- C2 — hardening das RPCs públicas do Radar
-- Remove SECURITY DEFINER das funções expostas e mantém RLS como camada efetiva de autorização.

alter function public.match_opportunity_capability(uuid, uuid) security invoker;
alter function public.match_opportunity_capability(uuid, uuid) set search_path = '';

alter function public.prefilter_opportunity(uuid, uuid) security invoker;
alter function public.prefilter_opportunity(uuid, uuid) set search_path = '';

alter function public.search_radar_opportunities(
  uuid, text, text, text, text, text, text, text, boolean, numeric, numeric,
  date, date, integer, text, integer, text, integer, timestamptz, integer,
  boolean, integer, integer
) security invoker;
alter function public.search_radar_opportunities(
  uuid, text, text, text, text, text, text, text, boolean, numeric, numeric,
  date, date, integer, text, integer, text, integer, timestamptz, integer,
  boolean, integer, integer
) set search_path = '';

revoke all on function public.match_opportunity_capability(uuid, uuid) from public, anon;
revoke all on function public.prefilter_opportunity(uuid, uuid) from public, anon;
revoke all on function public.search_radar_opportunities(
  uuid, text, text, text, text, text, text, text, boolean, numeric, numeric,
  date, date, integer, text, integer, text, integer, timestamptz, integer,
  boolean, integer, integer
) from public, anon;

grant execute on function public.match_opportunity_capability(uuid, uuid) to authenticated, service_role;
grant execute on function public.prefilter_opportunity(uuid, uuid) to authenticated, service_role;
grant execute on function public.search_radar_opportunities(
  uuid, text, text, text, text, text, text, text, boolean, numeric, numeric,
  date, date, integer, text, integer, text, integer, timestamptz, integer,
  boolean, integer, integer
) to authenticated, service_role;

-- SECURITY INVOKER exige os privilégios SQL básicos; o RLS continua filtrando o acesso.
grant select on table public.public_opportunities to authenticated;
grant select on table public.radar_sources to authenticated;
