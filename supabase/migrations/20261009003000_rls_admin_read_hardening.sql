-- Fase 6: hardening de leitura administrativa.
-- Remove policies amplas herdadas da Fase 1 e limita privilégios SQL ao mínimo necessário.

drop policy if exists "authenticated can read clientes" on public.clientes;
drop policy if exists "authenticated can read veiculos" on public.veiculos;
drop policy if exists "authenticated can read contratos" on public.contratos;
drop policy if exists "authenticated can read faturas" on public.faturas;

-- Garante que a leitura das tabelas administrativas dependa de public.is_admin().
drop policy if exists "admins can read clientes" on public.clientes;
create policy "admins can read clientes"
on public.clientes
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can read veiculos" on public.veiculos;
create policy "admins can read veiculos"
on public.veiculos
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins can read contratos" on public.contratos;
create policy "admins can read contratos"
on public.contratos
for select
to authenticated
using (public.is_admin());

-- A policy "admins can read faturas" já existe na migração anterior; recriada para idempotência.
drop policy if exists "admins can read faturas" on public.faturas;
create policy "admins can read faturas"
on public.faturas
for select
to authenticated
using (public.is_admin());

-- Reduz privilégios SQL concedidos às roles públicas. RLS continua habilitado e é a barreira final.
revoke all on public.app_admins from anon;
revoke all on public.app_admins from authenticated;
grant select on public.app_admins to authenticated;

revoke all on public.clientes from anon;
revoke all on public.veiculos from anon;
revoke all on public.contratos from anon;
revoke all on public.faturas from anon;

revoke all on public.clientes from authenticated;
revoke all on public.veiculos from authenticated;
revoke all on public.contratos from authenticated;
revoke all on public.faturas from authenticated;

grant select, insert, update on public.clientes to authenticated;
grant select, insert, update on public.veiculos to authenticated;
grant select, insert, update on public.contratos to authenticated;
grant select on public.faturas to authenticated;

-- Mantém a RPC financeira inacessível ao navegador autenticado comum.
revoke all on function public.liquidar_fatura(uuid, numeric) from public;
revoke all on function public.liquidar_fatura(uuid, numeric) from anon;
revoke all on function public.liquidar_fatura(uuid, numeric) from authenticated;
grant execute on function public.liquidar_fatura(uuid, numeric) to service_role;
