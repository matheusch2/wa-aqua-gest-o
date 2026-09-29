-- ═══════════════════════════════════════════════════════════════════════════
-- WA Aqua Gestão — Hardening: fecha RPC das funções-gatilho (Security Advisor)
--
-- CONTEXTO
--   O Security Advisor do Supabase apontou 3 funções SECURITY DEFINER que
--   estavam com EXECUTE concedido ao PUBLIC — ou seja, chamáveis pela API REST
--   (/rest/v1/rpc/...) por anon e por usuários logados. As três são FUNÇÕES DE
--   GATILHO (rodam sozinhas no cadastro e ao criar/reativar viveiro); chamá-las
--   direto pela API não faz nada útil, mas expor à toa é porta aberta.
--
-- O QUE FOI FEITO (aplicado em produção em 29/09/2026 via MCP)
--   Revogado EXECUTE de public/anon/authenticated nas três. Os GATILHOS
--   continuam funcionando normalmente (o disparo do trigger não depende de
--   EXECUTE do papel que fez o insert). O service_role mantém acesso interno.
--
-- RESULTADO
--   Advisor: as 2 WARN "SECURITY DEFINER executável" zeraram.
--
-- COMO DESFAZER (se algum dia precisar reabrir a chamada por RPC)
--   grant execute on function public.checar_limite_viveiros()  to authenticated;
--   grant execute on function public.criar_assinatura_padrao() to authenticated;
--   grant execute on function public.criar_perfil_padrao()     to authenticated;
-- ═══════════════════════════════════════════════════════════════════════════

revoke execute on function public.checar_limite_viveiros()  from public, anon, authenticated;
revoke execute on function public.criar_assinatura_padrao() from public, anon, authenticated;
revoke execute on function public.criar_perfil_padrao()     from public, anon, authenticated;

-- Verificação (deve dar false para anon e authenticated):
-- select p.proname,
--        has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_pode,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_pode
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('checar_limite_viveiros','criar_assinatura_padrao','criar_perfil_padrao');
