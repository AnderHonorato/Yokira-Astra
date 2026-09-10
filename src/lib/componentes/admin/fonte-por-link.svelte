<!-- Arquivo: src/lib/componentes/admin/fonte-por-link.svelte -->
<!-- Colar um link, verificar e só então salvar. A verificação é do servidor; a prévia é
     deste navegador. As duas aparecem separadas na tela porque significam coisas
     diferentes, e juntar as duas num único "pronto" é o que faz um episódio entrar no ar
     quebrado.

     O formulário continua sendo um POST de verdade: sem JavaScript dá para salvar o link
     direto, só sem a conferência prévia. -->
<script lang="ts">
  import './fonte-por-link.css';
  import { novaAssinatura, verificarLink } from '$cliente/fontes-de-midia';
  import BotaoPill from '$componentes/comum/botao-pill.svelte';
  import PreviaDaFonte from './previa-da-fonte.svelte';
  import type { ResultadoVerificacao } from '../../contratos/midia';

  export let podeSalvar = false;
  export let ocupado = false;

  let url = '';
  let verificando = false;
  let resultado: ResultadoVerificacao | null = null;
  let erro: string | null = null;
  let assinaturaAtual = '';
  let controlador: AbortController | null = null;

  const ROTULO_DO_ESTADO: Record<string, string> = {
    COMPATIVEL: 'Vídeo pronto',
    PRECISA_PROCESSAR: 'Precisa converter',
    INDISPONIVEL: 'Indisponível',
    INCOMPATIVEL: 'Não dá para usar'
  };

  // Trocar a URL invalida o que estava na tela: manter "Vídeo pronto" de um endereço
  // anterior ao lado de um campo já editado é a forma mais fácil de salvar errado.
  $: if (url !== resultado?.url) {
    resultado = null;
    erro = null;
  }

  async function verificar() {
    const endereco = url.trim();
    if (endereco === '') return;

    controlador?.abort();
    controlador = new AbortController();
    const assinatura = novaAssinatura();
    assinaturaAtual = assinatura;
    verificando = true;
    erro = null;

    try {
      const resposta = await verificarLink(endereco, assinatura, controlador.signal);
      // Resposta de uma verificação anterior chegando atrasada: descarta.
      if (resposta.assinaturaPedido !== assinaturaAtual) return;
      resultado = { ...resposta, url: endereco };
    } catch (falha) {
      if (falha instanceof DOMException && falha.name === 'AbortError') return;
      erro = falha instanceof Error ? falha.message : 'Não deu para verificar esse link.';
    } finally {
      if (assinaturaAtual === assinatura) verificando = false;
    }
  }
</script>

<div class="link-fonte">
  <label class="link-campo">
    <span>Link do vídeo</span>
    <input
      type="url"
      name="link"
      bind:value={url}
      inputmode="url"
      autocomplete="off"
      placeholder="https://exemplo.com/episodio.mp4"
    />
  </label>

  <p class="link-dica">
    Aceitamos o link direto de um arquivo, uma playlist HLS e páginas do YouTube e do Vimeo. Link de
    arquivo compatível toca direto da origem, sem cópia. Endereços de rede interna são recusados.
  </p>

  <div class="link-acoes">
    <BotaoPill
      variante="neutro"
      tipo="button"
      desabilitado={verificando || url.trim() === ''}
      on:click={verificar}
    >
      {verificando ? 'Verificando…' : 'Verificar vídeo'}
    </BotaoPill>
    <BotaoPill
      variante="marca"
      tipo="submit"
      desabilitado={!podeSalvar || ocupado || url.trim() === ''}
    >
      {ocupado ? 'Salvando…' : 'Usar este link'}
    </BotaoPill>
  </div>

  {#if erro}
    <p class="link-erro" role="alert">{erro}</p>
  {/if}

  {#if resultado}
    <div class="link-veredito" data-estado={resultado.estado} role="status">
      <strong class="link-estado">{ROTULO_DO_ESTADO[resultado.estado] ?? resultado.estado}</strong>
      <p class="link-mensagem">{resultado.mensagem}</p>
      {#if resultado.saida}
        <p class="link-saida">{resultado.saida}</p>
      {/if}

      {#if resultado.qualidades.length > 0}
        <p class="link-qualidades">
          Qualidades na origem: {resultado.qualidades.map((altura) => `${altura}p`).join(', ')}
        </p>
      {/if}

      {#if resultado.avisos.length > 0}
        <ul class="link-avisos">
          {#each resultado.avisos as aviso (aviso)}
            <li>{aviso}</li>
          {/each}
        </ul>
      {/if}

      {#if resultado.previa}
        <PreviaDaFonte previa={resultado.previa} />
      {/if}
    </div>
  {/if}
</div>
