<!-- Arquivo: src/lib/componentes/comum/faixa-promocional.svelte -->
<!-- Faixa retangular com fundo em degradê e texto escrito no painel. As duas cores vêm
     do banco já validadas como #RRGGBB — aqui elas só entram em variáveis CSS, nunca
     como regra de estilo montada com texto livre.

     O contraste do texto é calculado a partir das cores escolhidas: com um degradê claro,
     texto branco sumiria, e não dá para exigir que quem edita saiba disso. -->
<script lang="ts">
  import './faixa-promocional.css';
  import { corDeTextoPara } from './contraste-da-faixa';

  export let titulo: string;
  export let texto: string;
  export let rotuloBotao: string | null = null;
  export let destino: string | null = null;
  export let corInicial: string;
  export let corFinal: string;

  $: corDoTexto = corDeTextoPara(corInicial, corFinal);
</script>

<section
  class="faixa"
  style={`--faixa-inicio:${corInicial};--faixa-fim:${corFinal};--faixa-texto:${corDoTexto}`}
>
  <div class="faixa-conteudo">
    {#if titulo}
      <h2 class="faixa-titulo">{titulo}</h2>
    {/if}
    {#if texto}
      <p class="faixa-texto">{texto}</p>
    {/if}
  </div>

  {#if rotuloBotao && destino}
    <a class="faixa-botao" href={destino}>{rotuloBotao}</a>
  {/if}
</section>
