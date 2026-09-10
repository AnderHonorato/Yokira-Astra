<!-- Arquivo: src/routes/admin/enviar/+page.svelte -->
<!-- Dar vídeo a um episódio. A tela segue a ordem da decisão: primeiro qual episódio,
     depois de onde vem o vídeo, e só então o que já está cadastrado nele.

     As duas origens não são mais um par de rádios escondendo campos: são abas, porque o
     que muda entre elas é a tela inteira, não um campo. -->
<script lang="ts">
  import '../admin.css';
  import './enviar.css';
  import { enhance } from '$app/forms';
  import EscolherEpisodio from '$componentes/admin/escolher-episodio.svelte';
  import FontePorLink from '$componentes/admin/fonte-por-link.svelte';
  import EnviarArquivo from '$componentes/admin/enviar-arquivo.svelte';
  import FontesDoEpisodio from '$componentes/admin/fontes-do-episodio.svelte';
  import { listarFontesDoEpisodio, novoToken } from '$cliente/fontes-de-midia';
  import { avisar } from '$cliente/avisos';
  import type { EpisodioSelecionavel, FonteListada } from '$lib/contratos/midia';

  export let data;
  export let form;

  let selecionado: EpisodioSelecionavel | null = null;
  let aba: 'arquivo' | 'link' = 'arquivo';
  let fontes: FonteListada[] = [];
  let salvandoLink = false;
  let token = novoToken();

  async function recarregarFontes() {
    if (!selecionado) return;
    fontes = await listarFontesDoEpisodio(selecionado.id).catch(() => []);
  }

  async function aoEscolher(evento: CustomEvent<EpisodioSelecionavel>) {
    selecionado = evento.detail;
    // Token novo por episódio: o de idempotência do anterior não pode valer aqui.
    token = novoToken();
    await recarregarFontes();
  }

  async function aoConcluirEnvio(evento: CustomEvent<string>) {
    avisar(evento.detail, 'sucesso');
    await recarregarFontes();
  }
</script>

<svelte:head><title>Dar vídeo a um episódio — Yōkira Animes</title></svelte:head>

<h1 class="admin-titulo">Vídeo do episódio</h1>
<p class="admin-subtitulo">
  Escolha o episódio e diga de onde vem o vídeo: um arquivo do computador ou um link.
</p>

<div class="enviar-colunas">
  <section class="enviar-bloco">
    <h2 class="enviar-passo"><span aria-hidden="true">1</span> Qual episódio</h2>
    <EscolherEpisodio
      lista={data.listaInicial}
      busca={data.buscaInicial}
      {selecionado}
      on:escolher={aoEscolher}
    />
  </section>

  <section class="enviar-bloco">
    <h2 class="enviar-passo"><span aria-hidden="true">2</span> De onde vem o vídeo</h2>

    {#if !selecionado}
      <p class="enviar-espera">Escolha um episódio ao lado para continuar.</p>
    {:else}
      <p class="enviar-alvo">
        Trabalhando em <strong
          >{selecionado.titulo} — T{selecionado.temporada} EP{selecionado.numero}</strong
        >
      </p>

      <div class="enviar-abas" role="tablist" aria-label="Origem do vídeo">
        <button
          type="button"
          role="tab"
          id="aba-arquivo"
          aria-selected={aba === 'arquivo'}
          aria-controls="painel-arquivo"
          class:enviar-aba-ativa={aba === 'arquivo'}
          on:click={() => (aba = 'arquivo')}
        >
          Enviar arquivo
        </button>
        <button
          type="button"
          role="tab"
          id="aba-link"
          aria-selected={aba === 'link'}
          aria-controls="painel-link"
          class:enviar-aba-ativa={aba === 'link'}
          on:click={() => (aba = 'link')}
        >
          Usar link
        </button>
      </div>

      {#if aba === 'arquivo'}
        <div id="painel-arquivo" role="tabpanel" aria-labelledby="aba-arquivo">
          <EnviarArquivo
            episodioId={selecionado.id}
            limiteBytes={data.limiteBytes}
            temFfmpeg={data.temFfmpeg}
            on:concluido={aoConcluirEnvio}
          />
        </div>
      {:else}
        <div id="painel-link" role="tabpanel" aria-labelledby="aba-link">
          <form
            method="POST"
            action="?/link"
            use:enhance={() => {
              salvandoLink = true;
              return async ({ update }) => {
                salvandoLink = false;
                await update({ reset: false });
                await recarregarFontes();
              };
            }}
          >
            <input type="hidden" name="episodioId" value={selecionado.id} />
            <input type="hidden" name="token" value={token} />
            <FontePorLink podeSalvar={true} ocupado={salvandoLink} />
          </form>
        </div>
      {/if}

      {#if form?.mensagem}
        <p class="enviar-resposta" role="status">{form.mensagem}</p>
      {/if}
    {/if}
  </section>
</div>

{#if selecionado}
  <div class="enviar-bloco enviar-bloco-largo">
    <FontesDoEpisodio bind:fontes />
  </div>
{/if}
