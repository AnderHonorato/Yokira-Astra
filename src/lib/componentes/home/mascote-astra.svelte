<!-- Mascote original fornecido pelo proprietário. Integração à home SvelteKit. -->
<script lang="ts">
  import './mascote-astra.css';
  import { ACOES_ASTRA, RESPOSTA_ASTRA } from './mascote-astra';

  let aberto = false;
</script>

<section class="astra-guia" aria-label="Conheça Astra, o guardião Yōkira">
  <div class="astra-ilustracao">
    <img
      src="/mascotes/astra.webp"
      alt="Astra, guardião de aparência animal, pelo roxo, olhos violeta, quatro patas e símbolo cósmico"
      width="128"
      height="128"
      loading="lazy"
      decoding="async"
    />
  </div>

  <div class="astra-apresentacao">
    <span class="astra-legenda"
      ><span class="astra-estrela" aria-hidden="true"></span> GUIA YŌKIRA</span
    >
    <h2>Esse é o Astra.</h2>
    <p>Um guardião cósmico com personalidade própria para acompanhar suas descobertas.</p>
    {#if aberto}
      <p id="astra-conversa" class="astra-resposta">{RESPOSTA_ASTRA}</p>
      <div class="astra-atalhos" aria-label="Caminhos sugeridos por Astra">
        {#each ACOES_ASTRA as acao (acao.href)}
          <a href={acao.href}>{acao.rotulo}<span aria-hidden="true">↗</span></a>
        {/each}
      </div>
    {/if}
  </div>

  <button
    type="button"
    class="astra-conhecer"
    aria-expanded={aberto}
    aria-controls="astra-conversa"
    on:click={() => (aberto = !aberto)}
  >
    {aberto ? 'Recolher' : 'Conhecer o Astra'}
    <span aria-hidden="true">{aberto ? '−' : '+'}</span>
  </button>
</section>
