<!-- Arquivo: src/lib/componentes/player/retomar-progresso.svelte -->
<!-- Pergunta antes de continuar de onde parou. Retomar automático é hostil quando a
     pessoa voltou justamente para rever o começo, e começar do zero é hostil quando ela
     parou no minuto 19 de 23. Perguntar resolve os dois casos e custa um toque.

     Aparece por cima do vídeo e some sozinho quando a escolha é feita. Se ninguém
     escolher, nada acontece: o vídeo espera, não decide por conta própria. -->
<script lang="ts">
  import './retomar-progresso.css';
  import { createEventDispatcher } from 'svelte';
  import { formatarTempo } from './formatar-tempo';
  import BotaoPill from '$componentes/comum/botao-pill.svelte';

  export let segundos: number;

  const avisar = createEventDispatcher<{ retomar: void; recomecar: void }>();
</script>

<div class="retomar" role="dialog" aria-label="Continuar de onde parou">
  <p class="retomar-texto">Você parou em {formatarTempo(segundos)}.</p>
  <div class="retomar-acoes">
    <BotaoPill variante="marca" on:click={() => avisar('retomar')}>Continuar daqui</BotaoPill>
    <BotaoPill variante="neutro" on:click={() => avisar('recomecar')}>Começar do início</BotaoPill>
  </div>
</div>
