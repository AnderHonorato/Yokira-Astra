<!-- Arquivo: src/routes/admin/faixas/+page.svelte -->
<!-- Edição das faixas com prévia ao lado. A prévia usa o mesmo componente que a home
     renderiza, então o que aparece aqui é o que vai ao ar — e não uma aproximação
     desenhada só para esta tela, que é como uma prévia começa a mentir. -->
<script lang="ts">
  import '../admin.css';
  import './faixas.css';
  import { enhance } from '$app/forms';
  import FaixaPromocional from '$componentes/comum/faixa-promocional.svelte';
  import BotaoPill from '$componentes/comum/botao-pill.svelte';
  import type { FaixaPublica } from '$servidor/banco/faixas-promocionais';

  export let data;
  export let form;

  const NOMES: Record<string, string> = {
    home: 'Faixa da página inicial',
    'boas-vindas': 'Mensagem de boas-vindas'
  };

  const EXPLICACOES: Record<string, string> = {
    home: 'Aparece logo abaixo do banner grande, para quem estiver navegando.',
    'boas-vindas': 'Aparece uma única vez, no primeiro acesso de cada pessoa depois de entrar.'
  };

  // Cópia local para a prévia acompanhar a digitação sem esperar o salvamento.
  let rascunhos: Record<string, FaixaPublica> = Object.fromEntries(
    data.faixas.map((faixa) => [faixa.chave, { ...faixa }])
  );
</script>

<svelte:head><title>Faixas e mensagens — Yōkira Animes</title></svelte:head>

<h1 class="admin-titulo">Faixas e mensagens</h1>
<p class="admin-subtitulo">
  Texto e cores da faixa da home e da mensagem de boas-vindas. Desligada, a faixa não aparece para
  ninguém.
</p>

{#each data.faixas as faixa (faixa.chave)}
  {@const rascunho = rascunhos[faixa.chave]}
  <section class="faixa-editor">
    <header class="faixa-editor-cabecalho">
      <h2>{NOMES[faixa.chave] ?? faixa.chave}</h2>
      <p>{EXPLICACOES[faixa.chave] ?? ''}</p>
    </header>

    <div class="faixa-editor-colunas">
      <form
        method="POST"
        action="?/salvar"
        class="faixa-forma"
        use:enhance={() =>
          async ({ update }) =>
            update({ reset: false })}
      >
        <input type="hidden" name="chave" value={faixa.chave} />

        <label class="faixa-interruptor">
          <input type="checkbox" name="ativa" value="sim" bind:checked={rascunho.ativa} />
          <span>Mostrar esta faixa</span>
        </label>

        <label class="faixa-campo">
          <span>Título</span>
          <input type="text" name="titulo" maxlength="80" bind:value={rascunho.titulo} />
        </label>

        <label class="faixa-campo">
          <span>Texto</span>
          <textarea name="texto" rows="3" maxlength="400" bind:value={rascunho.texto}></textarea>
        </label>

        <div class="faixa-dupla">
          <label class="faixa-campo">
            <span>Rótulo do botão</span>
            <input
              type="text"
              name="rotuloBotao"
              maxlength="40"
              placeholder="Opcional"
              bind:value={rascunho.rotuloBotao}
            />
          </label>
          <label class="faixa-campo">
            <span>Para onde o botão leva</span>
            <input
              type="text"
              name="destino"
              placeholder="/catalogo"
              bind:value={rascunho.destino}
            />
          </label>
        </div>

        <div class="faixa-dupla">
          <label class="faixa-campo faixa-campo-cor">
            <span>Cor inicial</span>
            <input type="color" name="corInicial" bind:value={rascunho.corInicial} />
          </label>
          <label class="faixa-campo faixa-campo-cor">
            <span>Cor final</span>
            <input type="color" name="corFinal" bind:value={rascunho.corFinal} />
          </label>
        </div>

        {#if form?.mensagem && form?.chave === faixa.chave}
          <p class="faixa-resposta" role="status">{form.mensagem}</p>
        {/if}

        <BotaoPill variante="marca" tipo="submit">Salvar faixa</BotaoPill>
      </form>

      <div class="faixa-previa">
        <h3>Prévia</h3>
        {#if rascunho.titulo.trim() === '' && rascunho.texto.trim() === ''}
          <p class="faixa-previa-vazia">
            Escreva um título ou um texto para ver a faixa aqui. Vazia, ela não vai ao ar nem
            ligada.
          </p>
        {:else}
          <FaixaPromocional
            titulo={rascunho.titulo}
            texto={rascunho.texto}
            rotuloBotao={rascunho.rotuloBotao}
            destino={rascunho.destino}
            corInicial={rascunho.corInicial}
            corFinal={rascunho.corFinal}
          />
        {/if}
      </div>
    </div>
  </section>
{/each}
