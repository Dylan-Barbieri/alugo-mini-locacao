# Checklist de deploy — Fase 5

## Frontend — Vercel

- Conectar repositório GitHub ao projeto Vercel.
- Definir framework Vite.
- Build command: `npm run build`.
- Output directory: `dist`.
- Variáveis públicas:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Confirmar `vercel.json` com rewrite SPA para `index.html`.

## Supabase

- Criar projeto Supabase homologação/produção.
- Aplicar migrações com Supabase CLI apontando para o projeto correto.
- Não usar `supabase db reset` em banco remoto com dados reais.
- Configurar Auth conforme política desejada de criação de usuários.
- Criar administradores em `public.app_admins` manualmente e com rastreabilidade.
- Configurar secrets das Edge Functions:
  - `ALUGO_WEBHOOK_SECRET`
  - `ALUGO_ENABLE_PAYMENT_SIMULATION=false` em produção, salvo ambiente demo autorizado.

## Edge Functions

- Deployar `payment-webhook`.
- Deployar `simulate-payment` somente em ambiente demo/homologação autorizado.
- Validar CORS e autenticação.
- Confirmar que `payment-webhook` exige segredo e que `simulate-payment` exige JWT admin.

## Segurança

- Não expor `service_role` no frontend.
- Não versionar `.env.local`, `.env.e2e`, secrets ou tokens.
- Confirmar RLS habilitado em todas as tabelas sensíveis.
- Confirmar que `authenticated` não tem `insert/update/delete` em `faturas`.
- Confirmar idempotência da RPC `liquidar_fatura`.

## Validação antes de publicar

```bash
npm audit --audit-level=moderate
npm run lint
npm run build
npm run format:check
npm run test:webhook
npm run test:phase4
npm run test:e2e
```

## Custos e recursos

- Vercel: pode usar plano gratuito conforme limites.
- Supabase: pode usar plano gratuito conforme limites, mas Edge Functions/banco/autenticação podem ter limites por uso.
- GitHub: repositório privado/público conforme política do desafio.

Não executar deploy ou criar recursos pagos sem autorização explícita.
