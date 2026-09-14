create table if not exists public.post_dispute_reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  opportunity_id uuid not null references public.public_opportunities(id) on delete cascade,
  cfp_item_id uuid not null references public.cfp_items(id) on delete cascade,
  dispute_strategy_id uuid not null references public.dispute_strategies(id) on delete cascade,
  status text not null default 'monitoring' check (status in ('monitoring','recovered','closed')),
  current_position integer,
  leading_supplier text,
  leading_bid numeric,
  review_level text not null default 'normal' check (review_level in ('normal','indicio','fundamento')),
  notes text,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid not null default auth.uid(),
  unique (client_id, cfp_item_id)
);

create index if not exists post_dispute_reviews_client_opportunity_idx
  on public.post_dispute_reviews(client_id, opportunity_id);

alter table public.post_dispute_reviews enable row level security;

create policy post_dispute_reviews_select
on public.post_dispute_reviews
for select
using (
  private.is_platform_owner()
  or exists (
    select 1 from public.client_members cm
    where cm.client_id = post_dispute_reviews.client_id
      and cm.user_id = (select auth.uid())
  )
);

create policy post_dispute_reviews_insert
on public.post_dispute_reviews
for insert
with check (
  (private.is_platform_owner()
   or exists (
      select 1 from public.client_members cm
      where cm.client_id = post_dispute_reviews.client_id
        and cm.user_id = (select auth.uid())
   ))
  and created_by = (select auth.uid())
);

create policy post_dispute_reviews_update
on public.post_dispute_reviews
for update
using (
  private.is_platform_owner()
  or exists (
    select 1 from public.client_members cm
    where cm.client_id = post_dispute_reviews.client_id
      and cm.user_id = (select auth.uid())
  )
)
with check (
  private.is_platform_owner()
  or exists (
    select 1 from public.client_members cm
    where cm.client_id = post_dispute_reviews.client_id
      and cm.user_id = (select auth.uid())
  )
);

create or replace function private.sync_post_dispute_review()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.status = 'lost' then
    insert into public.post_dispute_reviews (
      client_id, opportunity_id, cfp_item_id, dispute_strategy_id,
      status, review_level, opened_at, updated_at, created_by
    ) values (
      new.client_id, new.opportunity_id, new.cfp_item_id, new.id,
      'monitoring', 'normal', now(), now(), new.created_by
    )
    on conflict (client_id, cfp_item_id)
    do update set
      dispute_strategy_id = excluded.dispute_strategy_id,
      status = 'monitoring',
      closed_at = null,
      updated_at = now();
  elsif new.status = 'won' then
    update public.post_dispute_reviews
       set status = case when status = 'monitoring' then 'recovered' else status end,
           closed_at = case when status = 'monitoring' then now() else closed_at end,
           updated_at = now()
     where client_id = new.client_id
       and cfp_item_id = new.cfp_item_id;
  elsif new.status = 'stopped' then
    update public.post_dispute_reviews
       set status = 'closed',
           closed_at = coalesce(closed_at, now()),
           updated_at = now()
     where client_id = new.client_id
       and cfp_item_id = new.cfp_item_id
       and status = 'monitoring';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_post_dispute_review on public.dispute_strategies;
create trigger trg_sync_post_dispute_review
after insert or update of status on public.dispute_strategies
for each row execute function private.sync_post_dispute_review();

grant select, insert, update on public.post_dispute_reviews to authenticated;
