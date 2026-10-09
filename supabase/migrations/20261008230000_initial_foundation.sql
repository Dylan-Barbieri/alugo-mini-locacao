-- Fase 1: infraestrutura inicial de dados para Alu.GO Mini-Locação.
-- A autenticação completa, regras financeiras e geração automática de faturas serão detalhadas na Fase 2.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.veiculo_status as enum ('disponivel', 'locado', 'manutencao', 'inativo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contrato_status as enum ('rascunho', 'ativo', 'suspenso', 'encerrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fatura_status as enum ('aberta', 'vencida', 'paga', 'cancelada');
exception when duplicate_object then null; end $$;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) >= 2),
  documento text not null unique,
  telefone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  modelo text not null default 'Haojue DK 160',
  cor text,
  status public.veiculo_status not null default 'disponivel',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  veiculo_id uuid not null references public.veiculos(id) on delete restrict,
  status public.contrato_status not null default 'rascunho',
  valor_semanal numeric(12,2) not null check (valor_semanal > 0),
  inicio_em date not null,
  fim_em date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim_em is null or fim_em >= inicio_em)
);

create table if not exists public.faturas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete restrict,
  valor numeric(12,2) not null check (valor > 0),
  vencimento_em date not null,
  status public.fatura_status not null default 'aberta',
  pago_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'paga' and pago_em is not null) or (status <> 'paga' and pago_em is null))
);

create index if not exists idx_contratos_cliente_id on public.contratos(cliente_id);
create index if not exists idx_contratos_veiculo_id on public.contratos(veiculo_id);
create index if not exists idx_contratos_status on public.contratos(status);
create index if not exists idx_faturas_contrato_id on public.faturas(contrato_id);
create index if not exists idx_faturas_status_vencimento on public.faturas(status, vencimento_em);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_paid_invoice_changes()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'paga' and (new.valor is distinct from old.valor or new.status is distinct from old.status or new.pago_em is distinct from old.pago_em) then
    raise exception 'Faturas pagas não podem ter valor, status ou data de pagamento alterados';
  end if;
  return new;
end;
$$;

drop trigger if exists set_clientes_updated_at on public.clientes;
create trigger set_clientes_updated_at before update on public.clientes for each row execute function public.set_updated_at();

drop trigger if exists set_veiculos_updated_at on public.veiculos;
create trigger set_veiculos_updated_at before update on public.veiculos for each row execute function public.set_updated_at();

drop trigger if exists set_contratos_updated_at on public.contratos;
create trigger set_contratos_updated_at before update on public.contratos for each row execute function public.set_updated_at();

drop trigger if exists set_faturas_updated_at on public.faturas;
create trigger set_faturas_updated_at before update on public.faturas for each row execute function public.set_updated_at();

drop trigger if exists prevent_paid_invoice_changes on public.faturas;
create trigger prevent_paid_invoice_changes before update on public.faturas for each row execute function public.prevent_paid_invoice_changes();

alter table public.clientes enable row level security;
alter table public.veiculos enable row level security;
alter table public.contratos enable row level security;
alter table public.faturas enable row level security;

-- Políticas mínimas de leitura para usuários autenticados. Escrita fica bloqueada até perfis/papéis da Fase 2.
drop policy if exists "authenticated can read clientes" on public.clientes;
create policy "authenticated can read clientes" on public.clientes for select to authenticated using (true);

drop policy if exists "authenticated can read veiculos" on public.veiculos;
create policy "authenticated can read veiculos" on public.veiculos for select to authenticated using (true);

drop policy if exists "authenticated can read contratos" on public.contratos;
create policy "authenticated can read contratos" on public.contratos for select to authenticated using (true);

drop policy if exists "authenticated can read faturas" on public.faturas;
create policy "authenticated can read faturas" on public.faturas for select to authenticated using (true);
