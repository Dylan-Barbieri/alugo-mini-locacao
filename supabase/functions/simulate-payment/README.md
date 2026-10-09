# simulate-payment

Função intermediária da Fase 4 para simular pagamento Pix sem expor `ALUGO_WEBHOOK_SECRET` no navegador.

- Requer sessão Supabase Auth válida.
- Requer que o usuário exista em `public.app_admins`.
- Busca a fatura com `service_role` no backend.
- Envia notificação ao webhook real `payment-webhook` com o segredo backend.

Não substitui gateway real e não deve ser usada como integração financeira de produção.
