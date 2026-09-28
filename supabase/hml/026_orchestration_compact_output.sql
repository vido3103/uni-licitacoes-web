-- HML: evita truncamento da orquestracao ao processar dossies PDF extensos.
update hml.agent_registry
set instructions = regexp_replace(instructions, '\s*$', '') || E'\n\nFORMATO HML OBRIGATÓRIO — ORQUESTRAÇÃO COMPACTA: responda exclusivamente com JSON válido e conciso. Não transcreva, resuma extensamente nem reproduza o conteúdo dos PDFs. Registre somente: confirmação de leitura por arquivo, referências mínimas de rastreabilidade, fatos estruturais indispensáveis para encaminhar aos agentes seguintes, bloqueios objetivos e próximos agentes. Use listas curtas, sem narrativa e sem duplicação. Priorize concluir o JSON dentro de 4096 tokens; se houver pressão de espaço, reduza evidências e detalhes antes de omitir status, bloqueios ou roteamento.'
where agent_code='orchestracao_veence'
  and instructions not like '%ORQUESTRAÇÃO COMPACTA%';
