<!-- Arquivo: src/lib/componentes/admin/previa-da-fonte.svelte -->
<!-- Prévia do que foi verificado, antes de salvar. Existe porque verificar no servidor e
     reproduzir no navegador são coisas diferentes: o servidor diz que o arquivo existe e
     tem formato conhecido, e só aqui se descobre que o codec não abre neste navegador ou
     que a origem recusa a leitura por outro site.

     Por isso a prévia tem controles nativos e nenhum enfeite: o que interessa é se o
     vídeo aparece e anda. -->
<script lang="ts">
  import './previa-da-fonte.css';
  import { montarPrevia } from './montar-previa';
  import type { PreviaDaFonte } from '../../contratos/midia';

  export let previa: PreviaDaFonte;

  let falhou = false;
  let confirmada = false;

  $: incorporado = previa.tipo === 'YOUTUBE' || previa.tipo === 'VIMEO';
</script>

<div class="previa">
  {#if incorporado}
    <div class="previa-quadro">
      <iframe
        class="previa-iframe"
        src={previa.url}
        title="Prévia do vídeo no provedor"
        referrerpolicy="strict-origin-when-cross-origin"
        allow="fullscreen; encrypted-media"
        allowfullscreen
      ></iframe>
    </div>
  {:else}
    <!-- A chave força um elemento novo a cada endereço: reaproveitar o mesmo <video>
         deixava o estado de erro do link anterior grudado no novo. -->
    {#key previa.url}
      <video
        class="previa-video"
        controls
        playsinline
        preload="metadata"
        use:montarPrevia={{ previa, aoFalhar: () => (falhou = true) }}
        on:loadeddata={() => (confirmada = true)}
        on:error={() => (falhou = true)}
      ></video>
    {/key}
  {/if}

  <p class="previa-nota" role="status">
    {#if falhou}
      Este navegador não conseguiu abrir a prévia. O vídeo pode existir e ainda assim não tocar aqui
      — vale testar em outro navegador ou trazer o arquivo.
    {:else if confirmada}
      Prévia aberta neste navegador. Dê play para conferir se anda.
    {:else}
      Dê play para conferir. Até aqui, quem confirmou o vídeo foi o servidor.
    {/if}
  </p>
</div>
