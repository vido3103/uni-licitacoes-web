-- Keep privileged RPCs inaccessible before authentication. Membership checks
-- inside the functions remain the second authorization boundary.
revoke all on function public.search_radar_opportunities(uuid,text,text,text,text,text,text,text,boolean,numeric,numeric,date,date,integer,text,integer,text,integer,timestamptz,integer,boolean,integer,integer) from anon;
revoke all on function public.match_opportunity_capability(uuid,uuid) from anon;
revoke all on function public.prefilter_opportunity(uuid,uuid) from anon;
revoke all on function public.enqueue_opportunity_ai_analysis(uuid,uuid,text) from anon;

-- Cover every foreign key reported by the database advisor. Besides faster
-- joins, these indexes prevent parent updates/deletes from scanning children.
create index if not exists idx_capability_suggestions_reviewed_by on public.capability_suggestions(reviewed_by);
create index if not exists idx_client_document_requirements_document_type_id on public.client_document_requirements(document_type_id);
create index if not exists idx_client_documents_document_type_id on public.client_documents(document_type_id);
create index if not exists idx_client_documents_metadata_validated_by on public.client_documents(metadata_validated_by);
create index if not exists idx_client_documents_replaced_document_id on public.client_documents(replaced_document_id);
create index if not exists idx_client_documents_uploaded_by on public.client_documents(uploaded_by);
create index if not exists idx_client_enterprise_data_created_by on public.client_enterprise_data(created_by);
create index if not exists idx_client_enterprise_data_validated_by on public.client_enterprise_data(validated_by);
create index if not exists idx_client_radar_filter_profiles_capability_id on public.client_radar_filter_profiles(capability_id);
create index if not exists idx_client_requirements_validated_by on public.client_requirements(validated_by);
create index if not exists idx_client_sicaf_status_evidence_document_id on public.client_sicaf_status(evidence_document_id);
create index if not exists idx_company_registry_validations_client_id on public.company_registry_validations(client_id);
create index if not exists idx_company_registry_validations_enterprise_data_id on public.company_registry_validations(enterprise_data_id);
create index if not exists idx_company_registry_validations_reviewed_by on public.company_registry_validations(reviewed_by);
create index if not exists idx_opportunity_readiness_gate_evaluation_id on public.opportunity_readiness_evaluations(participation_gate_evaluation_id);
create index if not exists idx_opportunity_readiness_capability_id on public.opportunity_readiness_evaluations(capability_id);
create index if not exists idx_opportunity_readiness_opportunity_id on public.opportunity_readiness_evaluations(opportunity_id);
create index if not exists idx_opportunity_requirements_capability_id on public.opportunity_requirements(capability_id);
create index if not exists idx_opportunity_requirements_evidence_document_id on public.opportunity_requirements(evidence_document_id);
create index if not exists idx_opportunity_requirements_opportunity_id on public.opportunity_requirements(opportunity_id);
create index if not exists idx_participation_gate_evaluations_capability_id on public.participation_gate_evaluations(capability_id);
create index if not exists idx_participation_gate_evaluations_evaluated_by on public.participation_gate_evaluations(evaluated_by);

-- Wrap auth.uid() in a scalar subquery so PostgreSQL evaluates it once per
-- statement rather than once per row. Policy expressions otherwise stay equal.
do $hardening$
declare
  policy record;
  using_clause text;
  check_clause text;
  statement text;
begin
  for policy in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') like '%auth.uid()%' or coalesce(with_check, '') like '%auth.uid()%')
  loop
    using_clause := case
      when policy.qual is null then ''
      else ' using (' || replace(policy.qual, 'auth.uid()', '(select auth.uid())') || ')'
    end;
    check_clause := case
      when policy.with_check is null then ''
      else ' with check (' || replace(policy.with_check, 'auth.uid()', '(select auth.uid())') || ')'
    end;
    statement := format(
      'alter policy %I on %I.%I%s%s',
      policy.policyname,
      policy.schemaname,
      policy.tablename,
      using_clause,
      check_clause
    );
    execute statement;
  end loop;
end
$hardening$;
