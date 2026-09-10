<!-- Arquivo: src/lib/componentes/comum/metricas-de-titulo.svelte -->
<!-- Visualizações e curtidas, na mesma forma em toda tela onde aparecem. Um componente
     só porque o formato do número tem que bater: um cartão dizendo "1,2 mil" ao lado de
     uma página dizendo "1234" faz parecer que são coisas diferentes.

     Zero não vira "0": um título que ninguém assistiu ainda não precisa anunciar isso na
     capa. Some, e volta a aparecer quando houver o que mostrar. -->
<script lang="ts">
  import './metricas-de-titulo.css';
  import { emTextoCurto } from './formatar-numero';
  import OlhoAssistindo from '$visual/icones/olho-assistindo.svelte';
  import PolegarCima from '$visual/icones/polegar-cima.svelte';

  export let visualizacoes = 0;
  export let curtidas = 0;
  export let tamanho: 'pequeno' | 'normal' = 'pequeno';
</script>

{#if visualizacoes > 0 || curtidas > 0}
  <span class="metricas metricas-{tamanho}">
    {#if visualizacoes > 0}
      <span class="metricas-item">
        <OlhoAssistindo tamanho={tamanho === 'normal' ? 15 : 12} />
        <span>{emTextoCurto(visualizacoes)}</span>
        <span class="metricas-oculto">
          {visualizacoes === 1 ? 'visualização' : 'visualizações'}
        </span>
      </span>
    {/if}
    {#if curtidas > 0}
      <span class="metricas-item">
        <PolegarCima tamanho={tamanho === 'normal' ? 15 : 12} />
        <span>{emTextoCurto(curtidas)}</span>
        <span class="metricas-oculto">{curtidas === 1 ? 'curtida' : 'curtidas'}</span>
      </span>
    {/if}
  </span>
{/if}
