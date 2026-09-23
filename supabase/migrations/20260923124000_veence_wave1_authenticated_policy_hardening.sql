-- Veence Onda 1: policies that depend on authenticated identity must not target public.
alter policy cfp_items_member_delete on public.cfp_items to authenticated;
alter policy cfp_items_member_insert on public.cfp_items to authenticated;
alter policy cfp_items_member_select on public.cfp_items to authenticated;
alter policy cfp_items_member_update on public.cfp_items to authenticated;
alter policy cfp_quotes_member_delete on public.cfp_quotes to authenticated;
alter policy cfp_quotes_member_insert on public.cfp_quotes to authenticated;
alter policy cfp_quotes_member_select on public.cfp_quotes to authenticated;
alter policy cfp_quotes_member_update on public.cfp_quotes to authenticated;
alter policy dispute_strategies_member_insert on public.dispute_strategies to authenticated;
alter policy dispute_strategies_member_select on public.dispute_strategies to authenticated;
alter policy dispute_strategies_member_update on public.dispute_strategies to authenticated;
alter policy post_dispute_reviews_insert on public.post_dispute_reviews to authenticated;
alter policy post_dispute_reviews_select on public.post_dispute_reviews to authenticated;
alter policy post_dispute_reviews_update on public.post_dispute_reviews to authenticated;
