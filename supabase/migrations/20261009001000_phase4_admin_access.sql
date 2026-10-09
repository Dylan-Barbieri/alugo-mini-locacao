-- Fase 4: autenticação administrativa mínima e políticas de escrita controlada.

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, auth, pg_temp
stable
as $$
  select exists (
    select 1
    from public.app_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;

drop policy if exists "admins can read app_admins" on public.app_admins;
create policy "admins can read app_admins"
on public.app_admins
for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists "admins can manage clientes" on public.clientes;
create policy "admins can manage clientes"
on public.clientes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins can manage veiculos" on public.veiculos;
create policy "admins can manage veiculos"
on public.veiculos
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins can manage contratos" on public.contratos;
create policy "admins can manage contratos"
on public.contratos
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins can read faturas" on public.faturas;
create policy "admins can read faturas"
on public.faturas
for select
to authenticated
using (public.is_admin());

grant select on public.app_admins to authenticated;
grant select, insert, update on public.clientes to authenticated;
grant select, insert, update on public.veiculos to authenticated;
grant select, insert, update on public.contratos to authenticated;
grant select on public.faturas to authenticated;

revoke delete on public.clientes from authenticated;
revoke delete on public.veiculos from authenticated;
revoke delete on public.contratos from authenticated;
revoke insert, update, delete on public.faturas from authenticated;
