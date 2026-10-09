# Modelagem e regras de negócio — Fase 2

## Entidades

### clientes

- `id uuid` chave primária com `gen_random_uuid()`.
- `nome`, `documento`, `email`, `telefone`.
- `created_at` e `updated_at` em `timestamptz`.
- `documento` único.

### veiculos

- `id uuid` chave primária.
- `marca`, `modelo`, `placa`, `cor`, `status`.
- `placa` única.
- `status` usa enum `veiculo_status`.

### contratos

- `id uuid` chave primária.
- `cliente_id` e `veiculo_id` com `on delete restrict`.
- `valor_semanal numeric(12,2)` com valor positivo.
- `quantidade_semanas integer` positiva.
- `data_inicio date`.
- `inicio_em date` mantido por compatibilidade com a Fase 1 e sincronizado com `data_inicio`.
- `status` usa enum `contrato_status`.

### faturas

- `id uuid` chave primária.
- `contrato_id` com `on delete restrict`.
- `numero_parcela integer` positivo.
- `valor numeric(12,2)` positivo.
- `data_vencimento date`.
- `vencimento_em date` mantido por compatibilidade com a Fase 1 e sincronizado com `data_vencimento`.
- `status` usa enum `fatura_status`.
- `pago_em timestamptz` para o instante real de pagamento.
- `unique (contrato_id, numero_parcela)` impede parcelas duplicadas.

## Geração automática de faturas

A função `public.generate_invoices_for_active_contract()` é executada por triggers em `contratos`:

- `generate_invoices_after_contract_insert`: após inserir contrato.
- `generate_invoices_after_contract_activation`: após alterar status para `ativo`.

Regras:

- somente contratos com status `ativo` geram faturas;
- contratos inativos, encerrados, suspensos ou rascunho não geram faturas;
- a quantidade gerada é igual a `quantidade_semanas`;
- o primeiro vencimento é `data_inicio + 7 dias`;
- os vencimentos seguintes avançam semanalmente;
- o valor de cada fatura é exatamente `valor_semanal`;
- a constraint única bloqueia duplicidade de parcela por contrato.

## Proteção de faturas pagas

Triggers no banco impedem:

- alterar valor de fatura paga;
- cancelar ou reverter fatura paga;
- alterar `pago_em` após pagamento;
- alterar contrato vinculado, número da parcela ou vencimento de fatura paga;
- excluir fatura paga.

Essas proteções ficam no PostgreSQL, não apenas na interface.

## Liquidação atômica

A RPC `public.liquidar_fatura(p_fatura_id uuid, p_valor_pago numeric)`:

1. valida entrada;
2. localiza a fatura com `FOR UPDATE`;
3. retorna erro controlado se não existir;
4. valida valor exato;
5. exige status `aberta`;
6. atualiza para `paga`;
7. registra `pago_em = now()` em `timestamptz`;
8. retorna JSON estruturado.

Idempotência: se a fatura já estiver paga e o valor recebido for o mesmo, a função retorna `status: "already_paid"` sem alterar dados.

## Datas e fuso horário

`pago_em` é armazenado como `timestamptz`. A exibição em horário de Brasília deve usar `America/Sao_Paulo`, sem deslocamentos fixos de UTC. A RPC retorna um campo auxiliar formatado `pago_em_sao_paulo` para consumo futuro.

## Segurança e RLS

- RLS permanece habilitado em todas as tabelas.
- `anon` não recebe privilégios nas tabelas.
- `authenticated` possui leitura, mas não escrita direta em contratos/faturas.
- A RPC de liquidação tem `SECURITY DEFINER` com `search_path` seguro.
- Execução da RPC é revogada de `public`, `anon` e `authenticated`, e concedida apenas a `service_role`.

A Edge Function futura deverá usar ambiente seguro do Supabase, validar origem do webhook e chamar a RPC pelo backend, nunca pelo frontend público.

## Migrações e testes

Aplicar localmente, com Supabase CLI instalado:

```bash
supabase db reset
```

Executar testes SQL em ambiente isolado:

```bash
psql "$DATABASE_URL" -f supabase/tests/phase2_business_rules.sql
```

Alternativa sem `psql` instalado no host:

```bash
docker cp supabase/tests/phase2_business_rules.sql supabase_db_alugo-mini-locacao:/tmp/phase2_business_rules.sql
docker exec supabase_db_alugo-mini-locacao psql -U postgres -d postgres -f /tmp/phase2_business_rules.sql
```

Os testes rodam dentro de transação e executam `rollback` ao final.
