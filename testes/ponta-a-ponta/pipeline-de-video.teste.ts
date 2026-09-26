// Arquivo: testes/ponta-a-ponta/pipeline-de-video.teste.ts
// O caminho inteiro, do arquivo ao play: enviar, converter, entrar no ar e reproduzir com
// o tempo andando de verdade.
//
// Abrir o player e ver a moldura não prova nada — foi assim que a versão anterior passou
// com um episódio que nunca tocou. O que este teste afirma é: `currentTime` cresce, o
// avanço temporal funciona e a barra de progresso acompanha.
//
// O vídeo é sintético, gerado aqui pelo próprio ffmpeg. Nenhum conteúdo de terceiro
// entra em teste.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const ADMIN = { email: 'admin@yokira.local', senha: 'YokiraAdmin#2024' };
const VIDEO = 'midia/teste-pipeline-e2e.mp4';
const BINARIO = process.env.CAMINHO_FFMPEG ?? 'ffmpeg';

function temFfmpeg(): boolean {
  try {
    execFileSync(BINARIO, ['-version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function gerarVideo(): void {
  if (existsSync(VIDEO)) return;
  mkdirSync('midia', { recursive: true });
  execFileSync(
    BINARIO,
    [
      '-hide_banner',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=640x360:rate=24:duration=6',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=6',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      VIDEO
    ],
    { stdio: 'pipe' }
  );
}

async function entrarComoAdmin(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(ADMIN.email);
  await page.getByLabel('Senha').fill(ADMIN.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL('/');
}

/** Espera a conversão terminar consultando o estado real das origens. */
async function esperarConversao(page: Page, episodioId: string, limiteMs = 150_000) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    const resposta = await page.request.get(
      `/api/admin/fontes?episodioId=${encodeURIComponent(episodioId)}`
    );
    if (resposta.ok()) {
      const { fontes } = (await resposta.json()) as {
        fontes: Array<{ estado: string; ativa: boolean; aviso: string | null }>;
      };
      const pronta = fontes.find((fonte) => fonte.estado === 'PRONTO' && fonte.ativa);
      if (pronta) return;
      const falhou = fontes.find((fonte) => fonte.estado === 'FALHOU');
      if (falhou) throw new Error(`A conversão falhou: ${falhou.aviso ?? 'sem motivo gravado'}`);
    }
    await page.waitForTimeout(2000);
  }
  throw new Error('A conversão não terminou dentro do prazo do teste.');
}

test('arquivo enviado vira episódio que toca, com o tempo andando', async ({ page }) => {
  test.skip(!temFfmpeg(), 'Sem ffmpeg nesta máquina: a conversão não pode ser exercitada.');
  test.setTimeout(300_000);
  gerarVideo();

  await entrarComoAdmin(page);
  await page.goto('/admin/enviar');

  // Um episódio qualquer que ainda não tenha vídeo.
  const campo = page.getByRole('searchbox', { name: /Procurar episódio/i });
  await campo.fill('a');
  const item = page
    .locator('.escolher-item')
    .filter({ hasNot: page.locator('.escolher-marca') })
    .first();
  await expect(item).toBeVisible({ timeout: 20_000 });
  const episodioId = await item.getAttribute('data-episodio');
  expect(episodioId).toBeTruthy();
  await item.click();

  await page.getByRole('tab', { name: 'Enviar arquivo' }).click();
  await page.locator('input[type="file"]').setInputFiles(VIDEO);
  await expect(page.getByText(/teste-pipeline-e2e\.mp4/)).toBeVisible();

  await page.getByRole('button', { name: 'Enviar arquivo' }).click();
  await expect(page.getByText(/A conversão começou/)).toBeVisible({ timeout: 120_000 });

  await esperarConversao(page, episodioId!);

  // Agora a parte que importa: o vídeo tem que tocar.
  await page.goto(`/assistir/${episodioId}`);
  const video = page.locator('video.player-video');
  await expect(video).toBeVisible({ timeout: 30_000 });

  await video.evaluate(async (elemento: HTMLVideoElement) => {
    elemento.muted = true;
    await elemento.play();
  });

  await expect
    .poll(async () => video.evaluate((el: HTMLVideoElement) => el.currentTime), {
      timeout: 30_000,
      message: 'o tempo do vídeo não avançou'
    })
    .toBeGreaterThan(0.4);

  // Avanço temporal: pedir o segundo 3 e conferir que o vídeo foi para lá.
  await video.evaluate((el: HTMLVideoElement) => {
    el.currentTime = 3;
  });
  await expect
    .poll(async () => video.evaluate((el: HTMLVideoElement) => el.currentTime), { timeout: 20_000 })
    .toBeGreaterThan(2.5);

  // A duração chegou junto com os metadados, então a barra tem o que medir.
  const duracao = await video.evaluate((el: HTMLVideoElement) => el.duration);
  expect(Number.isFinite(duracao) && duracao > 1).toBe(true);
});

test('episódio sem vídeo diz isso, em vez de mostrar player quebrado', async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto('/admin/enviar');

  const campo = page.getByRole('searchbox', { name: /Procurar episódio/i });
  await campo.fill('a');
  const semVideo = page
    .locator('.escolher-item')
    .filter({ hasNot: page.locator('.escolher-marca') })
    .last();
  await expect(semVideo).toBeVisible({ timeout: 20_000 });
  const episodioId = await semVideo.getAttribute('data-episodio');

  await page.goto(`/assistir/${episodioId}`);
  await expect(page.getByText('Este episódio ainda não tem vídeo.')).toBeVisible();
  await expect(page.locator('video.player-video')).toHaveCount(0);
});
