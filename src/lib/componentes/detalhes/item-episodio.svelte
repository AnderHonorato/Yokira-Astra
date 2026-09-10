<!-- Arquivo: src/lib/componentes/detalhes/item-episodio.svelte -->
<!-- Linha da lista: miniatura, "1. Nome do episódio", duração e audiência.

     Duas coisas saíram daqui. Os chips "Legendas Br" e "PT" eram fixos em toda linha, sem
     uma única legenda cadastrada no sistema — anunciavam algo que o catálogo não entrega.
     E o botão de baixar não tinha nenhuma ação por trás: era um alvo de clique que
     parecia funcionar e não fazia nada. Botão que não faz nada é pior do que botão
     nenhum, porque gasta a confiança de quem tenta. -->
<script lang="ts">
  import './item-episodio.css';
  import Play from '$visual/icones/play.svelte';
  import MetricasDeTitulo from '../comum/metricas-de-titulo.svelte';

  export let episodio: {
    id: string;
    numero: number;
    nome: string;
    duracaoMinutos: number;
    miniatura: string;
    visualizacoes?: number;
    temVideo?: boolean;
  };
  export let selecionado = false;

  $: temVideo = episodio.temVideo !== false;
</script>

<li class="episodio" class:episodio-selecionado={selecionado}>
  <a class="episodio-link" href={`/assistir/${episodio.id}`}>
    <span class="episodio-miniatura">
      <img src={episodio.miniatura} alt="" aria-hidden="true" loading="lazy" decoding="async" />
      {#if temVideo}
        <span class="episodio-play"><Play tamanho={14} /></span>
      {/if}
    </span>

    <span class="episodio-corpo">
      <span class="episodio-nome">{episodio.numero}. {episodio.nome}</span>
      <span class="episodio-meta">
        {#if episodio.duracaoMinutos > 0}
          <span class="episodio-duracao">{episodio.duracaoMinutos}min</span>
        {/if}
        {#if !temVideo}
          <span class="episodio-sem-video">Ainda sem vídeo</span>
        {/if}
        <MetricasDeTitulo visualizacoes={episodio.visualizacoes ?? 0} />
      </span>
    </span>
  </a>
</li>
