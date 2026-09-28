-- HML: garante orçamento mínimo de saída e formato compacto para agentes downstream.
update hml.agent_registry
set max_output_tokens = greatest(max_output_tokens, 4096),
    instructions = regexp_replace(instructions, '\s*$', '') || E'\n\nFORMATO HML OBRIGATÓRIO: conclua sempre um JSON válido dentro do orçamento de saída. Não repita o dossiê documental nem resultados upstream; referencie somente as evidências indispensáveis ao seu papel. Remova narrativa, duplicações e explicações extensas antes de omitir qualquer conclusão, ressalva, bloqueio ou próximo passo do seu escopo.'
where enabled = true
  and agent_code in ('habilitacao','produtos','suprimentos','logistica','economico','auditoria');
