// Arquivo: testes/unitarios/verificar-fonte.teste.ts
// Verificação de link ponta a ponta, com transporte injetado. O transporte é de mentira;
// a lógica que decide, não. Isso é de propósito: a alternativa seria abrir a validação de
// SSRF para o teste conseguir falar com um servidor local, e afrouxar a proteção real
// para agradar um teste é exatamente o tipo de coisa que não se faz.
//
// Casos cobertos são os que aparecem de verdade: HTML disfarçado de .mp4, endereço
// assinado sem extensão, 403 de conteúdo que exige login, formato que o navegador não
// toca, e playlist mestre cuja variante não responde.

import { describe, expect, it } from 'vitest';
import { verificarFonte } from '../../src/lib/servidor/midia/fontes/verificar-fonte';
import type { RespostaAberta } from '../../src/lib/servidor/midia/fontes/amostrar-resposta';

interface RespostaFalsa {
  status?: number;
  cabecalhos?: Record<string, string>;
  corpo?: Buffer;
  destino?: string;
}

/** Monta um transporte que responde conforme o endereço pedido. */
function transporteDe(mapa: Record<string, RespostaFalsa>) {
  return async (url: URL): Promise<RespostaAberta> => {
    const resposta = mapa[url.toString()] ?? mapa['*'];
    if (!resposta) throw new Error(`Endereço sem resposta no teste: ${url.toString()}`);
    return {
      status: resposta.status ?? 200,
      cabecalhos: resposta.cabecalhos ?? {},
      destino: resposta.destino ?? resposta.cabecalhos?.location ?? null,
      amostra: resposta.corpo ?? Buffer.alloc(0),
      truncada: false
    };
  };
}

function mp4(): Buffer {
  const bytes = Buffer.alloc(64);
  bytes.writeUInt32BE(64, 0);
  bytes.write('ftypmp42', 4, 'latin1');
  return bytes;
}

const COM_FAIXAS = { 'content-type': 'video/mp4', 'accept-ranges': 'bytes' };

describe('verificarFonte', () => {
  it('recusa página HTML servida por um endereço terminado em .mp4', async () => {
    const endereco = 'https://exemplo.com/episodio.mp4';
    const resultado = await verificarFonte(endereco, 'a1', {
      transporte: transporteDe({
        '*': {
          cabecalhos: { 'content-type': 'video/mp4' },
          corpo: Buffer.from('<!doctype html><html><body>Faça login</body></html>')
        }
      })
    });

    expect(resultado.estado).toBe('INCOMPATIVEL');
    expect(resultado.mensagem).toContain('página');
    expect(resultado.previa).toBeNull();
  });

  it('aceita endereço assinado sem extensão quando os bytes são de vídeo', async () => {
    const endereco = 'https://cdn.exemplo.com/e/9f3a?X-Amz-Expires=900&X-Amz-Signature=zz';
    const resultado = await verificarFonte(endereco, 'a2', {
      transporte: transporteDe({ '*': { cabecalhos: COM_FAIXAS, corpo: mp4() } })
    });

    expect(resultado.estado).toBe('COMPATIVEL');
    expect(resultado.tipo).toBe('DIRETO');
    expect(resultado.temporaria).toBe(true);
    expect(resultado.avisos.join(' ')).toContain('prazo de validade');
    expect(resultado.previa?.tipo).toBe('DIRETO');
  });

  it('avisa quando a origem não aceita pedido por trecho', async () => {
    const resultado = await verificarFonte('https://exemplo.com/a.mp4', 'a3', {
      transporte: transporteDe({
        '*': { cabecalhos: { 'content-type': 'video/mp4' }, corpo: mp4() }
      })
    });

    expect(resultado.estado).toBe('COMPATIVEL');
    expect(resultado.avisos.join(' ')).toContain('avançar o vídeo');
  });

  it('explica o 403 em vez de mostrar o número', async () => {
    const resultado = await verificarFonte('https://exemplo.com/privado.mp4', 'a4', {
      transporte: transporteDe({ '*': { status: 403 } })
    });

    expect(resultado.estado).toBe('INDISPONIVEL');
    expect(resultado.mensagem).toContain('login');
    expect(resultado.saida).toContain('arquivo do computador');
  });

  it('manda converter o que o navegador não toca', async () => {
    const matroska = Buffer.alloc(16);
    matroska.writeUInt32BE(0x1a45dfa3, 0);
    const resultado = await verificarFonte('https://exemplo.com/a.mkv', 'a5', {
      transporte: transporteDe({
        '*': { cabecalhos: { 'content-type': 'video/x-matroska' }, corpo: matroska }
      })
    });

    expect(resultado.estado).toBe('PRECISA_PROCESSAR');
    expect(resultado.saida).toContain('converter');
  });

  it('aceita webm direto, que o navegador toca', async () => {
    const matroska = Buffer.alloc(16);
    matroska.writeUInt32BE(0x1a45dfa3, 0);
    const resultado = await verificarFonte('https://exemplo.com/a.webm', 'a6', {
      transporte: transporteDe({
        '*': {
          cabecalhos: { 'content-type': 'video/webm', 'accept-ranges': 'bytes' },
          corpo: matroska
        }
      })
    });

    expect(resultado.estado).toBe('COMPATIVEL');
    expect(resultado.tipo).toBe('DIRETO');
  });

  it('aceita playlist HLS e lista as qualidades da origem', async () => {
    const mestre = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360',
      '360p.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720',
      '720p.m3u8'
    ].join('\n');

    const resultado = await verificarFonte('https://cdn.exemplo.com/s/mestre.m3u8', 'a7', {
      transporte: transporteDe({
        'https://cdn.exemplo.com/s/mestre.m3u8': {
          cabecalhos: {
            'content-type': 'application/vnd.apple.mpegurl',
            'access-control-allow-origin': '*'
          },
          corpo: Buffer.from(mestre)
        },
        'https://cdn.exemplo.com/s/360p.m3u8': {
          cabecalhos: { 'content-type': 'application/vnd.apple.mpegurl' },
          corpo: Buffer.from('#EXTM3U\n#EXTINF:6.0,\na.ts\n')
        }
      })
    });

    expect(resultado.estado).toBe('COMPATIVEL');
    expect(resultado.tipo).toBe('HLS_REMOTO');
    expect(resultado.qualidades).toEqual([720, 360]);
    // Com CORS liberado o aviso não aparece.
    expect(resultado.avisos.join(' ')).not.toContain('outros sites');
  });

  it('avisa quando a playlist não libera leitura por outros sites', async () => {
    const resultado = await verificarFonte('https://cdn.exemplo.com/x.m3u8', 'a8', {
      transporte: transporteDe({
        '*': {
          cabecalhos: { 'content-type': 'application/x-mpegurl' },
          corpo: Buffer.from('#EXTM3U\n#EXTINF:6.0,\na.ts\n')
        }
      })
    });

    expect(resultado.estado).toBe('COMPATIVEL');
    expect(resultado.avisos.join(' ')).toContain('outros sites');
  });

  it('recusa playlist mestre cuja qualidade não responde', async () => {
    const mestre = ['#EXTM3U', '#EXT-X-STREAM-INF:BANDWIDTH=800000', '360p.m3u8'].join('\n');
    const resultado = await verificarFonte('https://cdn.exemplo.com/s/mestre.m3u8', 'a9', {
      transporte: transporteDe({
        'https://cdn.exemplo.com/s/mestre.m3u8': {
          cabecalhos: { 'content-type': 'application/vnd.apple.mpegurl' },
          corpo: Buffer.from(mestre)
        },
        'https://cdn.exemplo.com/s/360p.m3u8': { status: 404 }
      })
    });

    expect(resultado.estado).toBe('INDISPONIVEL');
    expect(resultado.mensagem).toContain('qualidade');
  });

  it('recusa endereço vazio e endereço com esquema não suportado', async () => {
    const transporte = transporteDe({ '*': { corpo: Buffer.alloc(0) } });

    const vazio = await verificarFonte('https://exemplo.com/nada.mp4', 'b1', { transporte });
    expect(vazio.estado).toBe('INCOMPATIVEL');
    expect(vazio.mensagem).toContain('nenhum conteúdo');

    const esquema = await verificarFonte('ftp://exemplo.com/a.mp4', 'b2', { transporte });
    expect(esquema.estado).toBe('INCOMPATIVEL');
    expect(esquema.mensagem).toContain('http');
  });

  it('devolve a assinatura do pedido para o painel descartar resposta atrasada', async () => {
    const resultado = await verificarFonte('https://exemplo.com/a.mp4', 'assinatura-7', {
      transporte: transporteDe({ '*': { cabecalhos: COM_FAIXAS, corpo: mp4() } })
    });
    expect(resultado.assinaturaPedido).toBe('assinatura-7');
    expect(resultado.confirmadaNoNavegador).toBe(false);
  });
});
