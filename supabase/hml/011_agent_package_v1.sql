-- VEENCE-HML only. Configures the first real multi-agent package without enabling execution.
-- All agents remain disabled until an explicit activation gate is approved.

update hml.agent_registry
set version = 'v1',
    enabled = false,
    provider = 'gateway',
    model = 'openai/gpt-5-mini',
    timeout_ms = 120000,
    updated_at = now(),
    instructions = case agent_code
      when 'orchestracao_veence' then 'Orquestre o fluxo Veence sem substituir decisão humana. Decomponha a demanda, selecione somente agentes necessários, preserve escopo do cliente e da oportunidade, consolide resultados com rastreabilidade e interrompa o fluxo quando faltar evidência, autorização ou orçamento. Não invente dados e não execute ações externas não autorizadas.'
      when 'radar' then 'Analise oportunidades públicas para aderência inicial ao perfil e portfólio do cliente. Priorize evidências de fonte oficial, identifique duplicidades e lacunas, e devolva candidatos e motivos objetivos. Não tome decisão final de participação.'
      when 'triagem' then 'Faça a triagem técnica e comercial inicial da oportunidade conforme Prompt Mestre, perfil e playbook vigentes. Separe fatos, pendências e riscos; respeite itens selecionados e documentos efetivamente disponíveis. Não invente requisitos nem conclua além das evidências.'
      when 'habilitacao' then 'Avalie exclusivamente requisitos de habilitação e documentação do cliente contra o edital e anexos disponíveis. Indique atendido, pendente, ressalva ou não atendido com evidência rastreável. Não presuma validade de documento ausente e não substitua conferência humana final.'
      when 'produtos' then 'Valide especificações de produtos, marca, modelo, referência, quantidade e equivalência permitida contra edital, TR e fontes fornecidas. Preserve divergências e não trate produto semelhante como equivalente sem base documental.'
      when 'suprimentos' then 'Estruture necessidades de cotação e fornecimento, compare propostas e disponibilidade quando dados forem fornecidos e identifique lacunas para prospecção. Não efetue compra, pedido ou contato externo sem autorização específica.'
      when 'logistica' then 'Avalie origem, destino, frete, consolidação, triangulação, prazo e riscos logísticos conforme regras do cliente. Diferencie valores reais de provisórios e não invente tarifa ou prazo de transportadora.'
      when 'economico' then 'Calcule custo final, impostos, logística, administração, markup, margem e piso econômico usando somente entradas verificadas e regras vigentes do cliente. Mostre premissas e sinalize dados faltantes; não altere o piso de disputa.'
      when 'auditoria' then 'Audite resultados dos demais agentes contra evidências, regras determinísticas, escopo e trilha de execução. Procure contradições, campos sem fonte, extrapolações e violações de gate. Não reescreva fatos para forçar aprovação.'
      when 'relatorios' then 'Consolide resultados aprovados pelo fluxo em relatórios claros, rastreáveis e compatíveis com o padrão do cliente. Preserve ressalvas, fontes, versões e decisões humanas; não crie fatos novos.'
      else instructions
    end,
    skills = case agent_code
      when 'orchestracao_veence' then '["planejamento_de_fluxo","delegacao","consolidacao","controle_de_gates"]'::jsonb
      when 'radar' then '["descoberta_de_oportunidades","deduplicacao","aderencia_inicial"]'::jsonb
      when 'triagem' then '["triagem_edital","escopo_de_itens","identificacao_de_riscos"]'::jsonb
      when 'habilitacao' then '["habilitacao_juridica","fiscal_trabalhista","economico_financeira","qualificacao_tecnica"]'::jsonb
      when 'produtos' then '["especificacao_tecnica","referencias_oem","equivalencia_documental"]'::jsonb
      when 'suprimentos' then '["cotacao","comparacao_de_fornecedores","disponibilidade"]'::jsonb
      when 'logistica' then '["frete","prazo_logistico","consolidacao","triangulacao"]'::jsonb
      when 'economico' then '["formacao_de_custo","markup","margem","piso_economico"]'::jsonb
      when 'auditoria' then '["auditoria_de_evidencias","consistencia","conformidade_de_gates"]'::jsonb
      when 'relatorios' then '["consolidacao","rastreabilidade","formatacao_de_relatorio"]'::jsonb
      else skills
    end,
    allowed_tools = case agent_code
      when 'orchestracao_veence' then '["read_context","read_agent_catalog","dispatch_agent","read_agent_results"]'::jsonb
      when 'radar' then '["read_client_profile","read_public_opportunities","read_radar_history"]'::jsonb
      when 'triagem' then '["read_opportunity","read_documents","read_selected_items","read_playbook"]'::jsonb
      when 'habilitacao' then '["read_documents","read_client_habilitation","read_playbook"]'::jsonb
      when 'produtos' then '["read_documents","read_selected_items","read_product_references"]'::jsonb
      when 'suprimentos' then '["read_selected_items","read_supplier_quotes","read_supplier_catalog"]'::jsonb
      when 'logistica' then '["read_selected_items","read_supplier_quotes","read_logistics_rules"]'::jsonb
      when 'economico' then '["read_selected_items","read_supplier_quotes","calculate_costs","read_economic_rules"]'::jsonb
      when 'auditoria' then '["read_agent_results","read_evidence","read_deterministic_gates","read_audit_trail"]'::jsonb
      when 'relatorios' then '["read_agent_results","read_evidence","read_human_decisions","render_report"]'::jsonb
      else allowed_tools
    end,
    permissions = jsonb_build_object(
      'client_scope', 'bound_client_only',
      'write_external', false,
      'human_final_decision', true,
      'requires_operational_gate', true,
      'may_call_gateway', agent_code <> 'relatorios',
      'may_delegate', agent_code = 'orchestracao_veence'
    ),
    max_output_tokens = case agent_code
      when 'orchestracao_veence' then 2048
      when 'radar' then 1800
      when 'triagem' then 2200
      when 'habilitacao' then 2800
      when 'produtos' then 2200
      when 'suprimentos' then 1800
      when 'logistica' then 1600
      when 'economico' then 1800
      when 'auditoria' then 2400
      when 'relatorios' then 2200
      else max_output_tokens
    end,
    max_cost_usd = case agent_code
      when 'orchestracao_veence' then 0.030000
      when 'habilitacao' then 0.050000
      when 'auditoria' then 0.050000
      else 0.040000
    end
where agent_code in (
  'orchestracao_veence','radar','triagem','habilitacao','produtos',
  'suprimentos','logistica','economico','auditoria','relatorios'
);
