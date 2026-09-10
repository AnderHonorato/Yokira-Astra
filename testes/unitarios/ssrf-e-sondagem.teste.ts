// Arquivo: testes/unitarios/ssrf-e-sondagem.teste.ts
// A verificação de link faz o SERVIDOR abrir conexão para um endereço que veio de fora.
// Sem guarda, isso é uma ponte para dentro da própria infraestrutura: bastaria colar
// http://169.254.169.254/ para o painel buscar as credenciais da máquina.
//
// A parte de resolver nome usa o DNS de verdade, mas só com nomes que resolvem sem sair
// da máquina (localhost, IP literal). Nenhum teste aqui depende de internet.

import { describe, expect, it } from 'vitest';
import {
  ErroDeFonte,
  resolverEnderecoPublico
} from '../../src/lib/servidor/midia/fontes/conexao-segura';
import { lerEndereco, sondar } from '../../src/lib/servidor/midia/fontes/sondar-url';
import type { RespostaAberta } from '../../src/lib/servidor/midia/fontes/amostrar-resposta';

describe('resolverEnderecoPublico', () => {
  it('recusa esquema que não é http nem https', async () => {
    await expect(resolverEnderecoPublico(new URL('file:///etc/passwd'))).rejects.toThrow(
      ErroDeFonte
    );
    await expect(resolverEnderecoPublico(new URL('gopher://exemplo.com/'))).rejects.toThrow(
      ErroDeFonte
    );
  });

  it('recusa loopback pelo nome e pelo número', async () => {
    await expect(resolverEnderecoPublico(new URL('http://localhost:8080/x'))).rejects.toThrow(
      /rede interna/
    );
    await expect(resolverEnderecoPublico(new URL('http://127.0.0.1/x'))).rejects.toThrow(
      /rede interna/
    );
    await expect(resolverEnderecoPublico(new URL('http://[::1]/x'))).rejects.toThrow(
      /rede interna/
    );
  });

  it('recusa o endereço de metadados de nuvem e as faixas privadas', async () => {
    const internos = [
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5/',
      'http://192.168.1.1/',
      'http://172.16.4.4/',
      'http://[fd00::1]/'
    ];
    for (const endereco of internos) {
      await expect(resolverEnderecoPublico(new URL(endereco)), endereco).rejects.toThrow(
        /rede interna/
      );
    }
  });

  it('recusa IPv4 disfarçado dentro de IPv6', async () => {
    await expect(resolverEnderecoPublico(new URL('http://[::ffff:127.0.0.1]/'))).rejects.toThrow(
      /rede interna/
    );
  });
});

describe('lerEndereco', () => {
  it('recusa texto que não é endereço', () => {
    expect(() => lerEndereco('só um texto')).toThrow(ErroDeFonte);
    expect(() => lerEndereco('javascript:alert(1)')).toThrow(ErroDeFonte);
  });

  it('aceita endereço com query string e sem extensão', () => {
    expect(lerEndereco('https://ex.com/a?b=1').toString()).toBe('https://ex.com/a?b=1');
  });
});

/** Transporte de teste que anota cada endereço pedido. */
function transporteQueAnota(respostas: Record<string, Partial<RespostaAberta>>) {
  const pedidos: string[] = [];
  const transporte = async (url: URL): Promise<RespostaAberta> => {
    pedidos.push(url.toString());
    const base = respostas[url.toString()] ?? respostas['*'] ?? {};
    return {
      status: base.status ?? 200,
      cabecalhos: base.cabecalhos ?? {},
      destino: base.destino ?? null,
      amostra: base.amostra ?? Buffer.alloc(0),
      truncada: base.truncada ?? false
    };
  };
  return { transporte, pedidos };
}

describe('sondar', () => {
  it('segue o redirecionamento e volta a validar cada salto', async () => {
    const { transporte, pedidos } = transporteQueAnota({
      'https://a.exemplo.com/v': { status: 302, destino: 'https://b.exemplo.com/v' },
      'https://b.exemplo.com/v': { status: 200, amostra: Buffer.from('ok') }
    });

    const resultado = await sondar('https://a.exemplo.com/v', { transporte });
    expect(resultado.urlFinal.toString()).toBe('https://b.exemplo.com/v');
    expect(resultado.saltos).toBe(1);
    // Cada endereço passou pelo transporte, que é onde a validação acontece de verdade.
    expect(pedidos).toContain('https://b.exemplo.com/v');
  });

  it('resolve redirecionamento relativo contra o endereço atual', async () => {
    const { transporte } = transporteQueAnota({
      'https://a.exemplo.com/pasta/v': { status: 301, destino: '../outro' },
      'https://a.exemplo.com/outro': { status: 200, amostra: Buffer.from('ok') }
    });

    const resultado = await sondar('https://a.exemplo.com/pasta/v', { transporte });
    expect(resultado.urlFinal.toString()).toBe('https://a.exemplo.com/outro');
  });

  it('desiste quando o endereço redireciona sem parar', async () => {
    const { transporte } = transporteQueAnota({
      '*': { status: 302, destino: 'https://a.exemplo.com/loop' }
    });
    await expect(
      sondar('https://a.exemplo.com/loop', { transporte, saltosMax: 2 })
    ).rejects.toThrow(/redireciona vezes demais/);
  });

  it('recusa redirecionamento sem destino', async () => {
    const { transporte } = transporteQueAnota({ '*': { status: 302 } });
    await expect(sondar('https://a.exemplo.com/x', { transporte })).rejects.toThrow(/lugar nenhum/);
  });

  it('cai para GET quando o servidor recusa HEAD', async () => {
    const { transporte, pedidos } = transporteQueAnota({
      '*': { status: 200, amostra: Buffer.from('conteudo') }
    });
    const resultado = await sondar('https://a.exemplo.com/x', { transporte });
    // Dois pedidos ao mesmo endereço: o HEAD barato e o GET cortado.
    expect(pedidos.filter((p) => p === 'https://a.exemplo.com/x')).toHaveLength(2);
    expect(resultado.usouGet).toBe(true);
  });
});
