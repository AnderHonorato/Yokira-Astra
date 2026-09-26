<!-- Arquivo: src/lib/componentes/admin/fontes-do-episodio.svelte -->
<!-- As origens já cadastradas de um episódio, com a que está no ar em destaque. Trocar é
     um clique e não apaga nada: a anterior continua guardada e volta com outro clique.
     É o que permite testar um link novo sem perder o vídeo que já funcionava.

     Remover a que está no ar é recusado pelo servidor de propósito — primeiro ativa
     outra, depois remove esta. -->
<script lang="ts">
  import './fontes-do-episodio.css';
  import { ativarFonteNoServidor, removerFonteNoServidor } from '$cliente/fontes-de-midia';
  import Verificado from '$visual/icones/verificado.svelte';
  import Excluir from '$visual/icones/excluir.svelte';
  import type { FonteListada } from '../../contratos/midia';

  export let fontes: FonteListada[] = [];

  let ocupado: string | null = null;
  let erro: string | null = null;

  const ESTADO_EM_TEXTO: Record<string, string> = {
    PENDENTE: 'aguardando',
    PROCESSANDO: 'convertendo',
    PRONTO: 'pronta',
    FALHOU: 'falhou'
  };

  async function trocar(fonteId: string) {
    ocupado = fonteId;
    erro = null;
    try {
      fontes = await ativarFonteNoServidor(fonteId);
    } catch (falha) {
      erro = falha instanceof Error ? falha.message : 'Não deu para trocar a origem.';
    } finally {
      ocupado = null;
    }
  }

  async function remover(fonteId: string) {
    ocupado = fonteId;
    erro = null;
    try {
      fontes = await removerFonteNoServidor(fonteId);
    } catch (falha) {
      erro = falha instanceof Error ? falha.message : 'Não deu para remover a origem.';
    } finally {
      ocupado = null;
    }
  }
</script>

<section class="fontes">
  <h3 class="fontes-titulo">Origens deste episódio</h3>

  {#if erro}
    <p class="fontes-erro" role="alert">{erro}</p>
  {/if}

  {#if fontes.length === 0}
    <p class="fontes-vazio">Nenhuma origem cadastrada ainda.</p>
  {:else}
    <ul class="fontes-lista">
      {#each fontes as fonte (fonte.id)}
        <li class="fontes-item" class:fontes-item-ativa={fonte.ativa}>
          <div class="fontes-info">
            <strong class="fontes-rotulo">
              {#if fonte.ativa}<Verificado tamanho={14} />{/if}
              {fonte.rotulo}
            </strong>
            {#if fonte.detalhe}
              <span class="fontes-detalhe" title={fonte.detalhe}>{fonte.detalhe}</span>
            {/if}
            <span class="fontes-estado">
              {fonte.ativa
                ? 'no ar'
                : (ESTADO_EM_TEXTO[fonte.estado] ?? fonte.estado.toLowerCase())}
              {#if fonte.temporaria}· endereço com prazo{/if}
            </span>
            {#if fonte.aviso}
              <span class="fontes-aviso">{fonte.aviso}</span>
            {/if}
          </div>

          <div class="fontes-acoes">
            {#if !fonte.ativa && fonte.estado === 'PRONTO'}
              <button type="button" disabled={ocupado !== null} on:click={() => trocar(fonte.id)}>
                Colocar no ar
              </button>
            {/if}
            {#if !fonte.ativa}
              <button
                type="button"
                class="fontes-remover"
                disabled={ocupado !== null}
                aria-label={`Remover origem: ${fonte.rotulo}`}
                on:click={() => remover(fonte.id)}
              >
                <Excluir tamanho={14} />
              </button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>
