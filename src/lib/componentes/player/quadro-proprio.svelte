<!-- Arquivo: src/lib/componentes/player/quadro-proprio.svelte -->
<!-- O quadro que a gente mesmo desenha: o vídeo, as legendas e a barra de controles.
     Vale para HLS próprio, playlist remota e arquivo direto — as três tocam no mesmo
     elemento e por isso merecem exatamente os mesmos controles.

     Os elementos saem por bind: para o player poder pendurar a mídia neles. Sem isso o
     componente pai precisaria procurar o elemento no DOM, e isso quebra assim que a
     marcação muda. -->
<script lang="ts">
  import ControlesPlayer from './controles-player.svelte';
  import { ERRO_DE_REPRODUCAO, type ComandosDoVideo } from './comandos-do-video';
  import type { NivelDeQualidade } from './carregar-hls';
  import type { EstadoDaMidia } from './estado-da-midia';
  import type { LegendaDaFonte } from '../../contratos/midia';

  export let estado: EstadoDaMidia;
  export let niveis: NivelDeQualidade[] = [];
  export let nivelAtual = -1;
  export let legendas: LegendaDaFonte[] = [];
  export let carregando = false;
  export let controlesVisiveis = true;
  export let comandos: ComandosDoVideo;
  export let aoTeclar: (evento: KeyboardEvent) => void;
  export let aoRevelar: () => void;
  export let aoTrocarNivel: (indice: number) => void;
  export let aoFalhar: (mensagem: string) => void;

  export let video: HTMLVideoElement | undefined = undefined;
  export let quadro: HTMLDivElement | undefined = undefined;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="player-quadro"
  class:player-quadro-limpo={!controlesVisiveis}
  bind:this={quadro}
  role="region"
  aria-label="Reprodutor de vídeo"
  tabindex="-1"
  on:keydown={aoTeclar}
  on:pointermove={aoRevelar}
>
  <video
    class="player-video"
    bind:this={video}
    playsinline
    preload="metadata"
    crossorigin="anonymous"
    on:click={comandos.alternar}
    on:error={() => aoFalhar(ERRO_DE_REPRODUCAO)}
  >
    {#each legendas as legenda (legenda.url)}
      <track kind="subtitles" src={legenda.url} srclang={legenda.idioma} label={legenda.rotulo} />
    {/each}
  </video>

  {#if carregando}
    <p class="player-carregando" role="status">Carregando o vídeo…</p>
  {/if}

  <ControlesPlayer
    {estado}
    {niveis}
    {nivelAtual}
    on:alternar={comandos.alternar}
    on:buscar={(evento) => comandos.buscar(evento.detail)}
    on:volume={(evento) => comandos.definirVolume(evento.detail)}
    on:mudo={comandos.alternarMudo}
    on:nivel={(evento) => aoTrocarNivel(evento.detail)}
    on:telaCheia={comandos.alternarTelaCheia}
  />
</div>
