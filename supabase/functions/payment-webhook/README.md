# payment-webhook

Edge Function para webhook Pix simulado da Fase 3.

## Contrato HTTP

`POST /functions/v1/payment-webhook`

Headers aceitos para autenticação simulada:

- `x-alugo-webhook-secret: <segredo>`; ou
- `Authorization: Bearer <segredo>`.

Payload:

```json
{
  "fatura_id": "uuid-da-fatura",
  "valor_pago": 400.0,
  "evento": "PAYMENT_RECEIVED"
}
```

## Segurança

O segredo `ALUGO_WEBHOOK_SECRET` fica apenas no ambiente da Edge Function. O frontend não deve conhecer esse valor.

A função chama a RPC `public.liquidar_fatura(uuid, numeric)` usando `SUPABASE_SERVICE_ROLE_KEY`. A liquidação permanece transacional e idempotente no PostgreSQL.

Em um gateway real, a autenticação simulada por segredo compartilhado deverá ser substituída ou complementada por validação oficial do provedor, como assinatura HMAC, IP allowlist quando aplicável, identificador de evento e consulta de confirmação no gateway.
