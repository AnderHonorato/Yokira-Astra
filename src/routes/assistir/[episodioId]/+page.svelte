<!-- Arquivo: src/routes/assistir/[episodioId]/+page.svelte -->
<script lang="ts">
  import './assistir.css';
  import PlayerVideo from '$componentes/player/player-video.svelte';
  import SetaEsquerda from '$visual/icones/seta-esquerda.svelte';
  import Chip from '$componentes/comum/chip.svelte';

  export let data;

  $: rotulo = `T${data.temporada} EP${data.episodio.numero} — ${data.episodio.nome}`;
</script>

<svelte:head><title>{data.titulo.nome} — EP {data.episodio.numero}</title></svelte:head>

<div class="assistir">
  <a class="assistir-voltar" href={`/titulo/${data.titulo.slug}`}>
    <SetaEsquerda tamanho={16} />
    {data.titulo.nome}
  </a>

  <PlayerVideo
    episodioId={data.episodio.id}
    temMidia={data.temMidia}
    segundoInicial={data.segundoInicial}
    rotuloDoEpisodio={rotulo}
  />

  <h1 class="assistir-titulo">
    T{data.temporada} · {data.episodio.numero}. {data.episodio.nome}
  </h1>

  <!-- Só entra aqui o que existe de verdade no cadastro deste episódio. A versão
       anterior escrevia "Legendas Br" e "PT" fixos em toda tela, mesmo sem uma única
       legenda cadastrada no sistema inteiro. -->
  <p class="assistir-meta">
    {#if data.episodio.duracaoMinutos > 0}
      <span>{data.episodio.duracaoMinutos}min</span>
    {/if}
    {#each data.legendas as legenda (legenda)}
      <Chip>{legenda}</Chip>
    {:else}
      <Chip variante="neutro">Sem legenda</Chip>
    {/each}
  </p>
</div>
