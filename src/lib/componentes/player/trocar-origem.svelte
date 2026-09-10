<!-- Arquivo: src/lib/componentes/player/trocar-origem.svelte -->
<!-- Troca de origem do vídeo, quando o episódio tem mais de uma. A que está tocando fica
     marcada; escolher outra interrompe a atual antes de montar a nova, para não ficarem
     dois áudios rodando ao mesmo tempo.

     Só aparece com duas ou mais opções. Um seletor de um item só é ruído. -->
<script lang="ts">
  import './trocar-origem.css';
  import { createEventDispatcher } from 'svelte';
  import type { OpcaoDeFonte } from './pedir-fonte';

  export let opcoes: OpcaoDeFonte[] = [];
  export let atual: string | null = null;
  export let trocando = false;

  const avisar = createEventDispatcher<{ trocar: string }>();
</script>

{#if opcoes.length > 1}
  <div class="origens" role="group" aria-label="Onde este episódio toca">
    <span class="origens-rotulo">Origem</span>
    {#each opcoes as opcao (opcao.id)}
      <button
        type="button"
        class="origens-opcao"
        class:origens-opcao-atual={opcao.id === atual}
        aria-pressed={opcao.id === atual}
        disabled={trocando}
        on:click={() => opcao.id !== atual && avisar('trocar', opcao.id)}
      >
        {opcao.rotulo}
        {#if opcao.id === atual}<span class="origens-marca">tocando</span>{/if}
      </button>
    {/each}
    {#if trocando}
      <span class="origens-estado" role="status">Trocando…</span>
    {/if}
  </div>
{/if}
