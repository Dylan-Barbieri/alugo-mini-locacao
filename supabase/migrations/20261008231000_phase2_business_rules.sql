-- Fase 2: regras de negócio financeiras e integridade transacional.

alter table public.veiculos
  add column if not exists marca text not null default 'Haojue';

alter table public.contratos
  add column if not exists quantidade_semanas integer,
  add column if not exists data_inicio date;

update public.contratos
set data_inicio = coalesce(data_inicio, inicio_em),
    quantidade_semanas = coalesce(
      quantidade_semanas,
      greatest(1, ceil((coalesce(fim_em, inicio_em) - inicio_em + 1)::numeric / 7)::integer)
    )
where data_inicio is null or quantidade_semanas is null;

alter table public.contratos
  alter column quantidade_semanas set not null,
  alter column data_inicio set not null;

alter table public.contratos
  drop constraint if exists contratos_quantidade_semanas_positive,
  add constraint contratos_quantidade_semanas_positive check (quantidade_semanas > 0),
  drop constraint if exists contratos_data_inicio_compat,
  add constraint contratos_data_inicio_compat check (inicio_em = data_inicio);

alter table public.faturas
  add column if not exists numero_parcela integer,
  add column if not exists data_vencimento date;

with ranked as (
  select
    id,
    row_number() over (partition by contrato_id order by vencimento_em, created_at, id)::integer as parcela
  from public.faturas
)
update public.faturas f
set numero_parcela = coalesce(f.numero_parcela, ranked.parcela),
    data_vencimento = coalesce(f.data_vencimento, f.vencimento_em)
from ranked
where ranked.id = f.id
  and (f.numero_parcela is null or f.data_vencimento is null);

alter table public.faturas
  alter column numero_parcela set not null,
  alter column data_vencimento set not null;

alter table public.faturas
  drop constraint if exists faturas_numero_parcela_positive,
  add constraint faturas_numero_parcela_positive check (numero_parcela > 0),
  drop constraint if exists faturas_data_vencimento_compat,
  add constraint faturas_data_vencimento_compat check (vencimento_em = data_vencimento),
  drop constraint if exists faturas_contrato_numero_parcela_unique,
  add constraint faturas_contrato_numero_parcela_unique unique (contrato_id, numero_parcela);

create index if not exists idx_faturas_contrato_parcela on public.faturas(contrato_id, numero_parcela);
create index if not exists idx_faturas_data_vencimento on public.faturas(data_vencimento);
create index if not exists idx_contratos_data_inicio on public.contratos(data_inicio);

create or replace function public.sync_contrato_business_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.data_inicio is null and new.inicio_em is not null then
    new.data_inicio := new.inicio_em;
  elsif new.inicio_em is null and new.data_inicio is not null then
    new.inicio_em := new.data_inicio;
  elsif new.data_inicio is not null and new.inicio_em is not null and new.data_inicio <> new.inicio_em then
    raise exception 'data_inicio e inicio_em devem representar a mesma data';
  end if;

  if new.quantidade_semanas is null or new.quantidade_semanas <= 0 then
    raise exception 'quantidade_semanas deve ser um inteiro positivo';
  end if;

  if new.valor_semanal is null or new.valor_semanal <= 0 then
    raise exception 'valor_semanal deve ser maior que zero';
  end if;

  return new;
end;
$$;

create or replace function public.sync_fatura_business_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.data_vencimento is null and new.vencimento_em is not null then
    new.data_vencimento := new.vencimento_em;
  elsif new.vencimento_em is null and new.data_vencimento is not null then
    new.vencimento_em := new.data_vencimento;
  elsif new.data_vencimento is not null and new.vencimento_em is not null and new.data_vencimento <> new.vencimento_em then
    raise exception 'data_vencimento e vencimento_em devem representar a mesma data';
  end if;

  if new.numero_parcela is null or new.numero_parcela <= 0 then
    raise exception 'numero_parcela deve ser um inteiro positivo';
  end if;

  if new.valor is null or new.valor <= 0 then
    raise exception 'valor da fatura deve ser maior que zero';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_contrato_business_fields on public.contratos;
create trigger sync_contrato_business_fields
before insert or update on public.contratos
for each row execute function public.sync_contrato_business_fields();

drop trigger if exists sync_fatura_business_fields on public.faturas;
create trigger sync_fatura_business_fields
before insert or update on public.faturas
for each row execute function public.sync_fatura_business_fields();

create or replace function public.generate_invoices_for_active_contract()
returns trigger
language plpgsql
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

drop trigger if exists generate_invoices_after_contract_insert on public.contratos;
create trigger generate_invoices_after_contract_insert
after insert on public.contratos
for each row execute function public.generate_invoices_for_active_contract();

drop trigger if exists generate_invoices_after_contract_activation on public.contratos;
create trigger generate_invoices_after_contract_activation
after update of status on public.contratos
for each row
when (old.status is distinct from new.status and new.status = 'ativo')
execute function public.generate_invoices_for_active_contract();

create or replace function public.prevent_paid_invoice_changes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'paga' and (
    new.valor is distinct from old.valor or
    new.status is distinct from old.status or
    new.pago_em is distinct from old.pago_em or
    new.contrato_id is distinct from old.contrato_id or
    new.numero_parcela is distinct from old.numero_parcela or
    new.data_vencimento is distinct from old.data_vencimento or
    new.vencimento_em is distinct from old.vencimento_em
  ) then
    raise exception 'Faturas pagas não podem ter valor, status, vínculo, parcela ou pagamento alterados';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_paid_invoice_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'paga' then
    raise exception 'Faturas pagas não podem ser excluídas';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_paid_invoice_changes on public.faturas;
create trigger prevent_paid_invoice_changes
before update on public.faturas
for each row execute function public.prevent_paid_invoice_changes();

drop trigger if exists prevent_paid_invoice_delete on public.faturas;
create trigger prevent_paid_invoice_delete
before delete on public.faturas
for each row execute function public.prevent_paid_invoice_delete();

create or replace function public.liquidar_fatura(
  p_fatura_id uuid,
  p_valor_pago numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fatura public.faturas%rowtype;
  v_pago_em timestamptz := now();
begin
  if p_fatura_id is null or p_valor_pago is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;

  select *
  into v_fatura
  from public.faturas
  where id = p_fatura_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invoice_not_found');
  end if;

  if v_fatura.valor <> p_valor_pago then
    return jsonb_build_object(
      'ok', false,
      'error', 'amount_mismatch',
      'expected', v_fatura.valor,
      'received', p_valor_pago
    );
  end if;

  if v_fatura.status = 'paga' then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_paid',
      'fatura_id', v_fatura.id,
      'pago_em', v_fatura.pago_em,
      'pago_em_sao_paulo', to_char(v_fatura.pago_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS')
    );
  end if;

  if v_fatura.status <> 'aberta' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status', 'status', v_fatura.status);
  end if;

  update public.faturas
  set status = 'paga',
      pago_em = v_pago_em
  where id = v_fatura.id
  returning * into v_fatura;

  return jsonb_build_object(
    'ok', true,
    'status', 'paid',
    'fatura_id', v_fatura.id,
    'pago_em', v_fatura.pago_em,
    'pago_em_sao_paulo', to_char(v_fatura.pago_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS')
  );
end;
$$;

revoke all on function public.liquidar_fatura(uuid, numeric) from public;
revoke all on function public.liquidar_fatura(uuid, numeric) from anon;
revoke all on function public.liquidar_fatura(uuid, numeric) from authenticated;
grant execute on function public.liquidar_fatura(uuid, numeric) to service_role;

revoke all on public.clientes from anon;
revoke all on public.veiculos from anon;
revoke all on public.contratos from anon;
revoke all on public.faturas from anon;

grant select on public.clientes to authenticated;
grant select on public.veiculos to authenticated;
grant select on public.contratos to authenticated;
grant select on public.faturas to authenticated;

revoke insert, update, delete on public.contratos from authenticated;
revoke insert, update, delete on public.faturas from authenticated;
