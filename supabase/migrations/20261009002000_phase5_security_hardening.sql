-- Fase 5: hardening para permitir geração automática de faturas sem conceder insert direto ao frontend.

create or replace function public.generate_invoices_for_active_contract()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'ativo' then
    return new;
  end if;

  if exists (select 1 from public.faturas where contrato_id = new.id) then
    return new;
  end if;

  insert into public.faturas (
    contrato_id,
    numero_parcela,
    valor,
    vencimento_em,
    data_vencimento,
    status
  )
  select
    new.id,
    parcela,
    new.valor_semanal,
    new.data_inicio + (parcela * 7),
    new.data_inicio + (parcela * 7),
    'aberta'::public.fatura_status
  from generate_series(1, new.quantidade_semanas) as parcela;

  return new;
end;
$$;

revoke all on function public.generate_invoices_for_active_contract() from public;
revoke all on function public.generate_invoices_for_active_contract() from anon;
revoke all on function public.generate_invoices_for_active_contract() from authenticated;
