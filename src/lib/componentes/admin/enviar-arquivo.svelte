<!-- Arquivo: src/lib/componentes/admin/enviar-arquivo.svelte -->
<!-- Envio de arquivo com progresso real e cancelamento. O arquivo sobe em fluxo para um
     endpoint próprio: um vídeo de horas não cabe na memória do servidor, e uma barra que
     não anda é indistinguível de uma tela travada.

     Cancelar não é enfeite: interrompido, o servidor apaga o arquivo parcial em vez de
     deixar lixo no disco. -->
<script lang="ts">
  import './enviar-arquivo.css';
  import { createEventDispatcher } from 'svelte';
  import { enviarArquivoDeVideo, tamanhoEmTexto } from '$cliente/enviar-arquivo-de-video';
  import { novoToken } from '$cliente/fontes-de-midia';
  import BotaoPill from '$componentes/comum/botao-pill.svelte';
  import Upload from '$visual/icones/upload.svelte';

  export let episodioId: string | null = null;
  export let limiteBytes: number;
  export let temFfmpeg = true;

  const avisar = createEventDispatcher<{ concluido: string }>();

  let escolhido: File | null = null;
  let progresso = 0;
  let enviando = false;
  let erro: string | null = null;
  let cancelar: (() => void) | null = null;

  function aoEscolher(evento: Event) {
    const entrada = evento.currentTarget as HTMLInputElement;
    escolhido = entrada.files?.[0] ?? null;
    erro = escolhido && escolhido.size > limiteBytes ? 'Esse arquivo passa do limite.' : null;
  }

  async function enviar() {
    if (!escolhido || !episodioId || enviando) return;
    enviando = true;
    progresso = 0;
    erro = null;

    // Token fixo por envio: se a requisição for repetida, o servidor reconhece o mesmo
    // pedido em vez de criar uma segunda fonte para o mesmo arquivo.
    const envio = enviarArquivoDeVideo({
      episodioId,
      arquivo: escolhido,
      token: novoToken(),
      aoProgredir: (valor) => (progresso = valor)
    });
    cancelar = envio.cancelar;

    try {
      const resposta = await envio.promessa;
      avisar('concluido', resposta.mensagem);
      escolhido = null;
      progresso = 0;
    } catch (falha) {
      erro = falha instanceof Error ? falha.message : 'O envio não terminou.';
    } finally {
      enviando = false;
      cancelar = null;
    }
  }
</script>

<div class="enviar-arquivo">
  <label class="enviar-campo">
    <span>Arquivo de vídeo</span>
    <input type="file" accept=".mp4,.mkv,.mov,.webm,video/*" on:change={aoEscolher} />
  </label>

  <p class="enviar-dica">
    Aceitamos mp4, mkv, mov e webm, até {tamanhoEmTexto(limiteBytes)}. O arquivo é convertido aqui e
    passa a tocar pelo player do Yōkira.
    {#if !temFfmpeg}
      <strong class="enviar-alerta">
        O conversor de vídeo não está instalado nesta máquina, então o arquivo vai ficar na fila até
        alguém instalá-lo.
      </strong>
    {/if}
  </p>

  {#if escolhido}
    <p class="enviar-escolhido">
      {escolhido.name} · {tamanhoEmTexto(escolhido.size)}
    </p>
  {/if}

  {#if enviando}
    <div class="enviar-progresso">
      <div
        class="enviar-barra"
        role="progressbar"
        aria-valuenow={progresso}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Progresso do envio"
      >
        <span style={`width:${progresso}%`}></span>
      </div>
      <span class="enviar-porcentagem">{progresso}%</span>
    </div>
  {/if}

  {#if erro}
    <p class="enviar-erro" role="alert">{erro}</p>
  {/if}

  <div class="enviar-acoes">
    <BotaoPill
      variante="marca"
      tipo="button"
      desabilitado={!escolhido || !episodioId || enviando || erro !== null}
      on:click={enviar}
    >
      <Upload tamanho={16} />
      {enviando ? 'Enviando…' : 'Enviar arquivo'}
    </BotaoPill>
    {#if enviando}
      <BotaoPill variante="neutro" tipo="button" on:click={() => cancelar?.()}>Cancelar</BotaoPill>
    {/if}
  </div>
</div>
