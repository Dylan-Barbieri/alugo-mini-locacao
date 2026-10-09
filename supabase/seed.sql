-- Dados fictícios de demonstração para a Fase 2.
-- Não contém dados reais de clientes, documentos ou pagamentos.

insert into public.clientes (id, nome, documento, email, telefone)
values
  ('00000000-0000-0000-0000-000000000101', 'Cliente Demonstração Ana', '00000000001', 'ana.demo@example.com', '+55 11 90000-0001'),
  ('00000000-0000-0000-0000-000000000102', 'Cliente Demonstração Bruno', '00000000002', 'bruno.demo@example.com', '+55 11 90000-0002'),
  ('00000000-0000-0000-0000-000000000103', 'Cliente Demonstração Carla', '00000000003', 'carla.demo@example.com', '+55 11 90000-0003')
on conflict (id) do nothing;

insert into public.veiculos (id, marca, modelo, placa, cor, status)
values
  ('00000000-0000-0000-0000-000000000201', 'Haojue', 'DK 160', 'DEM0A01', 'Preta', 'locado'),
  ('00000000-0000-0000-0000-000000000202', 'Haojue', 'DK 160', 'DEM0B02', 'Azul', 'locado'),
  ('00000000-0000-0000-0000-000000000203', 'Haojue', 'DK 160', 'DEM0C03', 'Vermelha', 'disponivel')
on conflict (id) do nothing;

-- Contratos ativos geram faturas automaticamente pelo trigger.
insert into public.contratos (
  id,
  cliente_id,
  veiculo_id,
  status,
  valor_semanal,
  quantidade_semanas,
  inicio_em,
  data_inicio,
  fim_em
)
values
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000201',
    'ativo',
    400.00,
    4,
    date '2026-10-10',
    date '2026-10-10',
    date '2026-11-07'
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000202',
    'ativo',
    399.99,
    3,
    date '2026-10-12',
    date '2026-10-12',
    date '2026-11-02'
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000203',
    'encerrado',
    405.30,
    2,
    date '2026-09-01',
    date '2026-09-01',
    date '2026-09-15'
  )
on conflict (id) do nothing;
