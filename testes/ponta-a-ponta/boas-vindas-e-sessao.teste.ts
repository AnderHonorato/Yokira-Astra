// Arquivo: testes/ponta-a-ponta/boas-vindas-e-sessao.teste.ts
// Duas coisas que andam juntas: a mensagem do primeiro acesso aparece uma vez só, e o
// HTML das páginas de catálogo não pode ser guardado pelo navegador com o estado da
// sessão dentro.
//
// O segundo teste existe porque o primeiro falhou por causa dele. A home marcava a
// própria resposta como `private, max-age=30`: voltando a ela dentro desses 30 s, o
// navegador servia o HTML antigo — com a mensagem já dispensada de volta na tela e, pior,
// com o cabeçalho de quem tinha acabado de sair da conta.

import { expect, test, type Browser, type Page } from '@playwright/test';

const ADMIN = { email: 'admin@yokira.local', senha: 'YokiraAdmin#2024' };

/**
 * A faixa é estado global do site: ligada por este arquivo, ela valeria para os testes
 * que rodam em paralelo. Desligar no fim é o que impede este teste de estragar os outros
 * — e o estado de fábrica é desligado mesmo.
 */
test.afterAll(async ({ browser }: { browser: Browser }) => {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();
  try {
    await entrar(pagina, ADMIN.email, ADMIN.senha);
    await pagina.goto('/admin/faixas');
    const forma = pagina.locator('form.faixa-forma').nth(1);
    await forma.locator('input[name="ativa"]').uncheck();
    await forma.locator('button[type="submit"]').click();
    await expect(forma.locator('.faixa-resposta')).toContainText('salva', { timeout: 10_000 });
  } finally {
    await contexto.close();
  }
});

async function entrar(pagina: Page, email: string, senha: string) {
  await pagina.goto('/entrar');
  await pagina.getByLabel('E-mail').fill(email);
  await pagina.getByLabel('Senha').fill(senha);
  await pagina.getByRole('button', { name: 'Entrar' }).click();
  await expect(pagina).toHaveURL('/');
}

async function criarConta(pagina: Page): Promise<string> {
  const email = `boasvindas-${Date.now()}-${Math.random().toString(36).slice(2)}@yokira.local`;
  await pagina.goto('/cadastrar');
  await pagina.getByLabel('Nome').fill('Primeira Vez');
  await pagina.getByLabel('E-mail').fill(email);
  await pagina.getByLabel('Senha').fill('YokiraDemo2024');
  await pagina.getByRole('button', { name: 'Criar conta' }).click();
  await expect(pagina).toHaveURL('/');
  return email;
}

/** Liga a mensagem de boas-vindas pelo painel, do jeito que uma pessoa faria. */
async function ligarBoasVindas(pagina: Page) {
  await entrar(pagina, ADMIN.email, ADMIN.senha);
  await pagina
    .locator('dialog.boas-vindas button[aria-label="Fechar"]')
    .click({ timeout: 3000 })
    .catch(() => {});

  await pagina.goto('/admin/faixas');
  const forma = pagina.locator('form.faixa-forma').nth(1);
  await forma.locator('input[name="ativa"]').check();
  await forma.locator('input[name="titulo"]').fill('Bem-vindo ao Yōkira');
  await forma.locator('textarea[name="texto"]').fill('Monte sua lista e retome de onde parou.');
  await forma.locator('button[type="submit"]').click();
  await expect(forma.locator('.faixa-resposta')).toContainText('salva', { timeout: 10_000 });
}

test('a mensagem de primeiro acesso aparece uma vez e não volta', async ({ page, context }) => {
  await ligarBoasVindas(page);
  await context.clearCookies();

  await criarConta(page);

  const dialogo = page.locator('dialog.boas-vindas');
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toContainText('Bem-vindo ao Yōkira');

  await dialogo.getByRole('button', { name: 'Fechar' }).click();
  await expect(dialogo).toBeHidden();

  // Navegar logo em seguida é o caminho normal, e é onde a marcação se perdia.
  await page.goto('/catalogo');
  await expect(page.locator('dialog.boas-vindas')).toHaveCount(0);

  await page.goto('/');
  await expect(page.locator('dialog.boas-vindas')).toHaveCount(0);
});

test('o HTML da home não é guardado com o estado da sessão dentro', async ({ page }) => {
  await entrar(page, ADMIN.email, ADMIN.senha);
  await page
    .locator('dialog.boas-vindas button[aria-label="Fechar"]')
    .click({ timeout: 3000 })
    .catch(() => {});

  const resposta = await page.request.get('/');
  const cache = resposta.headers()['cache-control'] ?? '';
  expect(cache).toContain('no-store');

  const doCatalogo = await page.request.get('/catalogo');
  expect(doCatalogo.headers()['cache-control'] ?? '').toContain('no-store');

  // Já o catálogo em si não tem nada de pessoal e continua podendo ser guardado.
  const api = await page.request.get('/api/catalogo');
  expect(api.headers()['cache-control'] ?? '').toContain('public');
});

test('sair da conta some com o painel na volta imediata à home', async ({ page }) => {
  await entrar(page, ADMIN.email, ADMIN.senha);
  await page
    .locator('dialog.boas-vindas button[aria-label="Fechar"]')
    .click({ timeout: 3000 })
    .catch(() => {});

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Painel administrativo' })).toBeVisible();

  await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Sair desta conta' }).click();
  await expect(page).toHaveURL('/');

  // Sem o no-store, esta volta vinha do cache do navegador com o painel ainda no lugar.
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Painel administrativo' })).toHaveCount(0);
});
