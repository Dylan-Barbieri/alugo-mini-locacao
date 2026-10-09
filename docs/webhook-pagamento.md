# Webhook de pagamento Pix simulado — Fase 3

## Arquitetura

A Edge Function `payment-webhook` recebe notificações simuladas de pagamento e delega a liquidação à RPC PostgreSQL existente `public.liquidar_fatura(uuid, numeric)`.

Fluxo:

1. Requisição `POST` chega em `/functions/v1/payment-webhook`.
2. A Edge Function valida autenticação por segredo compartilhado.
3. O JSON é validado: UUID, valor positivo e evento `PAYMENT_RECEIVED`.
4. A função chama a RPC `liquidar_fatura` usando credencial administrativa do backend.
5. O PostgreSQL bloqueia a linha com `FOR UPDATE`, confere valor/status, marca como `paga` e grava `pago_em` em `timestamptz`.
6. A Edge Function traduz o resultado da RPC para resposta HTTP padronizada.

A Edge Function não faz atualização manual da fatura. A transação e a idempotência ficam centralizadas no banco.

## Variáveis de ambiente

Backend/Edge Function:

```env
ALUGO_WEBHOOK_SECRET=valor-forte-exclusivo-do-backend
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

Não coloque `ALUGO_WEBHOOK_SECRET` ou `SUPABASE_SERVICE_ROLE_KEY` no frontend nem em arquivos versionados.

## Autenticação simulada

O webhook aceita um segredo compartilhado em um destes formatos:

```http
x-alugo-webhook-secret: <segredo>
```

ou:

```http
Authorization: Bearer <segredo>
```

Essa autenticação é suficiente apenas para demonstração técnica. Em um gateway real, como Asaas, será necessário validar assinatura oficial/HMAC, metadados do evento, origem da notificação e, quando aplicável, consultar o gateway para confirmação do pagamento.

## Payload

```json
{
  "fatura_id": "uuid-da-fatura",
  "valor_pago": "400.00",
  "evento": "PAYMENT_RECEIVED"
}
```

`valor_pago` pode ser número JSON ou string decimal com até duas casas. Internamente a Edge Function normaliza para centavos/string decimal antes de chamar a RPC, evitando depender de comparação financeira em ponto flutuante.

## Respostas

### Pagamento processado

```json
{
  "ok": true,
  "status": "paid",
  "fatura_id": "...",
  "pago_em": "2026-10-08T23:00:00.000Z",
  "pago_em_sao_paulo": "2026-10-08 20:00:00"
}
```

### Webhook duplicado válido

```json
{
  "ok": true,
  "status": "already_paid",
  "message": "Pagamento já havia sido processado.",
  "fatura_id": "...",
  "pago_em": "2026-10-08T23:00:00.000Z",
  "pago_em_sao_paulo": "2026-10-08 20:00:00"
}
```

### Erros padronizados

- `400`: JSON/payload inválido.
- `401`: autenticação ausente ou inválida.
- `404`: fatura inexistente.
- `405`: método não permitido.
- `409`: valor divergente ou estado incompatível.
- `500`: configuração ausente ou erro interno controlado.

## Execução local

Suba o Supabase local:

```bash
npm run db:start
```

Sirva a função com segredo local de demonstração:

```bash
npx supabase functions serve payment-webhook --no-verify-jwt --env-file caminho/para/edge.env
```

Exemplo de `edge.env` local, não versionado:

```env
ALUGO_WEBHOOK_SECRET=local-demo-secret
```

O runtime local do Supabase injeta as variáveis administrativas necessárias. Em produção, configure os secrets pelo painel/CLI do Supabase.

## Requisição de teste

```bash
curl -X POST "http://127.0.0.1:54321/functions/v1/payment-webhook" \
  -H "content-type: application/json" \
  -H "x-alugo-webhook-secret: local-demo-secret" \
  -d '{"fatura_id":"uuid-da-fatura","valor_pago":"400.00","evento":"PAYMENT_RECEIVED"}'
```

## Testes automatizados

Com Supabase local ativo:

```bash
npm run test:webhook
```

O teste cria dados fictícios no banco local, chama a Edge Function real, valida idempotência, preservação de `pago_em`, autenticação, erros de payload, divergência de valor, fatura inexistente e chamadas concorrentes.

## Simulação segura

Nesta fase não há botão no frontend. A simulação autorizada é feita pelo script `scripts/payment-webhook-integration.mjs`, executado localmente, com segredo temporário no backend. A interface administrativa para selecionar fatura e disparar simulação ficará para a Fase 4.
