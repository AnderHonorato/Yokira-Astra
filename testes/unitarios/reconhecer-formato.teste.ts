// Arquivo: testes/unitarios/reconhecer-formato.teste.ts
// O reconhecimento de formato é a peça que decide se um link vira episódio ou vira erro.
// Testar com bytes de verdade é barato e cobre justamente os dois enganos que aparecem na
// prática: o `.mp4` que devolve uma página de login e o endereço assinado sem extensão
// nenhuma que é um vídeo perfeitamente válido.

import { describe, expect, it } from 'vitest';
import {
  extensaoDoCaminho,
  pareceTemporario,
  reconhecerFormato
} from '../../src/lib/servidor/midia/fontes/reconhecer';

/** Caixa ISO-BMFF: 4 bytes de tamanho e o marcador `ftyp` no deslocamento 4. */
function bytesDeMp4(): Buffer {
  const cabecalho = Buffer.alloc(32);
  cabecalho.writeUInt32BE(32, 0);
  cabecalho.write('ftypisom', 4, 'latin1');
  return cabecalho;
}

function bytesDeMatroska(): Buffer {
  const cabecalho = Buffer.alloc(16);
  cabecalho.writeUInt32BE(0x1a45dfa3, 0);
  return cabecalho;
}

function bytesDeTs(): Buffer {
  const pacote = Buffer.alloc(377);
  pacote[0] = 0x47;
  pacote[188] = 0x47;
  pacote[376] = 0x47;
  return pacote;
}

const NADA = Buffer.alloc(0);

describe('reconhecerFormato', () => {
  it('reconhece mp4 pelos bytes mesmo sem extensão e sem content-type', () => {
    const url = new URL('https://cdn.exemplo.com/entrega/9f3a?token=abc');
    expect(reconhecerFormato(url, '', bytesDeMp4())).toEqual({ formato: 'MP4', origem: 'BYTES' });
  });

  it('reconhece HTML mesmo quando o endereço termina em .mp4', () => {
    const url = new URL('https://exemplo.com/episodio.mp4');
    const pagina = Buffer.from('<!DOCTYPE html><html><head><title>Entrar</title>', 'utf8');
    expect(reconhecerFormato(url, 'video/mp4', pagina).formato).toBe('HTML');
  });

  it('reconhece playlist HLS pela primeira linha', () => {
    const url = new URL('https://exemplo.com/mestre');
    const playlist = Buffer.from('#EXTM3U\n#EXT-X-VERSION:3\n', 'utf8');
    expect(reconhecerFormato(url, 'text/plain', playlist).formato).toBe('HLS');
  });

  it('reconhece Matroska pelo cabeçalho EBML', () => {
    const url = new URL('https://exemplo.com/a');
    expect(reconhecerFormato(url, '', bytesDeMatroska()).formato).toBe('MATROSKA');
  });

  it('só reconhece MPEG-TS com os três marcos de sincronismo', () => {
    const url = new URL('https://exemplo.com/a');
    expect(reconhecerFormato(url, '', bytesDeTs()).formato).toBe('MPEG_TS');
    const soltoNoComeco = Buffer.alloc(377);
    soltoNoComeco[0] = 0x47;
    expect(reconhecerFormato(url, '', soltoNoComeco).formato).not.toBe('MPEG_TS');
  });

  it('cai para o content-type quando não há bytes', () => {
    const url = new URL('https://exemplo.com/sem-pista');
    expect(reconhecerFormato(url, 'video/webm', NADA)).toEqual({
      formato: 'VAZIO',
      origem: 'BYTES'
    });
    expect(reconhecerFormato(url, 'application/x-mpegURL', Buffer.from('  '))).toEqual({
      formato: 'HLS',
      origem: 'TIPO'
    });
  });

  it('usa a extensão apenas como último recurso', () => {
    const url = new URL('https://exemplo.com/video.webm');
    const resultado = reconhecerFormato(url, 'application/octet-stream', Buffer.from('xyz'));
    expect(resultado).toEqual({ formato: 'MATROSKA', origem: 'CAMINHO' });
  });

  it('desiste quando nenhum dos três sinais diz nada', () => {
    const url = new URL('https://exemplo.com/coisa');
    expect(reconhecerFormato(url, '', Buffer.from('qualquer coisa')).formato).toBe('DESCONHECIDO');
  });
});

describe('extensaoDoCaminho', () => {
  it('ignora ponto que está antes da última barra', () => {
    expect(extensaoDoCaminho(new URL('https://ex.com/v1.2/arquivo'))).toBe('');
    expect(extensaoDoCaminho(new URL('https://ex.com/v1.2/arquivo.mp4'))).toBe('.mp4');
  });

  it('não se confunde com query string', () => {
    expect(extensaoDoCaminho(new URL('https://ex.com/a.m3u8?x=.mp4'))).toBe('.m3u8');
  });
});

describe('pareceTemporario', () => {
  it('reconhece endereço assinado da Amazon e do Google', () => {
    expect(
      pareceTemporario(new URL('https://ex.com/a.mp4?X-Amz-Expires=900&X-Amz-Signature=x'))
    ).toBe(true);
    expect(pareceTemporario(new URL('https://ex.com/a.mp4?x-goog-expires=600'))).toBe(true);
  });

  it('não marca endereço comum como temporário', () => {
    expect(pareceTemporario(new URL('https://ex.com/a.mp4?legenda=pt'))).toBe(false);
  });
});
