-- HML: evita truncamento da saída da triagem sem ampliar escopo ou custo máximo por chamada.
update hml.agent_registry
set max_output_tokens = 4096,
    instructions = regexp_replace(instructions, '\s*$', '') || E'\n\nFORMATO HML OBRIGATÓRIO: devolva JSON compacto, sem repetir o dossiê da orquestração. Limite-se ao escopo de triagem: status, fatos determinantes, riscos, pendências, gates pré-participação, evidências essenciais e próximos passos. Referencie evidências upstream por arquivo/página quando necessário, sem recopiar trechos extensos. Priorize concluir JSON válido dentro do orçamento de saída; elimine narrativa redundante antes de omitir campos decisórios.'
where agent_code = 'triagem'
  and max_output_tokens < 4096;
