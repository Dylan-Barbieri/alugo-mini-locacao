# Frontend administrativo — Fase 4

## Funcionalidades

- Login administrativo com Supabase Auth.
- Proteção de rotas por sessão e autorização em `public.app_admins`.
- Dashboard com indicadores reais: contratos ativos, faturas pendentes, pagas, atrasadas, total recebido e total pendente.
- CRUD básico autorizado de clientes e veículos.
- Criação de contratos; as faturas são geradas exclusivamente pelo trigger PostgreSQL.
- Financeiro com pesquisa, filtro por status, detalhes e simulação de pagamento Pix.

## Autorização

A autorização mínima usa a tabela:

```sql
public.app_admins(user_id uuid primary key references auth.users(id))
```

Usuários autenticados só conseguem escrever em `clientes`, `veiculos` e `contratos` quando `public.is_admin()` retorna `true`. Faturas permanecem sem escrita direta pelo frontend.

## Criar administrador local de demonstração

1. Suba o Supabase local:

```bash
npm run db:start
```

2. Crie um usuário pelo Supabase Studio/Auth UI ou pela API local.
3. Insira o `user_id` em `public.app_admins` usando SQL local:

```sql
insert into public.app_admins (user_id)
values ('uuid-do-usuario-auth');
```

Não versionar e-mails/senhas de demonstração.

## Fluxo de contratos

O frontend envia somente os dados do contrato:

- `cliente_id`
- `veiculo_id`
- `valor_semanal`
- `quantidade_semanas`
- `data_inicio`
- `status`

Quando o status é `ativo`, o banco gera as faturas automaticamente por trigger. O frontend apenas recarrega e exibe as parcelas geradas.

## Simulação de pagamento

O botão “Simular Pix” chama a Edge Function `simulate-payment` com sessão autenticada. Essa função:

1. valida o JWT;
2. verifica se o usuário é administrador;
3. busca a fatura no backend;
4. envia a notificação para `payment-webhook` usando `ALUGO_WEBHOOK_SECRET` no backend;
5. retorna a resposta para a interface.

O navegador nunca recebe `service_role` nem `ALUGO_WEBHOOK_SECRET`.

## Testes

```bash
npm run lint
npm run build
npm run format:check
npm run test:webhook
npm run test:phase4
```

`test:phase4` cria um usuário local temporário, torna-o admin via SQL no banco local e valida a simulação de pagamento passando pela Edge Function.
