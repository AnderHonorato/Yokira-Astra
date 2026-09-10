<!-- Arquivo: src/routes/+layout.svelte -->
<!-- Casca de todas as paginas. O prefetch fica em "hover" no desktop e "tap" no mobile:
     no toque, "hover" nao existe e a rota so comecaria a carregar depois do clique. -->
<script lang="ts">
  import '$lib/estilos/tema.css';
  import '$lib/estilos/tema-claro.css';
  import '$lib/estilos/base.css';
  import '$lib/estilos/animacoes.css';
  import './layout.css';

  import { onMount } from 'svelte';
  import { navigating } from '$app/stores';
  import Cabecalho from '$componentes/casca/cabecalho.svelte';
  import BarraInferior from '$componentes/casca/barra-inferior.svelte';
  import Rodape from '$componentes/casca/rodape.svelte';
  import FaixaOffline from '$componentes/casca/faixa-offline.svelte';
  import TelaDeCarregamento from '$componentes/casca/tela-de-carregamento.svelte';
  import EsqueletoDeRota from '$componentes/carregando/esqueleto-de-rota.svelte';
  import Avisos from '$componentes/comum/avisos.svelte';
  import BoasVindas from '$componentes/comum/boas-vindas.svelte';
  import { registrarServiceWorker } from '$cliente/registrar-service-worker';
  import { estrategiaDePrefetch } from '$cliente/navegacao-instantanea';
  import { criarEsperaDeNavegacao } from '$cliente/espera-de-navegacao';

  export let data;

  let prefetch: 'hover' | 'tap' = 'hover';
  // Some da tela na hora do fechamento, sem esperar o servidor responder: a marcação é
  // registro, e prender a interface a ela só faria a mensagem demorar a sumir.
  let boasVindasVisiveis = true;

  function encerrarBoasVindas() {
    boasVindasVisiveis = false;
    // `keepalive` porque fechar e sair da página na sequência é o caminho normal: sem
    // ele o navegador cancela o pedido junto com a navegação, a marcação não chega ao
    // servidor e a mensagem "de uma vez só" volta na página seguinte.
    void fetch('/api/boas-vindas', { method: 'POST', keepalive: true }).catch(() => undefined);
  }

  // Guarda o caminho de destino enquanto a navegacao demora, e `null` quando ela
  // resolve dentro do limiar. Rota servida pelo cache do IndexedDB cai no segundo
  // caso e continua trocando na hora, sem piscar esqueleto nenhum.
  const esperandoRota = criarEsperaDeNavegacao(navigating);

  onMount(() => {
    prefetch = estrategiaDePrefetch();
    void registrarServiceWorker();
  });
</script>

<TelaDeCarregamento />
<FaixaOffline />
<Avisos />

{#if data.boasVindas && boasVindasVisiveis}
  <BoasVindas faixa={data.boasVindas} aoFechar={encerrarBoasVindas} />
{/if}

<div class="casca" data-sveltekit-preload-data={prefetch}>
  <Cabecalho usuario={data.usuario} podeAcessarPainel={data.podeAcessarPainel} />

  <main class="casca-conteudo">
    {#if $esperandoRota}
      <EsqueletoDeRota caminho={$esperandoRota} />
    {:else}
      <slot />
    {/if}
  </main>

  <Rodape />
  <BarraInferior />
</div>
