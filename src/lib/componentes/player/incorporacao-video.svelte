<!-- Arquivo: src/lib/componentes/player/incorporacao-video.svelte -->
<!-- Quadro para vídeo que mora no provedor. A moldura é a nossa, para a página não mudar
     de cara conforme a origem; os controles são os dele, e a legenda embaixo diz isso em
     vez de fingir que a barra roxa do Yōkira manda no player do YouTube.

     Nada de HTML de terceiro: o endereço é remontado no servidor a partir do id, e este
     componente só recebe a URL pronta. Também não escutamos postMessage nenhum do
     iframe — sem escuta não há mensagem forjada para validar. -->
<script lang="ts">
  import './incorporacao-video.css';
  import { nomeDoProvedorNoCliente } from './nome-do-provedor';

  export let url: string;
  export let tipo: string;
  export let episodio: string;

  $: provedor = nomeDoProvedorNoCliente(tipo);
</script>

<div class="incorporacao">
  <div class="incorporacao-quadro">
    <iframe
      class="incorporacao-iframe"
      src={url}
      title={`${episodio} — player do ${provedor}`}
      loading="lazy"
      referrerpolicy="strict-origin-when-cross-origin"
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      allowfullscreen
    ></iframe>
  </div>
  <p class="incorporacao-nota">
    Este episódio toca no player do {provedor}. Os controles, a qualidade e a retomada seguem as
    regras dele.
  </p>
</div>
