<!-- Arquivo: src/routes/+page.svelte -->
<!-- Home: hero rotativo + trilhas Populares / Em alta / Novidades (imagens 1 e 2). -->
<script lang="ts">
  import BannerDestaque from '$componentes/home/banner-destaque.svelte';
  import FaixaPromocional from '$componentes/comum/faixa-promocional.svelte';
  import TrilhaConteudo from '$componentes/home/trilha-conteudo.svelte';
  import { intercalarTrilhas } from '$componentes/home/ordem-das-trilhas';
  import type { TrilhaDeConteudo } from '$servidor/banco/tipos-catalogo';

  export let data;

  // O `load` devolve o cache na hora; a revalidacao chega depois e troca o objeto
  // so quando o conteudo mudou de verdade. A geracao evita que uma resposta atrasada
  // de uma navegacao anterior sobrescreva a tela atual.
  let catalogo = data.catalogo;
  let pessoais: TrilhaDeConteudo[] = data.pessoais;
  let geracao = 0;

  $: sincronizar(data);
  $: trilhas = intercalarTrilhas(catalogo.trilhas, pessoais);

  function sincronizar(atual: typeof data) {
    const minha = ++geracao;
    catalogo = atual.catalogo;
    pessoais = atual.pessoais;

    void atual.atualizacao?.then((fresco) => {
      if (fresco && minha === geracao) catalogo = fresco;
    });
    void atual.pessoaisAtrasadas?.then((minhasTrilhas) => {
      if (minha === geracao) pessoais = minhasTrilhas;
    });
  }
</script>

<svelte:head>
  <title>Yōkira Animes — Início</title>
  <meta
    name="description"
    content="Catálogo de animes com legendas em português no Yōkira Animes."
  />
</svelte:head>

<BannerDestaque destaques={catalogo.destaques} />

<!-- Faixa escrita no painel. So aparece quando alguem ligou E escreveu algo nela. -->
{#if catalogo.faixa}
  <div class="home-faixa">
    <FaixaPromocional
      titulo={catalogo.faixa.titulo}
      texto={catalogo.faixa.texto}
      rotuloBotao={catalogo.faixa.rotuloBotao}
      destino={catalogo.faixa.destino}
      corInicial={catalogo.faixa.corInicial}
      corFinal={catalogo.faixa.corFinal}
    />
  </div>
{/if}

{#each trilhas as trilha, indice (trilha.chave)}
  <TrilhaConteudo {trilha} prioritaria={indice === 0} />
{/each}
