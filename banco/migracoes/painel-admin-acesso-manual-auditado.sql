create function public.admin_painel_acesso(p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.perfis where user_id=auth.uid() and role='admin') then raise exception 'NAO_AUTORIZADO'; end if;
 return jsonb_build_object('pix',(select jsonb_build_object('validade',validade_ate,'plano',plano,'valor',valor) from public.cobrancas_pix where user_id=p_user and status='pago' and aplicado_em is not null order by validade_ate desc nulls last, aplicado_em desc limit 1),
 'historico',(select coalesce(jsonb_agg(to_jsonb(h) order by h.criado_em desc),'[]'::jsonb) from (select acao,criado_em,detalhes->>'motivo' as motivo from public.admin_historico where alvo_user_id=p_user order by criado_em desc limit 5) h));
end $$;
create function public.admin_painel_manual(p_user uuid,p_plano text,p_ciclo text,p_data date,p_motivo text,p_ajuste boolean) returns date language plpgsql security definer set search_path='' as $$
declare v_limite integer; v_pago date; v_final date; v_hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
 if not exists(select 1 from public.perfis where user_id=auth.uid() and role='admin') then raise exception 'NAO_AUTORIZADO'; end if;
 if coalesce(length(trim(p_motivo)),0) not between 3 and 180 or p_data is null or p_ciclo is null or p_ciclo not in ('mensal','semestral','anual') or p_ajuste is null then raise exception 'Informe ciclo, data e motivo.'; end if;
 if not p_ajuste and p_data<v_hoje then raise exception 'A validade precisa ser hoje ou depois.'; end if;
 perform 1 from public.assinaturas where user_id=p_user for update;
 select max(validade_ate) into v_pago from public.cobrancas_pix where user_id=p_user and status='pago' and aplicado_em is not null and validade_ate>=v_hoje;
 if p_data<v_pago then raise exception 'Existe Pix pago até %. Escolha essa data ou uma posterior.',to_char(v_pago,'DD/MM/YYYY'); end if;
 if p_ajuste then
 perform public.admin_ajustar_vencimento(p_user,p_data,p_ciclo);
 else
 select limite_viveiros into v_limite from public.planos where chave=p_plano;
 if not found then raise exception 'Plano inválido'; end if;
 insert into public.assinaturas(user_id,plano,ciclo,status,limite_viveiros,proximo_vencimento,atualizado_em) values(p_user,p_plano,p_ciclo,'ativo',v_limite,p_data,now()) on conflict(user_id) do update set plano=excluded.plano,ciclo=excluded.ciclo,status='ativo',limite_viveiros=excluded.limite_viveiros,proximo_vencimento=excluded.proximo_vencimento,atualizado_em=now(),plano_checkout=null,ciclo_checkout=null;
 end if;
 select proximo_vencimento into v_final from public.assinaturas where user_id=p_user;
 insert into public.admin_historico(admin_id,alvo_user_id,acao,detalhes) values(auth.uid(),p_user,case when p_ajuste then 'ajustar_vencimento' else 'liberar' end,jsonb_build_object('motivo',trim(p_motivo),'vencimento',v_final,'ciclo',p_ciclo));
 return v_final;
end $$;
revoke all on function public.admin_painel_acesso(uuid),public.admin_painel_manual(uuid,text,text,date,text,boolean) from public, anon;
grant execute on function public.admin_painel_acesso(uuid),public.admin_painel_manual(uuid,text,text,date,text,boolean) to authenticated;