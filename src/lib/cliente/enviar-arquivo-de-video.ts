// Arquivo: src/lib/cliente/enviar-arquivo-de-video.ts
// Envia o arquivo com progresso de verdade. Usa XMLHttpRequest de propósito: o `fetch`
// não expõe progresso de subida, e num arquivo de horas de vídeo uma barra parada é
// indistinguível de uma tela travada.
//
// Devolve também um jeito de cancelar. Envio interrompido pelo usuário deixa o servidor
// apagar o arquivo parcial, que é o que o `gravarFluxo` faz quando o fluxo morre.

export interface EnvioEmAndamento {
  promessa: Promise<{ mensagem: string; pronta: boolean }>;
  cancelar: () => void;
}

interface CorpoDaResposta {
  mensagem?: string;
  pronta?: boolean;
  message?: string;
}

/** Resposta de erro do servidor nem sempre é JSON: um proxy no meio devolve HTML. */
function lerCorpo(texto: string): CorpoDaResposta | null {
  try {
    return JSON.parse(texto) as CorpoDaResposta;
  } catch {
    return null;
  }
}

export interface PedidoDeEnvio {
  episodioId: string;
  arquivo: File;
  token: string;
  aoProgredir: (porcentagem: number) => void;
}

export function enviarArquivoDeVideo(pedido: PedidoDeEnvio): EnvioEmAndamento {
  const requisicao = new XMLHttpRequest();
  const endereco =
    `/api/admin/fontes/arquivo?episodioId=${encodeURIComponent(pedido.episodioId)}` +
    `&nome=${encodeURIComponent(pedido.arquivo.name)}&token=${encodeURIComponent(pedido.token)}`;

  const promessa = new Promise<{ mensagem: string; pronta: boolean }>((resolver, rejeitar) => {
    requisicao.open('PUT', endereco);
    requisicao.setRequestHeader('accept', 'application/json');

    requisicao.upload.addEventListener('progress', (evento) => {
      if (!evento.lengthComputable) return;
      pedido.aoProgredir(Math.round((evento.loaded / evento.total) * 100));
    });

    requisicao.addEventListener('load', () => {
      const corpo = lerCorpo(requisicao.responseText);
      if (requisicao.status >= 200 && requisicao.status < 300) {
        resolver({
          mensagem: corpo?.mensagem ?? 'Arquivo recebido.',
          pronta: corpo?.pronta ?? false
        });
        return;
      }
      rejeitar(new Error(corpo?.message ?? 'O envio não foi aceito.'));
    });

    requisicao.addEventListener('error', () =>
      rejeitar(new Error('A conexão caiu durante o envio.'))
    );
    requisicao.addEventListener('abort', () => rejeitar(new Error('Envio cancelado.')));

    requisicao.send(pedido.arquivo);
  });

  return { promessa, cancelar: () => requisicao.abort() };
}

/** Tamanho em texto curto, para a tela dizer o limite sem falar em bytes. */
export function tamanhoEmTexto(bytes: number): string {
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
  let valor = bytes;
  let indice = 0;
  while (valor >= 1024 && indice < unidades.length - 1) {
    valor /= 1024;
    indice += 1;
  }
  const casas = valor >= 100 || indice === 0 ? 0 : 1;
  return `${valor.toFixed(casas)} ${unidades[indice]}`;
}
