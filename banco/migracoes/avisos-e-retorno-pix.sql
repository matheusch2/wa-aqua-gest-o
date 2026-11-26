create function public.tratar_aviso_cobranca(p_evento text,p_chave text,p_referencia text,p_sub text,p_data date) returns text language plpgsql set search_path='' as $$
declare a public.assinaturas; hoje date:=(now() at time zone 'America/Fortaleza')::date;
begin
 if p_evento not in ('PAYMENT_OVERDUE','PAYMENT_DELETED','PAYMENT_REFUNDED','SUBSCRIPTION_DELETED') then raise exception 'Evento inválido';end if;
 select * into a from public.assinaturas where asaas_subscription_id=p_sub for update;
 if found and p_evento='PAYMENT_OVERDUE' and p_data is not null and a.proximo_vencimento is not null then
 if a.proximo_vencimento>=hoje or p_data<a.proximo_vencimento or a.status<>'ativo' then return 'sem alteração';end if;
 if not exists(select from public.cobrancas_pix where user_id=a.user_id and status='pago' and aplicado_em is not null and validade_ate>=hoje) and not exists(select from public.periodos_cartao where user_id=a.user_id and validade>=hoje) then
 update public.assinaturas set status='pendente',atualizado_em=now() where user_id=a.user_id;return 'pendente';end if;
 return 'período pago preservado';
 end if;
 insert into public.cobranca_revisao(chave,evento,referencia) values(p_chave,p_evento,p_referencia) on conflict(chave) do nothing;return 'revisão administrativa';
end $$;
revoke all on function public.tratar_aviso_cobranca(text,text,text,text,date) from public,anon,authenticated;grant execute on function public.tratar_aviso_cobranca(text,text,text,text,date) to service_role;
create function public.consultar_meu_checkout_pix(p_checkout text) returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('status',case when c.status='pago' and c.aplicado_em is not null then 'confirmado' when c.status in ('expirado','cancelado','estornado') then c.status else 'pendente' end,'nome',p.nome,'validade',c.validade_ate) from public.cobrancas_pix c left join public.planos p on p.chave=c.plano where c.asaas_checkout_id=p_checkout and c.user_id=auth.uid() limit 1 $$;
revoke all on function public.consultar_meu_checkout_pix(text) from public,anon;grant execute on function public.consultar_meu_checkout_pix(text) to authenticated;
create or replace function public.consultar_meu_checkout_pix(p_checkout text) returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('status',case when c.status='pago' and c.aplicado_em is not null then 'confirmado' when c.status in ('expirado','cancelado','estornado') then c.status else 'pendente' end,'checkout',c.asaas_checkout_id,'nome',p.nome,'validade',c.validade_ate) from public.cobrancas_pix c left join public.planos p on p.chave=c.plano where (c.asaas_checkout_id=p_checkout or c.id::text=p_checkout) and c.user_id=auth.uid() limit 1 $$;
revoke all on function public.consultar_meu_checkout_pix(text) from public,anon;grant execute on function public.consultar_meu_checkout_pix(text) to authenticated;