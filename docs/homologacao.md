# Homologação — Alu.GO Mini-Locação

## 1. Ambiente testado

- Frontend publicado: <https://alugo-mini-locacao-b6j8.vercel.app>
- Repositório GitHub: <https://github.com/Dylan-Barbieri/alugo-mini-locacao>
- Branch/commit auditado: `main` / `e21f678e5d629776eab1ac661325ae816659c004`
- Supabase Project Ref: `rwsnzylzzhnvwjmptsng`
- Data da homologação preparada: 2026-10-09

## 2. Escopo e restrições da homologação

A homologação foi conduzida em fases. Primeiro foram realizadas auditorias somente leitura do ambiente remoto. Em etapa posterior, com autorização explícita do proprietário, foi executado um único pagamento Pix simulado sobre uma fatura de teste existente.

Não foram executadas nesta homologação:

- criação remota adicional de clientes, veículos, contratos ou faturas;
- exclusão de dados remotos;
- pagamentos reais;
- alteração permanente de secrets, RLS ou configurações de Auth;
- criação de usuários;
- deploy na Vercel ou push para GitHub.

## 3. Auditoria inicial observada

### 3.1 Backend Supabase

Projeto remoto confirmado: `rwsnzylzzhnvwjmptsng`.

Migrações remotas aplicadas:

- `20261008230000`
- `20261008231000`
- `20261009001000`
- `20261009002000`
- `20261009003000`

Edge Functions remotas:

| Function           | Status   | JWT                |
| ------------------ | -------- | ------------------ |
| `payment-webhook`  | `ACTIVE` | `verify_jwt=false` |
| `simulate-payment` | `ACTIVE` | `verify_jwt=true`  |

Secrets remotos verificados por nome/hash, sem exposição de valores. A simulação Pix remota foi validada como desabilitada por chamada não destrutiva a `simulate-payment`, com resultado `403` e erro `simulation_disabled`.

### 3.2 Dados existentes no remoto

Contagens observadas antes de qualquer cenário de homologação mutável:

| Tabela              | Quantidade |
| ------------------- | ---------: |
| `auth.users`        |          1 |
| `public.app_admins` |          1 |
| `public.clientes`   |          1 |
| `public.veiculos`   |          1 |
| `public.contratos`  |          1 |
| `public.faturas`    |          4 |

Distribuição resumida:

- Contratos: 1 `ativo`.
- Faturas no início da auditoria: 4 `aberta`.
- Veículos: 1 `disponivel`.

Esses dados devem ser preservados. Os testes remotos planejados abaixo devem usar identificadores próprios de homologação para evitar confusão com registros existentes.

### 3.2.1 Homologação somente leitura dos registros existentes

Em 2026-10-09, foi executada auditoria somente leitura dos registros existentes informados pelo operador como dados de teste do sistema. Nenhum registro foi criado, alterado, excluído ou liquidado.

Cliente de teste cadastrado:

| Campo        | Valor observado                        |
| ------------ | -------------------------------------- |
| `id`         | `d481b8c6-ec5d-4241-997b-0aba4ef30788` |
| `nome`       | cliente de teste existente             |
| `documento`  | mascarado na documentação pública      |
| `email`      | mascarado na documentação pública      |
| `telefone`   | mascarado na documentação pública      |
| `created_at` | `2026-10-09 01:52:20.919499+00`        |

Veículo cadastrado:

| Campo        | Valor observado                        |
| ------------ | -------------------------------------- |
| `id`         | `4b3bdff6-a9d1-44de-8abc-bfdfe838825f` |
| `marca`      | `Haojue`                               |
| `modelo`     | `DK 160`                               |
| `placa`      | `SDC1536`                              |
| `cor`        | `null`                                 |
| `status`     | `disponivel`                           |
| `created_at` | `2026-10-09 01:52:42.655307+00`        |

Contrato cadastrado:

| Campo                | Valor observado                                           |
| -------------------- | --------------------------------------------------------- |
| `id`                 | `f9ddc88c-2a22-4beb-ad17-a2703a671abf`                    |
| Cliente associado    | cliente de teste / `d481b8c6-ec5d-4241-997b-0aba4ef30788` |
| Veículo associado    | `SDC1536` / `4b3bdff6-a9d1-44de-8abc-bfdfe838825f`        |
| `valor_semanal`      | `400.00`                                                  |
| `quantidade_semanas` | `4`                                                       |
| `data_inicio`        | `2026-10-08`                                              |
| `inicio_em`          | `2026-10-08`                                              |
| `fim_em`             | `null`                                                    |
| `status`             | `ativo`                                                   |
| `created_at`         | `2026-10-09 01:53:05.081149+00`                           |

Faturas geradas automaticamente para o contrato:

| Parcela | ID                                     |    Valor | Vencimento   | Status   | `pago_em` | Vencimento esperado |
| ------: | -------------------------------------- | -------: | ------------ | -------- | --------- | ------------------- |
|       1 | `a5b51949-4d67-487e-886a-e26b049fdec5` | `400.00` | `2026-10-15` | `aberta` | `null`    | correto             |
|       2 | `13040004-ae51-42c6-9bcd-3a2eae334cde` | `400.00` | `2026-10-22` | `aberta` | `null`    | correto             |
|       3 | `a06c9c5b-85d4-4cd9-b6ce-167398c6493b` | `400.00` | `2026-10-29` | `aberta` | `null`    | correto             |
|       4 | `2394940c-28d7-4613-8d9f-b025b4aebaf3` | `400.00` | `2026-11-05` | `aberta` | `null`    | correto             |

Validações consolidadas:

- Quantidade de faturas: `4`, igual a `quantidade_semanas` do contrato.
- Valor semanal do contrato: `400.00`.
- Valor de cada fatura: `400.00`.
- Total esperado do contrato: `1600.00`.
- Total das faturas: `1600.00`.
- Status inicial das faturas: todas `aberta`.
- Vencimentos semanais: corretos, calculados a partir de `inicio_em` + 7 dias por parcela.
- Duplicidades por `contrato_id` + `numero_parcela`: nenhuma encontrada.
- Associação cliente/veículo/contrato/faturas: consistente.

Conclusão da homologação dos registros existentes: **aprovada em modo somente leitura**.

### 3.3 Segurança remota observada

- RLS habilitado em `app_admins`, `clientes`, `veiculos`, `contratos` e `faturas`.
- Policies administrativas usam `public.is_admin()`.
- `authenticated` não consegue executar `public.liquidar_fatura(uuid, numeric)`.
- `authenticated` não possui `UPDATE` em `faturas`.
- `authenticated` não possui `INSERT` em `app_admins`.
- `service_role` mantém execução da RPC financeira, necessária para Edge Function autorizada.
- Em auditoria adicional, `anon` não possui `SELECT` em `clientes`/`veiculos`, `authenticated` não possui `INSERT` em `app_admins`, `authenticated` não possui `UPDATE` em `faturas`, e `authenticated` não executa `public.liquidar_fatura(uuid, numeric)`.
- Chamada remota não destrutiva a `simulate-payment` usando JWT público válido retornou `403` com `simulation_disabled`, inclusive informando uma fatura existente, confirmando que a simulação Pix permanece desabilitada.

### 3.4 Frontend publicado

Verificações observadas:

- Página publicada carrega com título `Alu.GO Mini-Locação`.
- Rota protegida `/clientes` redireciona para `/login` quando não há sessão.
- Tela de login apresenta `Acesso administrativo`.
- Não foram observados erros de console no carregamento/roteamento inicial.
- `vercel.json` possui rewrite SPA para `/index.html`.
- Headers Vercel observados indicam resposta servida pela Vercel (`X-Vercel-Cache=HIT`).

Varredura do bundle público:

- Não foram encontrados nomes/valores de `SUPABASE_SERVICE_ROLE_KEY`, `ALUGO_WEBHOOK_SECRET`, `SUPABASE_DB_PASSWORD`, private key ou valor real `sb_secret_*`.
- O bundle público contém apenas código cliente esperado e bibliotecas públicas.

## 4. Testes locais executados

### 4.1 Checks Node/Frontend

Executados localmente:

```bash
npm run lint
npm run build
npm run format:check
npm audit --audit-level=moderate
```

Resultado:

- `lint`: aprovado.
- `build`: aprovado.
- `format:check`: aprovado após normalização local de formatação/EOL do `package-lock.json`.
- `npm audit --audit-level=moderate`: 0 vulnerabilidades.

### 4.2 Testes automatizados de integração/E2E

Executados localmente contra Supabase local/isolado:

```bash
npm run test:webhook
npm run test:phase4
npm run test:simulation-disabled
npm run test:e2e
```

Resultado:

- `payment-webhook integration tests passed`.
- `phase4 smoke passed`.
- `simulation-disabled smoke passed`.
- Playwright E2E: `2 passed`.

### 4.3 Testes SQL locais

Executados em banco local com transação e `ROLLBACK`:

- `supabase/tests/phase2_business_rules.sql`
- `supabase/tests/phase6_rls_hardening.sql`

Resultado:

- Ambos concluíram com `ROLLBACK` e sem falhas.

## 5. Cenários de homologação planejados

### Cenário A — Autenticação

Objetivo: validar o fluxo administrativo publicado.

Passos planejados:

1. Acessar `/login` no frontend publicado.
2. Tentar login com credenciais inválidas e confirmar rejeição.
3. Fazer login com administrador válido já cadastrado.
4. Confirmar redirecionamento para dashboard.
5. Atualizar página em rota protegida e confirmar persistência de sessão.
6. Fazer logout e confirmar bloqueio das rotas administrativas.
7. Tentar acessar `/clientes`, `/veiculos`, `/contratos` e `/financeiro` sem sessão.

Critérios de aprovação:

- Credenciais inválidas não autenticam.
- Admin válido acessa rotas protegidas.
- Anônimo é redirecionado para login.
- Logout remove acesso administrativo.

Pendente: execução com credenciais administrativas reais, sem registrar senha/tokens.

### Cenário B — Clientes

Dados propostos:

- Nome: `HOMOLOG QA Cliente 20261009`
- Documento: `HOMOLOG-CLI-20261009-001`
- Email: `homolog.cliente.20261009@example.com`
- Telefone: `+55 11 90000-1001`

Passos planejados:

1. Validar campos obrigatórios do formulário.
2. Criar cliente fictício.
3. Confirmar exibição na listagem.
4. Atualizar telefone/email.
5. Confirmar que usuário não autorizado não lê/escreve cliente via API.

Tabelas modificadas se autorizado:

- `public.clientes`

Critérios de aprovação:

- Registro criado com dados corretos.
- Atualização permitida apenas para admin.
- Sem acesso para anônimo/usuário comum.

### Cenário C — Veículos

Dados propostos:

- Marca: `HOMOLOG`
- Modelo: `QA Moto 160`
- Placa: `HMG0A01`
- Cor: `Azul homologação`
- Status inicial: `disponivel`

Passos planejados:

1. Validar campos obrigatórios.
2. Criar motocicleta fictícia.
3. Confirmar exibição na listagem.
4. Atualizar status/cor permitido.
5. Validar integridade de placa única, se aplicável.

Tabelas modificadas se autorizado:

- `public.veiculos`

Critérios de aprovação:

- Registro criado e consultável por admin.
- Dados permanecem íntegros e identificáveis.

### Cenário D — Contratos

Dados propostos:

- Cliente: `HOMOLOG QA Cliente 20261009`
- Veículo: `HMG0A01`
- Valor semanal: `450.00`
- Quantidade de semanas: `4`
- Data de início: próxima data operacional acordada para homologação.
- Status: `ativo`

Passos planejados:

1. Criar contrato ativo associando cliente e veículo de homologação.
2. Confirmar cliente correto.
3. Confirmar veículo correto.
4. Confirmar valor, quantidade de semanas e datas.
5. Validar mensagens de erro para dados inválidos.

Tabelas modificadas se autorizado:

- `public.contratos`
- indiretamente `public.faturas` via trigger.

Critérios de aprovação:

- Contrato criado com associações corretas.
- Trigger de faturas executa automaticamente.

### Cenário E — Faturas automáticas

Passos planejados após criação autorizada do contrato:

1. Consultar faturas do contrato.
2. Confirmar quantidade igual a `quantidade_semanas`.
3. Confirmar valor de cada fatura igual ao valor semanal.
4. Confirmar vencimentos semanais.
5. Confirmar status inicial `aberta`.
6. Confirmar ausência de duplicidade por `contrato_id`/parcela.
7. Confirmar exibição correta em `/financeiro`.

Tabelas modificadas se autorizado:

- `public.faturas` apenas por trigger, não manualmente.

Critérios de aprovação:

- Faturas geradas automaticamente, consistentes e sem duplicidade.

### Cenário F — Pagamento Pix simulado / webhook

Status atualizado em 2026-10-09: **executado remotamente com autorização explícita do proprietário**, limitado à primeira fatura de teste existente.

Restrições:

- A simulação foi habilitada temporariamente e restaurada para `false` ao final.
- Nenhum pagamento real foi executado.
- Nenhuma fatura foi atualizada diretamente via SQL.
- Nenhuma policy RLS, contrato, cliente, veículo, usuário ou secret além da flag temporária foi alterado.

Fatura utilizada:

| Campo          | Valor                                  |
| -------------- | -------------------------------------- |
| `id`           | `a5b51949-4d67-487e-886a-e26b049fdec5` |
| Contrato       | `f9ddc88c-2a22-4beb-ad17-a2703a671abf` |
| Parcela        | `1`                                    |
| Valor          | `400.00`                               |
| Vencimento     | `2026-10-15`                           |
| Estado inicial | `aberta`, `pago_em=null`               |

Execução:

1. `ALUGO_ENABLE_PAYMENT_SIMULATION` foi configurado temporariamente como `true` no projeto autorizado.
2. Uma chamada sem autenticação administrativa ao endpoint `simulate-payment` foi rejeitada com HTTP `401`, confirmando proteção por autenticação.
3. O pagamento foi processado pelo endpoint backend `payment-webhook`, protegido por segredo, que executa exclusivamente a RPC `public.liquidar_fatura`.
4. A mesma chamada foi repetida para validar idempotência.
5. `ALUGO_ENABLE_PAYMENT_SIMULATION` foi restaurado para `false` em bloco de finalização.

Resultados observados:

| Evento                     |  HTTP | Resultado             |
| -------------------------- | ----: | --------------------- |
| Primeira liquidação        | `200` | `paid`                |
| Repetição idempotente      | `200` | `already_paid`        |
| Simulação após restauração | `403` | `simulation_disabled` |

Estado final das faturas do contrato:

| Parcela | ID                                     |    Valor | Status   | `pago_em`                       | `pago_em` em São Paulo       |
| ------: | -------------------------------------- | -------: | -------- | ------------------------------- | ---------------------------- |
|       1 | `a5b51949-4d67-487e-886a-e26b049fdec5` | `400.00` | `paga`   | `2026-10-09 02:07:38.741406+00` | `2026-10-08 23:07:38.741406` |
|       2 | `13040004-ae51-42c6-9bcd-3a2eae334cde` | `400.00` | `aberta` | `null`                          | `null`                       |
|       3 | `a06c9c5b-85d4-4cd9-b6ce-167398c6493b` | `400.00` | `aberta` | `null`                          | `null`                       |
|       4 | `2394940c-28d7-4613-8d9f-b025b4aebaf3` | `400.00` | `aberta` | `null`                          | `null`                       |

Consolidação financeira:

- Faturas pagas: `1`.
- Faturas abertas: `3`.
- Total liquidado: `400.00`.
- Total ainda aberto: `1200.00`.
- Duplicidades por contrato/parcela: nenhuma encontrada.
- Contrato, cliente e veículo permaneceram preservados.

Evidências de segurança:

- `payment-webhook` sem segredo retornou HTTP `401`.
- `payment-webhook` com segredo inválido retornou HTTP `401`.
- `simulate-payment` sem autenticação administrativa retornou HTTP `401` quando a simulação estava temporariamente habilitada.
- Após restauração, `simulate-payment` retornou HTTP `403` com `simulation_disabled`.
- `authenticated` continua sem permissão para executar `public.liquidar_fatura(uuid, numeric)` diretamente.
- `authenticated` continua sem `UPDATE` em `faturas` e sem `INSERT` em `app_admins`.

Critérios de aprovação:

- Liquidação apenas via RPC autorizada.
- Pagamento duplicado não duplica liquidação nem sobrescreve `pago_em`.
- Frontend não consegue liquidar diretamente.

Resultado: **aprovado**.

## 6. Plano de execução remota autorizável

### 6.1 Estratégia de identificação

Todos os registros criados em homologação devem conter o prefixo:

```text
HOMOLOG QA 20261009
```

Campos sugeridos para rastreio:

- `clientes.nome`
- `clientes.documento`
- `veiculos.marca`/`modelo`/`placa`

### 6.2 Operações remotas que exigem autorização

1. Login administrativo real na Vercel.
2. Criação de cliente de homologação.
3. Criação de veículo de homologação.
4. Criação de contrato de homologação.
5. Consulta das faturas geradas.
6. Eventual atualização de cliente/veículo de homologação.
7. Eventual teste de pagamento remoto, em autorização separada.
8. Eventual limpeza controlada dos dados de homologação.

### 6.3 Tabelas que seriam modificadas

- `public.clientes`
- `public.veiculos`
- `public.contratos`
- `public.faturas` por trigger de contrato

Não devem ser modificadas sem nova autorização:

- `auth.users`
- `public.app_admins`
- secrets do projeto
- policies RLS

### 6.4 Estratégia de limpeza segura

Preferência: manter dados de homologação como evidência até aceite final.

Se limpeza for autorizada posteriormente:

- deletar apenas registros identificados por prefixo/placa/documento de homologação;
- nunca usar `TRUNCATE`;
- nunca usar `db reset`;
- antes de deletar, listar registros candidatos e solicitar confirmação;
- respeitar dependências: faturas/contratos antes de cliente/veículo, se as regras permitirem.

Observação: o modelo atual não concede `DELETE` a `authenticated` nas tabelas de negócio; limpeza pode exigir SQL operacional privilegiado cuidadosamente revisado.

## 7. Riscos identificados

- Já existem dados remotos nas tabelas de negócio; testes adicionais devem evitar colisão e preservar esses dados.
- A simulação Pix foi restaurada para desabilitada após o teste de pagamento autorizado.
- O endpoint `payment-webhook` é público por desenho e depende da confidencialidade de `ALUGO_WEBHOOK_SECRET`.
- Dados de homologação podem permanecer no ambiente de produção se não houver limpeza autorizada.
- Configuração final de Auth Redirect/Site URL deve acompanhar a URL pública definitiva da Vercel.

## 8. Pendências

- Registrar evidências visuais adicionais do frontend, se exigido pela banca.
- Decidir se dados de homologação serão mantidos como evidência ou limpos com procedimento controlado.
- Atualizar configuração Supabase Auth com URL pública final, caso ainda esteja pendente.

## 9. Recomendação final

O ambiente está apto para entrega técnica, com ressalva de revisar a URL pública final nas configurações de Auth caso a aplicação passe a usar fluxos com redirecionamento por email. Novos testes remotos devem continuar limitados a registros de homologação e sem alterar RLS ou secrets.
