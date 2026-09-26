// Arquivo: testes/unitarios/provedores-e-playlist.teste.ts
// Duas peças puras que decidem coisas com consequência: qual id de vídeo sai de uma
// página de provedor (e vira iframe) e o que uma playlist remota realmente contém.
//
// O id importa porque ele é remontado em endereço de iframe. Aceitar um id qualquer seria
// aceitar endereço de fora — por isso o formato é conferido por expressão própria.

import { describe, expect, it } from 'vitest';
import {
  incorporacaoGravada,
  nomeDoProvedor,
  reconhecerProvedor
} from '../../src/lib/servidor/midia/fontes/provedores';
import {
  alturasDisponiveis,
  ErroDePlaylist,
  lerPlaylist,
  varianteMaisLeve
} from '../../src/lib/servidor/midia/fontes/hls-remoto';

describe('reconhecerProvedor', () => {
  it('extrai o id do YouTube em todas as formas de endereço', () => {
    const formas = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ'
    ];
    for (const forma of formas) {
      const achado = reconhecerProvedor(new URL(forma));
      expect(achado?.provedor, forma).toBe('YOUTUBE');
      expect(achado?.embedId, forma).toBe('dQw4w9WgXcQ');
    }
  });

  it('monta o endereço de incorporação no domínio sem cookie', () => {
    const achado = reconhecerProvedor(new URL('https://youtu.be/dQw4w9WgXcQ'));
    expect(achado?.url.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(true);
    expect(achado?.origem).toBe('https://www.youtube-nocookie.com');
  });

  it('extrai o id do Vimeo, inclusive dentro de canal', () => {
    expect(reconhecerProvedor(new URL('https://vimeo.com/123456789'))?.embedId).toBe('123456789');
    expect(reconhecerProvedor(new URL('https://vimeo.com/channels/arte/123456789'))?.embedId).toBe(
      '123456789'
    );
    expect(reconhecerProvedor(new URL('https://player.vimeo.com/video/123456789'))?.embedId).toBe(
      '123456789'
    );
  });

  it('recusa endereço que não é de provedor suportado', () => {
    expect(reconhecerProvedor(new URL('https://exemplo.com/video.mp4'))).toBeNull();
    expect(reconhecerProvedor(new URL('https://vimeo.com/sobre'))).toBeNull();
    expect(reconhecerProvedor(new URL('https://www.youtube.com/watch?v=curto'))).toBeNull();
  });

  it('recusa id fora do formato ao remontar do banco', () => {
    // Um registro adulterado não pode virar endereço de iframe.
    expect(incorporacaoGravada('YOUTUBE', '../../evil')).toBeNull();
    expect(incorporacaoGravada('VIMEO', '1')).toBeNull();
    expect(incorporacaoGravada('YOUTUBE', 'dQw4w9WgXcQ')).not.toBeNull();
  });

  it('dá nome ao provedor para a interface', () => {
    expect(nomeDoProvedor('YOUTUBE')).toBe('YouTube');
    expect(nomeDoProvedor('VIMEO')).toBe('Vimeo');
  });
});

const BASE = new URL('https://cdn.exemplo.com/serie/temporada1/mestre.m3u8');

describe('lerPlaylist', () => {
  it('lê playlist mestre e resolve endereço relativo contra a própria playlist', () => {
    const texto = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,CODECS="avc1.64001f,mp4a.40.2"',
      '360p.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720',
      '../alternativa/720p.m3u8'
    ].join('\n');

    const lida = lerPlaylist(texto, BASE);
    expect(lida.tipo).toBe('MESTRE');
    expect(lida.variantes[0].url).toBe('https://cdn.exemplo.com/serie/temporada1/360p.m3u8');
    expect(lida.variantes[1].url).toBe('https://cdn.exemplo.com/serie/alternativa/720p.m3u8');
    expect(lida.variantes[0].codecs).toEqual(['avc1.64001f', 'mp4a.40.2']);
    expect(alturasDisponiveis(lida)).toEqual([720, 360]);
    expect(varianteMaisLeve(lida)?.taxaBits).toBe(800000);
  });

  it('lê playlist de mídia contando os trechos', () => {
    const texto = ['#EXTM3U', '#EXTINF:6.0,', 'a.ts', '#EXTINF:6.0,', 'b.ts'].join('\n');
    const lida = lerPlaylist(texto, BASE);
    expect(lida.tipo).toBe('MIDIA');
    expect(lida.segmentos).toBe(2);
  });

  it('avisa quando a playlist declara criptografia', () => {
    const texto = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="https://chave.exemplo.com/k"',
      '#EXTINF:6.0,',
      'a.ts'
    ].join('\n');
    expect(lerPlaylist(texto, BASE).temCriptografia).toBe(true);
  });

  it('não confunde METHOD=NONE com criptografia', () => {
    const texto = ['#EXTM3U', '#EXT-X-KEY:METHOD=NONE', '#EXTINF:6.0,', 'a.ts'].join('\n');
    expect(lerPlaylist(texto, BASE).temCriptografia).toBe(false);
  });

  it('recusa texto que não é playlist', () => {
    expect(() => lerPlaylist('<html><body>oi</body></html>', BASE)).toThrow(ErroDePlaylist);
  });

  it('recusa playlist sem qualidade e sem trecho nenhum', () => {
    expect(() => lerPlaylist('#EXTM3U\n#EXT-X-VERSION:3\n', BASE)).toThrow(ErroDePlaylist);
  });
});
