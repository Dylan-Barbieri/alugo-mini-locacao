\set ON_ERROR_STOP on

begin;

-- IDs fixos e dados fictícios isolados pela transação.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'common@example.com', 'x', now(), now(), now()),
  ('30000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'admin@example.com', 'x', now(), now(), now())
on conflict (id) do nothing;

insert into public.app_admins (user_id)
values ('30000000-0000-4000-8000-000000000002')
on conflict (user_id) do nothing;

insert into public.clientes (id, nome, documento, email, telefone)
values ('30000000-0000-4000-8001-000000000001', 'Cliente RLS', 'RLS001', 'rls@example.com', '+55 11 90000-0000');

insert into public.veiculos (id, marca, modelo, placa, cor, status)
values ('30000000-0000-4000-8002-000000000001', 'Haojue', 'DK 160', 'RLS0001', 'Preta', 'locado');

insert into public.contratos (
  id, cliente_id, veiculo_id, valor_semanal, quantidade_semanas, data_inicio, inicio_em, fim_em, status
) values (
  '30000000-0000-4000-8003-000000000001',
  '30000000-0000-4000-8001-000000000001',
  '30000000-0000-4000-8002-000000000001',
  400.00,
  2,
  date '2026-10-10',
  date '2026-10-10',
  date '2026-10-24',
  'ativo'
);

-- Anônimo não acessa dados administrativos.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin perform count(*) from public.clientes; raise exception 'anon leu clientes'; exception when insufficient_privilege then null; end;
  begin perform count(*) from public.veiculos; raise exception 'anon leu veiculos'; exception when insufficient_privilege then null; end;
  begin perform count(*) from public.contratos; raise exception 'anon leu contratos'; exception when insufficient_privilege then null; end;
  begin perform count(*) from public.faturas; raise exception 'anon leu faturas'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Usuário autenticado comum também não acessa dados administrativos.
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
do $$
begin
  if public.is_admin() then raise exception 'usuario comum foi considerado admin'; end if;
  if (select count(*) from public.clientes) <> 0 then raise exception 'usuario comum leu clientes'; end if;
  if (select count(*) from public.veiculos) <> 0 then raise exception 'usuario comum leu veiculos'; end if;
  if (select count(*) from public.contratos) <> 0 then raise exception 'usuario comum leu contratos'; end if;
  if (select count(*) from public.faturas) <> 0 then raise exception 'usuario comum leu faturas'; end if;

  begin
    insert into public.clientes (nome, documento) values ('Cliente bloqueado', 'RLS-BLOCK');
    raise exception 'usuario comum inseriu cliente';
  exception when insufficient_privilege then
    null;
  when check_violation then
    null;
  end;
end $$;
reset role;

-- Administrador consegue ler, escrever tabelas autorizadas e criar contrato que gera faturas.
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
do $$
declare
  v_cliente uuid;
  v_veiculo uuid;
  v_contrato uuid;
  v_fatura uuid;
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'admin não foi reconhecido'; end if;
  if (select count(*) from public.clientes) = 0 then raise exception 'admin não leu clientes'; end if;
  if (select count(*) from public.veiculos) = 0 then raise exception 'admin não leu veiculos'; end if;
  if (select count(*) from public.contratos) = 0 then raise exception 'admin não leu contratos'; end if;
  if (select count(*) from public.faturas) = 0 then raise exception 'admin não leu faturas'; end if;

  insert into public.clientes (nome, documento) values ('Cliente Admin RLS', 'RLS-ADMIN') returning id into v_cliente;
  insert into public.veiculos (marca, modelo, placa, status) values ('Haojue', 'DK 160', 'RLSA001', 'locado') returning id into v_veiculo;
  insert into public.contratos (cliente_id, veiculo_id, valor_semanal, quantidade_semanas, data_inicio, inicio_em, status)
  values (v_cliente, v_veiculo, 410.00, 1, date '2026-11-01', date '2026-11-01', 'ativo') returning id into v_contrato;

  if (select count(*) from public.faturas where contrato_id = v_contrato) <> 1 then
    raise exception 'trigger não gerou fatura para contrato admin';
  end if;

  select id into v_fatura from public.faturas where contrato_id = v_contrato limit 1;

  begin
    update public.faturas set status = 'paga' where id = v_fatura;
    raise exception 'admin atualizou fatura diretamente';
  exception when insufficient_privilege then
    null;
  when check_violation then
    null;
  end;

  begin
    v_result := public.liquidar_fatura(v_fatura, 410.00);
    raise exception 'admin executou liquidar_fatura diretamente: %', v_result;
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

-- Liquidação continua possível por caminho privilegiado (service_role/postgres) e preserva RPC.
do $$
declare
  v_fatura uuid;
  v_result jsonb;
begin
  select f.id into v_fatura
  from public.faturas f
  join public.contratos c on c.id = f.contrato_id
  where c.id = '30000000-0000-4000-8003-000000000001'
  order by f.numero_parcela
  limit 1;

  v_result := public.liquidar_fatura(v_fatura, 400.00);
  if v_result->>'status' <> 'paid' then
    raise exception 'liquidação privilegiada falhou: %', v_result;
  end if;
end $$;

rollback;
