\set ON_ERROR_STOP on

-- Testes SQL da Fase 2. Execute em banco local/isolado após aplicar as migrações:
--   supabase db reset
--   psql "$DATABASE_URL" -f supabase/tests/phase2_business_rules.sql

begin;

insert into public.clientes (id, nome, documento, email, telefone)
values
  ('10000000-0000-0000-0000-000000000101', 'Teste Cliente Ativo', '99900000001', 'ativo.test@example.com', '+55 11 99999-0001'),
  ('10000000-0000-0000-0000-000000000102', 'Teste Cliente Inativo', '99900000002', 'inativo.test@example.com', '+55 11 99999-0002');

insert into public.veiculos (id, marca, modelo, placa, cor, status)
values
  ('10000000-0000-0000-0000-000000000201', 'Haojue', 'DK 160', 'TST0A01', 'Preta', 'locado'),
  ('10000000-0000-0000-0000-000000000202', 'Haojue', 'DK 160', 'TST0B02', 'Azul', 'disponivel');

insert into public.contratos (id, cliente_id, veiculo_id, valor_semanal, quantidade_semanas, data_inicio, inicio_em, fim_em, status)
values (
  '10000000-0000-0000-0000-000000000301',
  '10000000-0000-0000-0000-000000000101',
  '10000000-0000-0000-0000-000000000201',
  400.00,
  4,
  date '2026-10-10',
  date '2026-10-10',
  date '2026-11-07',
  'ativo'
);

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.faturas where contrato_id = '10000000-0000-0000-0000-000000000301';

  if v_count <> 4 then
    raise exception 'Esperadas 4 faturas, obtidas %', v_count;
  end if;

  if not exists (
    select 1 from public.faturas
    where contrato_id = '10000000-0000-0000-0000-000000000301'
      and numero_parcela = 1
      and data_vencimento = date '2026-10-17'
      and valor = 400.00
  ) then
    raise exception 'Parcela 1 inválida';
  end if;

  if not exists (
    select 1 from public.faturas
    where contrato_id = '10000000-0000-0000-0000-000000000301'
      and numero_parcela = 4
      and data_vencimento = date '2026-11-07'
      and valor = 400.00
  ) then
    raise exception 'Parcela 4 inválida';
  end if;
end $$;

insert into public.contratos (id, cliente_id, veiculo_id, valor_semanal, quantidade_semanas, data_inicio, inicio_em, fim_em, status)
values (
  '10000000-0000-0000-0000-000000000302',
  '10000000-0000-0000-0000-000000000102',
  '10000000-0000-0000-0000-000000000202',
  405.30,
  2,
  date '2026-10-10',
  date '2026-10-10',
  date '2026-10-24',
  'encerrado'
);

do $$
begin
  if exists (select 1 from public.faturas where contrato_id = '10000000-0000-0000-0000-000000000302') then
    raise exception 'Contrato inativo não deveria gerar faturas';
  end if;
end $$;

do $$
declare
  v_invoice uuid;
  v_result jsonb;
begin
  select id into v_invoice from public.faturas where contrato_id = '10000000-0000-0000-0000-000000000301' and numero_parcela = 1;
  v_result := public.liquidar_fatura(v_invoice, 399.99);

  if v_result->>'error' <> 'amount_mismatch' then
    raise exception 'Pagamento incorreto deveria retornar amount_mismatch. Resultado: %', v_result;
  end if;
end $$;

do $$
declare
  v_invoice uuid;
  v_first jsonb;
  v_second jsonb;
begin
  select id into v_invoice from public.faturas where contrato_id = '10000000-0000-0000-0000-000000000301' and numero_parcela = 1;
  v_first := public.liquidar_fatura(v_invoice, 400.00);

  if v_first->>'status' <> 'paid' then
    raise exception 'Pagamento correto deveria retornar paid. Resultado: %', v_first;
  end if;

  v_second := public.liquidar_fatura(v_invoice, 400.00);
  if v_second->>'status' <> 'already_paid' then
    raise exception 'Repetição deveria retornar already_paid. Resultado: %', v_second;
  end if;
end $$;

do $$
declare
  v_invoice uuid;
begin
  select id into v_invoice from public.faturas where contrato_id = '10000000-0000-0000-0000-000000000301' and numero_parcela = 1;

  begin
    update public.faturas set valor = 1.00 where id = v_invoice;
    raise exception 'Alteração de fatura paga deveria falhar';
  exception when others then
    if sqlerrm = 'Alteração de fatura paga deveria falhar' then
      raise;
    end if;
  end;
end $$;

do $$
declare
  v_invoice uuid;
begin
  select id into v_invoice from public.faturas where contrato_id = '10000000-0000-0000-0000-000000000301' and numero_parcela = 1;

  begin
    delete from public.faturas where id = v_invoice;
    raise exception 'Exclusão de fatura paga deveria falhar';
  exception when others then
    if sqlerrm = 'Exclusão de fatura paga deveria falhar' then
      raise;
    end if;
  end;
end $$;

do $$
begin
  if position('for update' in lower(pg_get_functiondef('public.liquidar_fatura(uuid,numeric)'::regprocedure))) = 0 then
    raise exception 'liquidar_fatura deve usar FOR UPDATE para concorrência';
  end if;
end $$;

do $$
begin
  if has_table_privilege('anon', 'public.faturas', 'INSERT') then
    raise exception 'anon não deve inserir faturas';
  end if;

  if has_table_privilege('authenticated', 'public.faturas', 'UPDATE') then
    raise exception 'authenticated não deve atualizar faturas diretamente';
  end if;

  if has_function_privilege('authenticated', 'public.liquidar_fatura(uuid,numeric)', 'EXECUTE') then
    raise exception 'authenticated não deve executar liquidar_fatura diretamente';
  end if;
end $$;

rollback;
