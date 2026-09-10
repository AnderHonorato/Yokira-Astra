// Arquivo: testes/ponta-a-ponta/carrossel-e-cache.teste.ts
// Arrasto no celular, setas nos dois tamanhos, expansao no hover e navegacao instantanea.

import { expect, test } from '@playwright/test';
import { NOME_DO_BANCO, VERSAO_DO_ESQUEMA } from '../../src/lib/cliente/cache-sessao';

test('a trilha rola na horizontal', async ({ page }) => {
  await page.goto('/');

  const trilha = page.locator('.carrossel-trilha').first();
  await expect(trilha).toBeVisible();

  const inicio = await trilha.evaluate((elemento) => elemento.scrollLeft);
  await trilha.evaluate((elemento) =>
    elemento.scrollBy({ left: 400, behavior: 'instant' as ScrollBehavior })
  );
  const depois = await trilha.evaluate((elemento) => elemento.scrollLeft);

  expect(depois).toBeGreaterThan(inicio);
});

/**
 * A seção de uma trilha pelo nome. Escopar importa: o teste media `.carrossel-trilha`
 * com `.first()` e clicava na seta de "Populares", que era a primeira fileira. Quando
 * "Em alta agora" passou a abrir a home, o teste passou a medir uma fileira e clicar em
 * outra — e falhou dizendo que a seta não rolava nada.
 */
function secaoDaTrilha(page: import('@playwright/test').Page, chave: string) {
  return page.locator(`section.trilha[aria-labelledby="trilha-${chave}"]`);
}

test('a seta de avancar funciona nos dois tamanhos', async ({ page }, informacao) => {
  await page.goto('/');
  const secao = secaoDaTrilha(page, 'populares');
  const seta = secao.getByRole('button', { name: /Avançar em Populares/ });
  const trilha = secao.locator('.carrossel-trilha');

  // No desktop a seta so aparece com o cursor perto; no celular nao existe hover,
  // entao ela precisa estar visivel de saida ou ninguem a encontraria.
  if (informacao.project.name === 'desktop-1440') {
    await secao.locator('.carrossel').hover();
  }
  await expect(seta).toBeVisible();

  const antes = await trilha.evaluate((elemento) => elemento.scrollLeft);
  await seta.click();
  await page.waitForTimeout(600);
  expect(await trilha.evaluate((elemento) => elemento.scrollLeft)).toBeGreaterThan(antes);
});

test('no celular a faixa da seta nao engole o toque do card', async ({ page }, informacao) => {
  test.skip(informacao.project.name !== 'celular-390', 'a faixa so e vazada no celular');

  await page.goto('/');
  const seta = secaoDaTrilha(page, 'populares').getByRole('button', {
    name: /Avançar em Populares/
  });

  // `elementFromPoint` mede na janela, não na página. "Populares" deixou de ser a
  // primeira fileira quando "Em alta agora" passou a abrir a home, e no celular a seta
  // dela nasce abaixo da dobra — sem trazer para a tela, o ponto medido cai fora da
  // janela e a função devolve nada.
  await seta.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const caixa = (await seta.boundingBox())!;

  // Um ponto DENTRO da faixa da seta, mas fora do disco: o alvo ali tem que ser o
  // card, senao o titulo da ponta fica inabrivel. So o disco recebe o toque.
  const alvo = await page.evaluate(
    ([x, y]) => {
      const elemento = document.elementFromPoint(x, y);
      return elemento?.closest('a[href^="/titulo/"]')?.getAttribute('href') ?? null;
    },
    [caixa.x + caixa.width - 6, caixa.y + 14]
  );

  expect(alvo?.startsWith('/titulo/')).toBe(true);
});

test('o card expande no hover apenas no desktop', async ({ page }, informacao) => {
  test.skip(informacao.project.name !== 'desktop-1440', 'expansão é exclusiva do desktop');

  await page.goto('/');
  await page.locator('.cartao-link').first().hover();

  // 350ms de atraso proposital antes de abrir.
  await expect(page.locator('.expandido').first()).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.expandido-audiencia').first()).toContainText('assistindo agora');
});

test('o catalogo publico e servido em JSON para o cache', async ({ page }) => {
  const resposta = await page.request.get('/api/catalogo');
  expect(resposta.ok()).toBe(true);

  const catalogo = await resposta.json();
  expect(catalogo.trilhas.length).toBeGreaterThanOrEqual(3);
  expect(catalogo.destaques.length).toBeGreaterThan(0);
  expect(resposta.headers()['cache-control']).toContain('stale-while-revalidate');
});

test('voltar para uma pagina ja visitada e instantaneo', async ({ page }) => {
  await page.goto('/');
  // Navegacao pelo proprio roteador (clique num link), que e o caminho que o
  // prefetch e o cache otimizam. `goBack` faria um carregamento completo e mediria
  // o navegador, nao o app.
  await page.locator('a[href="/catalogo"]').first().click();
  await expect(page.getByRole('heading', { name: 'Catálogo', level: 1 })).toBeVisible();

  const inicio = Date.now();
  await page.locator('a[href="/"]').first().click();
  await expect(page.getByRole('heading', { name: 'Populares' })).toBeVisible();
  expect(Date.now() - inicio).toBeLessThan(1500);
});

// Le uma chave do IndexedDB de dentro da pagina. Serve pra provar que o cache
// existe antes de medir a navegacao — sem isso o teste mediria sorte.
async function temNoCache(page: import('@playwright/test').Page, chave: string) {
  return page.evaluate(
    ([nomeDaChave, nomeDoBanco, versao]: [string, string, number]) =>
      new Promise<boolean>((resolver) => {
        const pedido = indexedDB.open(nomeDoBanco, versao);
        pedido.onerror = () => resolver(false);
        pedido.onsuccess = () => {
          const banco = pedido.result;
          if (!banco.objectStoreNames.contains('documentos')) return resolver(false);
          const busca = banco
            .transaction('documentos', 'readonly')
            .objectStore('documentos')
            .get(nomeDaChave);
          busca.onsuccess = () => resolver(busca.result !== undefined);
          busca.onerror = () => resolver(false);
        };
      }),
    [chave, NOME_DO_BANCO, VERSAO_DO_ESQUEMA] as [string, string, number]
  );
}

test('a home pinta do cache mesmo com o servidor lento', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Populares' })).toBeVisible();

  // O `load` grava o catalogo ao passar pela home; so seguimos quando ele existir.
  await expect.poll(() => temNoCache(page, 'catalogo-publico'), { timeout: 15_000 }).toBe(true);

  // Servidor propositalmente travado em 3s. Se a home esperasse o round-trip,
  // ela so pintaria depois disso.
  await page.route('**/api/catalogo', async (rota) => {
    await new Promise((resolver) => setTimeout(resolver, 3000));
    await rota.continue();
  });

  await page.locator('a[href="/catalogo"]').first().click();
  await expect(page.getByRole('heading', { name: 'Catálogo', level: 1 })).toBeVisible();

  const inicio = Date.now();
  await page.locator('a[href="/"]').first().click();
  await expect(page.getByRole('heading', { name: 'Populares' })).toBeVisible();
  const decorrido = Date.now() - inicio;

  // Pintou antes da resposta do servidor chegar — que e a definicao do 5.1.
  expect(decorrido).toBeLessThan(2000);
});
