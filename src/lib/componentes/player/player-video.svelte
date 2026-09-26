<!-- Arquivo: src/lib/componentes/player/player-video.svelte -->
<!-- Player com controles próprios. Os nativos davam tela cheia e acessibilidade de
     graça, mas cada navegador desenhava um player diferente e nenhum deles enxergava as
     variantes de qualidade que o nosso HLS publica.

     Serve três origens pelo mesmo quadro: HLS próprio, playlist remota e arquivo direto.
     A quarta — vídeo que mora no YouTube ou no Vimeo — ganha quadro separado, porque lá
     os controles não são nossos e fingir que são seria mentira na interface. -->
<script lang="ts">
  import './player-video.css';
  import { onDestroy, onMount, tick } from 'svelte';
  import { type MidiaAnexada, type NivelDeQualidade } from './carregar-hls';
  import { anexarFonte } from './anexar-fonte';
  import { ehIncorporacao, pedirFonte, pedirOpcoesDeFonte, type OpcaoDeFonte } from './pedir-fonte';
  import { criarComandos } from './comandos-do-video';
  import { criarAgendador } from './progresso-periodico';
  import { criarOcultador } from './ocultar-controles';
  import { criarPulso } from './pulso-de-audiencia';
  import { MIDIA_PARADA, observarMidia, type EstadoDaMidia } from './estado-da-midia';
  import { acaoDaTecla, aplicarAtalho } from './atalhos-do-player';
  import { obterChaveDeAudiencia } from './chave-de-audiencia';
  import QuadroProprio from './quadro-proprio.svelte';
  import IncorporacaoVideo from './incorporacao-video.svelte';
  import TrocarOrigem from './trocar-origem.svelte';
  import RetomarProgresso from './retomar-progresso.svelte';
  import {
    registrarVisualizacao,
    salvarProgressoNoServidor,
    sinalizarAudiencia
  } from '$cliente/acoes-do-usuario';
  import OlhoAssistindo from '$visual/icones/olho-assistindo.svelte';
  import type { FonteParaPlayer } from '../../contratos/midia';

  export let episodioId: string;
  export let temMidia = false;
  export let segundoInicial = 0;
  export let rotuloDoEpisodio = 'Episódio';

  /** Abaixo disto não vale perguntar: a pessoa mal começou. */
  const MINIMO_PARA_RETOMAR = 30;

  let quadro: HTMLDivElement | undefined;
  let video: HTMLVideoElement | undefined;
  let assistindo = 0;
  let mensagemErro: string | null = null;
  let carregando = false;
  let fonte: FonteParaPlayer | null = null;
  let opcoes: OpcaoDeFonte[] = [];
  let origemAtual: string | null = null;
  let trocando = false;
  let perguntarRetomada = false;
  let jaContou = false;
  let midia: MidiaAnexada | undefined;
  let pararDeObservar: (() => void) | undefined;

  let estado: EstadoDaMidia = MIDIA_PARADA;
  let niveis: NivelDeQualidade[] = [];
  let nivelAtual = -1;
  let controlesVisiveis = true;

  $: incorporado = fonte !== null && ehIncorporacao(fonte);

  const comandos = criarComandos(
    () => video,
    () => quadro,
    () => estado
  );
  const ocultador = criarOcultador((visivel) => (controlesVisiveis = visivel));
  const agendador = criarAgendador((segundos) => {
    void salvarProgressoNoServidor(episodioId, segundos).catch(() => undefined);
  });
  const pulso = criarPulso(
    async () => (await sinalizarAudiencia(episodioId, obterChaveDeAudiencia())).assistindo,
    (contagem) => (assistindo = contagem)
  );

  function aoTeclar(evento: KeyboardEvent) {
    const acao = acaoDaTecla(evento.key, evento.target);
    if (!acao) return;
    evento.preventDefault();
    ocultador.revelar();
    aplicarAtalho(acao, comandos);
  }

  /** Pausado a barra fica; tocando ela some sozinha. */
  function aoMudarMidia(novo: EstadoDaMidia) {
    const parou = estado.tocando && !novo.tocando;
    const comecou = !estado.tocando && novo.tocando;
    estado = novo;
    agendador.aoAtualizarTempo(novo.atual);
    if (parou) agendador.gravarAgora(novo.atual);
    if (comecou) contarVisualizacao();
    ocultador.travar(!novo.tocando);
  }

  /**
   * Uma visualização por abertura da tela, no primeiro play. Trocar de origem ou dar
   * pause e play de novo não conta de novo — quem repete aqui é a mesma pessoa no mesmo
   * episódio, e contar isso seria inflar o número que ordena a trilha de mais assistidos.
   */
  function contarVisualizacao() {
    if (jaContou) return;
    jaContou = true;
    void registrarVisualizacao(episodioId).catch(() => undefined);
  }

  // Uma gravação final quando a aba fecha: o onDestroy não roda em fechamento de aba.
  const aoSair = () => agendador.encerrar();

  function soltarMidia() {
    pararDeObservar?.();
    pararDeObservar = undefined;
    midia?.desanexar();
    midia = undefined;
    niveis = [];
    nivelAtual = -1;
    estado = MIDIA_PARADA;
  }

  async function montarFonte(fonteId?: string, segundoDesejado = 0) {
    carregando = true;
    mensagemErro = null;
    try {
      const escolhida = await pedirFonte(episodioId, fonteId);
      fonte = escolhida;
      if (ehIncorporacao(escolhida)) return;
      // O elemento de vídeo só existe depois que o Svelte pinta este ramo.
      await tick();
      if (!video) throw new Error('Não foi possível preparar o reprodutor.');
      pararDeObservar = observarMidia(video, aoMudarMidia);
      midia = await anexarFonte(video, escolhida, (lista) => (niveis = lista));
      niveis = midia.niveis;
      if (segundoDesejado > 0) video.currentTime = segundoDesejado;
    } catch (erro) {
      mensagemErro = erro instanceof Error ? erro.message : 'Não foi possível carregar o vídeo.';
    } finally {
      carregando = false;
    }
  }

  /** Trocar interrompe a atual antes de montar a nova: nada de dois áudios juntos. */
  async function trocarOrigem(fonteId: string) {
    if (trocando) return;
    trocando = true;
    const ponto = estado.atual;
    video?.pause();
    soltarMidia();
    origemAtual = fonteId;
    await montarFonte(fonteId, ponto);
    trocando = false;
  }

  function retomar() {
    perguntarRetomada = false;
    comandos.buscar(segundoInicial);
    comandos.alternar();
  }

  function recomecar() {
    perguntarRetomada = false;
    comandos.buscar(0);
    comandos.alternar();
  }

  onMount(() => {
    window.addEventListener('beforeunload', aoSair);
    void (async () => {
      if (temMidia) {
        opcoes = await pedirOpcoesDeFonte(episodioId);
        origemAtual = opcoes.find((opcao) => opcao.padrao)?.id ?? opcoes[0]?.id ?? null;
        // Não posiciona o vídeo: quem decide se retoma é a pessoa, na pergunta abaixo.
        await montarFonte();
        perguntarRetomada = segundoInicial >= MINIMO_PARA_RETOMAR && !incorporado;
      }
      pulso.iniciar();
    })();
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', aoSair);
    pulso.encerrar();
    ocultador.encerrar();
    soltarMidia();
    agendador.encerrar();
  });
</script>

<div class="player">
  {#if !temMidia}
    <div class="player-vazio">
      <p>Este episódio ainda não tem vídeo.</p>
      <p class="player-vazio-dica">Assim que ele for publicado, aparece aqui.</p>
    </div>
  {:else if incorporado && fonte}
    <IncorporacaoVideo url={fonte.url} tipo={fonte.tipo} episodio={rotuloDoEpisodio} />
  {:else}
    <div class="player-com-aviso">
      <QuadroProprio
        bind:video
        bind:quadro
        {estado}
        {niveis}
        {nivelAtual}
        {carregando}
        {controlesVisiveis}
        {comandos}
        {aoTeclar}
        legendas={fonte?.legendas ?? []}
        aoRevelar={() => ocultador.revelar()}
        aoTrocarNivel={(indice) => {
          nivelAtual = indice;
          midia?.definirNivel(indice);
        }}
        aoFalhar={(mensagem) => (mensagemErro = mensagem)}
      />
      {#if perguntarRetomada}
        <RetomarProgresso segundos={segundoInicial} on:retomar={retomar} on:recomecar={recomecar} />
      {/if}
    </div>
  {/if}

  {#if mensagemErro}
    <p class="player-erro" role="alert">{mensagemErro}</p>
  {/if}

  {#if temMidia}
    <div class="player-rodape">
      <TrocarOrigem
        {opcoes}
        atual={origemAtual}
        {trocando}
        on:trocar={(e) => trocarOrigem(e.detail)}
      />
      <p class="player-audiencia">
        <span class="player-ponto" aria-hidden="true"></span>
        <OlhoAssistindo tamanho={14} />
        {assistindo} assistindo agora
      </p>
    </div>
  {/if}
</div>
