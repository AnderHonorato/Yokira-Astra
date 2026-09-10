<!-- Arquivo: src/lib/componentes/comum/boas-vindas.svelte -->
<!-- Mensagem do primeiro acesso, uma vez só. É um <dialog> nativo de propósito: ele já
     traz foco preso dentro, fechamento pelo Esc e o papel certo para leitor de tela —
     três coisas que uma div com position:fixed teria que reimplementar mal.

     Fechar é o que marca como vista, no servidor. Marcar ao abrir perderia a mensagem de
     quem teve a aba fechada antes de ler. -->
<script lang="ts">
  import './boas-vindas.css';
  import { onMount } from 'svelte';
  import FaixaPromocional from './faixa-promocional.svelte';
  import BotaoPill from './botao-pill.svelte';
  import Fechar from '$visual/icones/fechar.svelte';
  import type { FaixaPublica } from '$servidor/banco/faixas-promocionais';

  export let faixa: FaixaPublica;
  export let aoFechar: () => void;

  let dialogo: HTMLDialogElement | undefined;

  onMount(() => {
    dialogo?.showModal();
  });

  function fechar() {
    dialogo?.close();
    aoFechar();
  }
</script>

<dialog class="boas-vindas" bind:this={dialogo} on:close={aoFechar} aria-label="Boas-vindas">
  <button class="boas-vindas-fechar" type="button" aria-label="Fechar" on:click={fechar}>
    <Fechar tamanho={18} />
  </button>

  <FaixaPromocional
    titulo={faixa.titulo}
    texto={faixa.texto}
    rotuloBotao={faixa.rotuloBotao}
    destino={faixa.destino}
    corInicial={faixa.corInicial}
    corFinal={faixa.corFinal}
  />

  <div class="boas-vindas-acoes">
    <BotaoPill variante="neutro" on:click={fechar}>Começar a explorar</BotaoPill>
  </div>
</dialog>
