import { expect, test } from '@playwright/test';

const unique = Date.now().toString().slice(-8);
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? '';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? '';

test('bloqueia acesso não autenticado', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: /acesso administrativo/i })).toBeVisible();
});

test('fluxo administrativo completo', async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, 'Credenciais E2E não configuradas.');

  await page.goto('/login');
  await page.getByLabel('E-mail').fill(adminEmail);
  await page.getByLabel('Senha').fill(adminPassword);
  await page.getByRole('button', { name: /entrar/i }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Contratos ativos')).toBeVisible();

  await page.getByRole('link', { name: /clientes/i }).click();
  await page.getByLabel('Nome').fill(`Cliente E2E ${unique}`);
  await page.getByLabel('Documento').fill(`E2E${unique}`);
  await page.getByLabel('Email').fill(`cliente-${unique}@example.com`);
  await page.getByLabel('Telefone').fill('+55 11 98888-0000');
  await page.getByRole('button', { name: /salvar cliente/i }).click();
  await expect(page.getByText(`Cliente E2E ${unique}`)).toBeVisible();

  await page.getByRole('link', { name: /veículos/i }).click();
  await page.getByLabel('Marca').fill('Haojue');
  await page.getByLabel('Modelo').fill('DK 160');
  await page.getByLabel('Placa').fill(`E2E${unique.slice(-4)}`);
  await page.getByRole('button', { name: /salvar veículo/i }).click();
  await expect(page.getByText(`E2E${unique.slice(-4)}`.toUpperCase())).toBeVisible();

  await page.getByRole('link', { name: /contratos/i }).click();
  await page.getByLabel('Cliente').selectOption({ label: `Cliente E2E ${unique}` });
  const plate = `E2E${unique.slice(-4)}`.toUpperCase();
  const vehicleValue = await page
    .getByLabel('Motocicleta')
    .locator('option', { hasText: plate })
    .getAttribute('value');
  expect(vehicleValue).toBeTruthy();
  await page.getByLabel('Motocicleta').selectOption(vehicleValue!);
  await page.getByLabel('Valor semanal').fill('400.00');
  await page.getByLabel('Quantidade de semanas').fill('2');
  await page.getByLabel('Data de início').fill('2026-10-10');
  await page.getByRole('button', { name: /criar contrato/i }).click();
  await expect(page.getByText(/faturas foram geradas pelo PostgreSQL/i)).toBeVisible();
  await expect(page.getByText('Parcela 1')).toBeVisible();
  await expect(page.getByText('Parcela 2')).toBeVisible();

  await page.getByRole('link', { name: /financeiro/i }).click();
  await page.getByPlaceholder('Pesquisar').fill(`Cliente E2E ${unique}`);
  const firstRow = page
    .getByRole('row')
    .filter({ hasText: `Cliente E2E ${unique}` })
    .first();
  await expect(firstRow).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await firstRow.getByRole('button', { name: /simular pix/i }).click();
  await expect(
    page.getByText(/pagamento simulado processado|pagamento já havia sido processado/i),
  ).toBeVisible();
  await expect(page.getByText('paga').first()).toBeVisible();

  await page.getByRole('button', { name: /sair/i }).click();
  await expect(page).toHaveURL(/\/login$/);
});
