// Arquivo: testes/ponta-a-ponta/fontes-de-midia.teste.ts
// O requisito principal, exercitado pela interface de verdade: escolher episódio,
// verificar um link, salvar, e assistir.
//
// Os endereços usados aqui são públicos e de fora. Isso é de propósito: as fixtures
// locais ficariam em localhost, e localhost é justamente o que a proteção contra SSRF
// recusa. Afrouxar essa proteção para agradar um teste seria trocar segurança real por
// verde na tela. A cobertura determinística — HTML disfarçado de .mp4, playlist quebrada,
// tempo esgotado — está em `testes/unitarios/verificar-fonte.teste.ts`, com transporte
// injetado.
//
// Como dependem de rede, estes testes são pulados quando a máquina está sem internet, e o
// motivo aparece no relatório em vez de virar falha silenciosa.

import { expect, test, type Page } from '@playwright/test';

const ADMIN = { email: 'admin@yokira.local', senha: 'YokiraAdmin#2024' };

/** Vídeo CC0 da MDN: 200, video/mp4, aceita pedido por trecho. */
const MP4_PUBLICO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
/** Playlist mestre pública de teste, com várias qualidades e CORS liberado. */
const HLS_PUBLICO = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
/**
 * Endereço público que responde 401 de forma estável. Serve para conferir a leitura de
 * status: a primeira escolha aqui era um .mp4 de um site que responde 403 ao curl — mas
 * responde 200 ao nosso agente, e o teste reprovava o código por um engano do teste.
 */
const ENDERECO_QUE_EXIGE_LOGIN = 'https://api.github.com/user';
/** Endereço que não existe: o painel tem que dizer isso em português. */
const ENDERECO_INEXISTENTE = 'https://www.google.com/yokira-teste-nao-existe.mp4';

let temInternet: boolean | null = null;

async function internetDisponivel(page: Page): Promise<boolean> {
  if (temInternet !== null) return temInternet;
  try {
    const resposta = await page.request.head(HLS_PUBLICO, { timeout: 15_000 });
    temInternet = resposta.ok();
  } catch {
    temInternet = false;
  }
  return temInternet;
}

async function entrarComoAdmin(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(ADMIN.email);
  await page.getByLabel('Senha').fill(ADMIN.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL('/');
}

/** Escolhe um episódio pelo seletor de busca e devolve o rótulo escolhido. */
async function escolherEpisodio(page: Page, termo: string): Promise<string> {
  await page.goto('/admin/enviar');
  await page.getByRole('searchbox', { name: /Procurar episódio/i }).fill(termo);

  const primeiro = page.locator('.escolher-item').first();
  await expect(primeiro).toBeVisible({ timeout: 15_000 });
  const rotulo = (await primeiro.locator('.escolher-nome').innerText()).trim();
  await primeiro.click();

  await expect(page.getByRole('tab', { name: 'Usar link' })).toBeVisible();
  return rotulo;
}

test('o seletor de episódio acha títulos que ficavam fora dos primeiros 60', async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto('/admin/enviar');

  const campo = page.getByRole('searchbox', { name: /Procurar episódio/i });
  await campo.fill('zzzzzzzzzz');
  await expect(page.getByText('Nenhum episódio com esse nome.')).toBeVisible({ timeout: 15_000 });

  await campo.fill('a');
  await expect(page.locator('.escolher-item').first()).toBeVisible({ timeout: 15_000 });
  // A contagem total é do catálogo inteiro, não de uma fatia dos 60 primeiros.
  await expect(page.getByText(/Página \d+ de \d+ · \d+ episódios/)).toBeVisible();
});

test('link de arquivo compatível é verificado e vira origem no ar', async ({ page }) => {
  test.skip(
    !(await internetDisponivel(page)),
    'Sem internet: link público não pode ser conferido.'
  );
  await entrarComoAdmin(page);
  await escolherEpisodio(page, 'a');

  await page.getByRole('tab', { name: 'Usar link' }).click();
  await page.getByLabel('Link do vídeo').fill(MP4_PUBLICO);
  await page.getByRole('button', { name: 'Verificar vídeo' }).click();

  await expect(page.getByText('Vídeo pronto')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.previa-video')).toBeVisible();

  await page.getByRole('button', { name: 'Usar este link' }).click();
  await expect(page.getByText(/Vídeo no ar/)).toBeVisible({ timeout: 30_000 });

  // A origem aparece na lista do episódio, marcada como a que está no ar.
  const ativa = page.locator('.fontes-item-ativa');
  await expect(ativa).toBeVisible();
  await expect(ativa).toContainText('Link direto para o arquivo');
});

test('playlist HLS remota é aceita e lista as qualidades da origem', async ({ page }) => {
  test.skip(!(await internetDisponivel(page)), 'Sem internet: playlist pública não pode ser lida.');
  await entrarComoAdmin(page);
  await escolherEpisodio(page, 'a');

  await page.getByRole('tab', { name: 'Usar link' }).click();
  await page.getByLabel('Link do vídeo').fill(HLS_PUBLICO);
  await page.getByRole('button', { name: 'Verificar vídeo' }).click();

  await expect(page.getByText('Vídeo pronto')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Qualidades na origem:/)).toBeVisible();
});

test('endereço que exige autenticação é explicado, não aceito', async ({ page }) => {
  test.skip(!(await internetDisponivel(page)), 'Sem internet.');
  await entrarComoAdmin(page);
  await escolherEpisodio(page, 'a');

  await page.getByRole('tab', { name: 'Usar link' }).click();
  await page.getByLabel('Link do vídeo').fill(ENDERECO_QUE_EXIGE_LOGIN);
  await page.getByRole('button', { name: 'Verificar vídeo' }).click();

  const veredito = page.locator('.link-veredito');
  await expect(veredito).toContainText('Indisponível', { timeout: 30_000 });
  await expect(veredito).toContainText('login');
  // Sem número de status cru na tela do administrador.
  await expect(veredito).not.toContainText('401');
});

test('endereço que não existe é explicado em português', async ({ page }) => {
  test.skip(!(await internetDisponivel(page)), 'Sem internet.');
  await entrarComoAdmin(page);
  await escolherEpisodio(page, 'a');

  await page.getByRole('tab', { name: 'Usar link' }).click();
  await page.getByLabel('Link do vídeo').fill(ENDERECO_INEXISTENTE);
  await page.getByRole('button', { name: 'Verificar vídeo' }).click();

  const veredito = page.locator('.link-veredito');
  await expect(veredito).toContainText('Indisponível', { timeout: 30_000 });
  await expect(veredito).toContainText('não existe mais');
  await expect(veredito).not.toContainText('404');
});

test('vídeo do YouTube vira incorporação, sem baixar nada', async ({ page }) => {
  test.skip(!(await internetDisponivel(page)), 'Sem internet.');
  await entrarComoAdmin(page);
  await escolherEpisodio(page, 'a');

  await page.getByRole('tab', { name: 'Usar link' }).click();
  await page.getByLabel('Link do vídeo').fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await page.getByRole('button', { name: 'Verificar vídeo' }).click();

  await expect(page.getByText('Vídeo pronto')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/player do próprio YouTube/)).toBeVisible();
  await expect(page.locator('.previa-iframe')).toHaveAttribute(
    'src',
    /youtube-nocookie\.com\/embed\//
  );
});

test('endereço de rede interna é recusado pelo servidor', async ({ page }) => {
  await entrarComoAdmin(page);

  for (const alvo of ['http://127.0.0.1:4107/', 'http://169.254.169.254/latest/meta-data/']) {
    const resposta = await page.request.post('/api/admin/fontes/verificar', {
      data: { url: alvo, assinatura: 'ssrf' }
    });
    expect(resposta.ok(), alvo).toBe(true);
    const corpo = await resposta.json();
    expect(corpo.estado, alvo).toBe('INCOMPATIVEL');
    expect(corpo.mensagem, alvo).toContain('rede interna');
  }
});

test('quem nao e editor nao verifica link nenhum', async ({ page }) => {
  await page.goto('/cadastrar');
  await page.getByLabel('Nome').fill('Sem Poder');
  await page.getByLabel('E-mail').fill(`comum-${Date.now()}-${Math.random()}@yokira.local`);
  await page.getByLabel('Senha').fill('YokiraDemo2024');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL('/');

  const verificar = await page.request.post('/api/admin/fontes/verificar', {
    data: { url: 'https://exemplo.com/a.mp4', assinatura: 'x' }
  });
  expect(verificar.status()).toBe(403);

  const episodios = await page.request.get('/api/admin/episodios');
  expect(episodios.status()).toBe(403);
});
