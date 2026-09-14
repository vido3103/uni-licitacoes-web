create index if not exists post_dispute_reviews_opportunity_idx on public.post_dispute_reviews(opportunity_id);
create index if not exists post_dispute_reviews_cfp_item_idx on public.post_dispute_reviews(cfp_item_id);
create index if not exists post_dispute_reviews_strategy_idx on public.post_dispute_reviews(dispute_strategy_id);
