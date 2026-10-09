# Alu.GO Mini-Locação

Painel administrativo demonstrativo para gestão de mini-locação de motocicletas, desenvolvido para o desafio técnico da AluWare.

- Aplicação publicada: <https://alugo-mini-locacao-b6j8.vercel.app>
- Repositório: <https://github.com/Dylan-Barbieri/alugo-mini-locacao>
- Backend: Supabase PostgreSQL, Auth, RLS e Edge Functions

> O fluxo Pix deste projeto é **simulado**. Ele não integra provedor financeiro real e não movimenta dinheiro.

## Objetivo do desafio

Construir uma aplicação administrativa para cadastro de clientes e motocicletas, criação de contratos de locação, geração automática de faturas semanais e simulação segura de pagamento Pix, com autenticação administrativa e proteção por RLS no Supabase.

O enunciado original do desafio não está versionado neste repositório. A rastreabilidade das capacidades implementadas está documentada em [`docs/matriz-rastreabilidade.md`](docs/matriz-rastreabilidade.md).

## Funcionalidades implementadas

- Login administrativo com Supabase Auth.
- Proteção de rotas administrativas no frontend.
- Cadastro e listagem de clientes.
- Cadastro e listagem de motocicletas.
- Criação de contratos de locação.
- Geração automática de faturas semanais via trigger PostgreSQL.
- Listagem financeira de faturas.
- Liquidação de fatura por RPC transacional e idempotente.
- Edge Function pública de webhook protegida por segredo.
- Edge Function de simulação protegida por JWT, autorização de admin e flag operacional.
- RLS administrativa para dados sensíveis.
- Testes locais de regressão, webhook, smoke e E2E.

## Tecnologias

- React
- Vite
- TypeScript
- Tailwind CSS
- Supabase JS
- Supabase Auth
- PostgreSQL
- Row Level Security (RLS)
- Supabase Edge Functions
- Playwright
- Vercel

## Arquitetura da solução

### Frontend

- `src/app/router/AppRouter.tsx`: rotas SPA com lazy loading.
- `src/app/providers/AuthProvider.tsx`: sessão Supabase e verificação de admin via `public.is_admin()`.
- `src/app/router/ProtectedRoute.tsx`: bloqueio de rotas para anônimos e usuários não administradores.
- `src/services/adminData.ts`: camada de acesso aos dados administrativos e invocação de Edge Function.
- `src/features/*`: páginas de domínio.

### Backend Supabase

- Migrações em `supabase/migrations/`.
- Tabelas principais:
  - `public.app_admins`
  - `public.clientes`
  - `public.veiculos`
  - `public.contratos`
  - `public.faturas`
- Trigger de geração automática de faturas ao criar contrato ativo.
- RPC `public.liquidar_fatura(uuid, numeric)` para liquidação segura e idempotente.
- RLS habilitado nas tabelas administrativas.

### Edge Functions

- `supabase/functions/payment-webhook/index.ts`
  - `verify_jwt=false`.
  - Autenticada por `ALUGO_WEBHOOK_SECRET`.
  - Valida payload e chama exclusivamente `public.liquidar_fatura`.
- `supabase/functions/simulate-payment/index.ts`
  - `verify_jwt=true`.
  - Exige usuário autenticado e cadastrado em `public.app_admins`.
  - Só funciona quando `ALUGO_ENABLE_PAYMENT_SIMULATION=true`.

## Pré-requisitos

- Node.js compatível com o projeto.
- npm.
- Docker, para Supabase local e testes de integração.
- Supabase CLI.
- Conta/projeto Supabase, caso deseje reproduzir o backend remoto.

## Instalação local

```bash
npm ci
```

## Variáveis de ambiente do frontend

Crie um arquivo local `.env.local` ou configure variáveis no provedor de deploy:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<chave-publica-anon-ou-publishable>
```

Nunca coloque no frontend:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ALUGO_WEBHOOK_SECRET`
- senha do banco
- tokens privados
- secrets operacionais

O arquivo `.env.example` contém apenas placeholders públicos.

## Execução do frontend

```bash
npm run dev
```

Build de produção:

```bash
npm run build
```

Preview local:

```bash
npm run preview
```

## Supabase local

Iniciar stack local:

```bash
npm run db:start
```

Reset local com migrações e seed local:

```bash
npm run db:reset
```

> Não aplique `seed.sql` em produção sem revisão e autorização. O seed é voltado para desenvolvimento/local.

## Migrações do banco

As migrações estão em `supabase/migrations/` e cobrem fundação de tabelas, regras de negócio, trigger de faturas, RPC financeira, autenticação administrativa e hardening RLS.

Aplicação remota deve ser feita com fluxo controlado:

```bash
npx supabase db push --dry-run --linked
npx supabase db push --linked
```

Sempre valide o projeto vinculado antes de aplicar migrações remotas.

## Testes automatizados

Checks principais:

```bash
npm run lint
npm run build
npm run format:check
npm audit --audit-level=moderate
```

Testes de integração e E2E:

```bash
npm run test:webhook
npm run test:phase4
npm run test:simulation-disabled
npm run test:e2e
```

Testes SQL locais:

```bash
docker cp supabase/tests/phase2_business_rules.sql supabase_db_alugo-mini-locacao:/tmp/phase2_business_rules.sql
docker exec supabase_db_alugo-mini-locacao psql -U postgres -d postgres -f /tmp/phase2_business_rules.sql

docker cp supabase/tests/phase6_rls_hardening.sql supabase_db_alugo-mini-locacao:/tmp/phase6_rls_hardening.sql
docker exec supabase_db_alugo-mini-locacao psql -U postgres -d postgres -f /tmp/phase6_rls_hardening.sql
```

Esses testes SQL usam transação com `ROLLBACK`.

## Segurança e autenticação

- Login via Supabase Auth.
- Usuário só é administrador se existir em `public.app_admins`.
- `public.is_admin()` é usada nas policies e pelo frontend para bloquear rotas.
- RLS permanece habilitado nas tabelas administrativas.
- O frontend usa somente URL e chave pública do Supabase.
- A RPC financeira não é executável por `authenticated`.
- O webhook não aceita requisições sem segredo.
- A simulação Pix remota deve ficar desabilitada por padrão.

## Funcionamento do Pix simulado

O fluxo de pagamento é uma simulação técnica:

1. `simulate-payment` valida JWT, usuário e admin.
2. A função só prossegue se `ALUGO_ENABLE_PAYMENT_SIMULATION=true`.
3. Ela chama `payment-webhook` no backend com segredo interno.
4. `payment-webhook` valida o payload e chama `public.liquidar_fatura`.
5. A RPC liquida a fatura de forma transacional e idempotente.

Em produção, a simulação deve permanecer desabilitada, exceto em janelas controladas de homologação.

## Deploy

### Vercel

Configuração recomendada:

- Framework Preset: `Vite`
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: raiz do projeto

O arquivo `vercel.json` contém rewrite para SPA:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Supabase Edge Functions

Publicação controlada:

```bash
npx supabase functions deploy payment-webhook --project-ref <project-ref>
npx supabase functions deploy simulate-payment --project-ref <project-ref>
```

Secrets necessários no ambiente das Edge Functions:

- `ALUGO_WEBHOOK_SECRET`
- `ALUGO_ENABLE_PAYMENT_SIMULATION`

Os secrets internos do Supabase são fornecidos pelo ambiente da plataforma.

## Homologação

A homologação do ambiente publicado está documentada em [`docs/homologacao.md`](docs/homologacao.md).

Resumo observado:

- Banco remoto com migrações aplicadas.
- Edge Functions ativas.
- RLS administrativa validada.
- Contrato de teste com 4 faturas de R$ 400,00.
- Total de cobranças: R$ 1.600,00.
- Pagamento Pix simulado de R$ 400,00 validado com idempotência.
- Estado final: 1 fatura paga e 3 abertas, total aberto R$ 1.200,00.
- Simulação Pix restaurada para desabilitada.

## Limitações conhecidas

- O enunciado original do desafio não está versionado no repositório; a matriz documenta capacidades verificadas, não requisitos textuais originais.
- O Pix é simulado e não integra provedor financeiro real.
- A identidade visual usa logo placeholder, pois não foi fornecido arquivo oficial autorizado.
- A limpeza de dados de homologação, se necessária, deve ser autorizada e feita de forma seletiva.
- Configurações finais de URLs do Supabase Auth devem acompanhar o domínio público definitivo.
