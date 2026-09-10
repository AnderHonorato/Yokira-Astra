// Arquivo: docs/auditar-telas.mjs
// Percorre a jornada inteira, autenticado como administrador, e grava uma captura
// de cada tela em desktop (1440) e celular (390). Registra também os erros de
// console de cada página.
//
// Uso: SAIDA=docs/capturas/antes node docs/auditar-telas.mjs

import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.BASE ?? 'http://localhost:4107';
const SAIDA = process.env.SAIDA ?? 'docs/capturas/auditoria';
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@yokira.local';
const SENHA = process.env.ADMIN_SENHA ?? 'YokiraAdmin#2024';

const TELAS = [
  ['inicio', '/'],
  ['catalogo', '/catalogo'],
  ['buscar', '/buscar?q=lamina'],
  ['buscar-sem-resultado', '/buscar?q=zzzzzzzz'],
  ['generos', '/generos'],
  ['novidades', '/novidades'],
  ['minha-lista', '/minha-lista'],
  ['configuracoes', '/configuracoes'],
  ['admin', '/admin'],
  ['admin-enviar', '/admin/enviar'],
  ['admin-titulos', '/admin/titulos'],
  ['admin-usuarios', '/admin/usuarios'],
  ['admin-registro', '/admin/registro'],
  ['admin-faixas', '/admin/faixas']
];

const PERFIS = [
  ['desktop-1440', 1440, 1000],
  ['celular-390', 390, 844]
];

await mkdir(SAIDA, { recursive: true });
const navegador = await chromium.launch(
  process.env.CHROMIUM_EXECUTAVEL ? { executablePath: process.env.CHROMIUM_EXECUTAVEL } : {}
);

const problemas = [];

for (const [perfil, largura, altura] of PERFIS) {
  const contexto = await navegador.newContext({
    viewport: { width: largura, height: altura },
    deviceScaleFactor: 1
  });
  const pagina = await contexto.newPage();
  pagina.on('console', (msg) => {
    if (msg.type() === 'error') problemas.push({ perfil, url: pagina.url(), erro: msg.text() });
  });
  pagina.on('pageerror', (erro) => {
    problemas.push({ perfil, url: pagina.url(), erro: String(erro) });
  });

  await pagina.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' });
  await pagina.fill('input[name="email"]', EMAIL);
  await pagina.fill('input[name="senha"]', SENHA);
  await Promise.all([
    pagina.waitForURL((u) => !u.pathname.startsWith('/entrar'), { timeout: 20000 }),
    pagina.click('button[type="submit"]')
  ]);

  await pagina
    .locator('dialog.boas-vindas button[aria-label="Fechar"]')
    .click({ timeout: 3000 })
    .catch(() => {});

  /**
   * Espera o esqueleto de rota sumir. O `networkidle` resolve antes de o roteador do
   * SvelteKit terminar de trocar a tela, e a captura sai com o esqueleto de carregamento
   * no lugar da página — foi o que aconteceu na primeira rodada, e uma captura de
   * esqueleto não prova nada sobre a tela que ela deveria mostrar.
   */
  async function esperarConteudo() {
    await pagina
      .waitForFunction(() => document.querySelector('.esqueleto-de-rota') === null, {
        timeout: 20000
      })
      .catch(() => {});
    await pagina.waitForTimeout(700);
  }

  for (const [nome, caminho] of TELAS) {
    await pagina.goto(BASE + caminho, { waitUntil: 'networkidle' }).catch(() => {});
    await esperarConteudo();
    await pagina.screenshot({ path: `${SAIDA}/${nome}--${perfil}.png`, fullPage: false });
    console.log('capturado', nome, perfil);
  }

  // Título e player dependem do catálogo real: chega neles navegando.
  await pagina.goto(`${BASE}/catalogo`, { waitUntil: 'networkidle' });
  await pagina.locator('a[href^="/titulo/"]').first().click();
  await pagina.waitForLoadState('networkidle');
  await esperarConteudo();
  await pagina.screenshot({ path: `${SAIDA}/titulo--${perfil}.png`, fullPage: false });
  console.log('capturado', 'titulo', perfil);

  const episodio = pagina.locator('a[href^="/assistir/"]').first();
  if (await episodio.count()) {
    await episodio.click();
    await pagina.waitForLoadState('networkidle');
    await esperarConteudo();
    await pagina.screenshot({ path: `${SAIDA}/assistir--${perfil}.png`, fullPage: false });
    console.log('capturado', 'assistir', perfil);
  }

  await contexto.close();
}

await navegador.close();
await writeFile(`${SAIDA}/console.json`, JSON.stringify(problemas, null, 2), 'utf8');
console.log(`\n${problemas.length} problema(s) de console. Detalhe em ${SAIDA}/console.json`);
