<!-- Arquivo: src/lib/componentes/admin/escolher-episodio.svelte -->
<!-- Seletor de episódio com busca e paginação. Substitui um <select> que carregava os 60
     primeiros episódios de um catálogo de quase 800: os outros 92% não tinham como ser
     escolhidos de jeito nenhum.

     A busca casa contra o nome do título e o do episódio ao mesmo tempo, porque é assim
     que a pessoa lembra. A lista também diz quais já têm vídeo, que é a pergunta que
     aparece na hora de decidir onde mexer. -->
<script lang="ts">
  import './escolher-episodio.css';
  import { createEventDispatcher, onMount } from 'svelte';
  import { buscarEpisodios } from '$cliente/fontes-de-midia';
  import Lupa from '$visual/icones/lupa.svelte';
  import Verificado from '$visual/icones/verificado.svelte';
  import type { EpisodioSelecionavel, EpisodiosSelecionaveis } from '../../contratos/midia';

  export let lista: EpisodiosSelecionaveis;
  export let busca = '';
  export let selecionado: EpisodioSelecionavel | null = null;

  const avisar = createEventDispatcher<{ escolher: EpisodioSelecionavel }>();

  let carregando = false;
  let erro: string | null = null;
  let controlador: AbortController | null = null;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let montado = false;

  async function carregar(termo: string, pagina: number) {
    controlador?.abort();
    controlador = new AbortController();
    carregando = true;
    erro = null;
    try {
      lista = await buscarEpisodios(termo, pagina, controlador.signal);
    } catch (falha) {
      if (falha instanceof DOMException && falha.name === 'AbortError') return;
      erro = falha instanceof Error ? falha.message : 'Não deu para carregar a lista.';
    } finally {
      carregando = false;
    }
  }

  // Espera a digitação parar: sem isso cada tecla vira um pedido e as respostas chegam
  // fora de ordem.
  function aoDigitar() {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => void carregar(busca, 1), 250);
  }

  onMount(() => {
    montado = true;
    return () => {
      clearTimeout(temporizador);
      controlador?.abort();
    };
  });

  function escolher(episodio: EpisodioSelecionavel) {
    selecionado = episodio;
    avisar('escolher', episodio);
  }
</script>

<div class="escolher-episodio">
  <label class="escolher-busca">
    <span class="escolher-rotulo">Procurar episódio</span>
    <span class="escolher-campo">
      <Lupa tamanho={16} />
      <input
        type="search"
        bind:value={busca}
        on:input={aoDigitar}
        placeholder="Nome do anime ou do episódio"
        autocomplete="off"
      />
    </span>
  </label>

  {#if erro}
    <p class="escolher-erro" role="alert">{erro}</p>
  {/if}

  <ul class="escolher-lista" aria-busy={carregando}>
    {#each lista.episodios as episodio (episodio.id)}
      <li>
        <button
          type="button"
          class="escolher-item"
          data-episodio={episodio.id}
          class:escolher-item-ativo={selecionado?.id === episodio.id}
          aria-pressed={selecionado?.id === episodio.id}
          on:click={() => escolher(episodio)}
        >
          <span class="escolher-nome">
            {episodio.titulo} — T{episodio.temporada} EP{episodio.numero}
          </span>
          <span class="escolher-detalhe">{episodio.nome}</span>
          {#if episodio.temVideo}
            <span class="escolher-marca"><Verificado tamanho={13} /> já tem vídeo</span>
          {/if}
        </button>
      </li>
    {:else}
      <li class="escolher-vazio">
        {carregando ? 'Procurando…' : 'Nenhum episódio com esse nome.'}
      </li>
    {/each}
  </ul>

  {#if lista.paginas > 1 && montado}
    <div class="escolher-paginas">
      <button
        type="button"
        disabled={lista.pagina <= 1 || carregando}
        on:click={() => void carregar(busca, lista.pagina - 1)}
      >
        Anteriores
      </button>
      <span>Página {lista.pagina} de {lista.paginas} · {lista.total} episódios</span>
      <button
        type="button"
        disabled={lista.pagina >= lista.paginas || carregando}
        on:click={() => void carregar(busca, lista.pagina + 1)}
      >
        Próximos
      </button>
    </div>
  {/if}
</div>
