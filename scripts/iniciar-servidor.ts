// Arquivo: scripts/iniciar-servidor.ts
// Sobe o build de produção na porta desta cópia. O adapter-node sozinho usaria 3000, que
// é justamente a porta que costuma estar ocupada por outro projeto. Também carrega o
// .env — `node build/index.js` puro não lê arquivo nenhum.
//
// Antes de subir, anota qual processo é este: é o que permite ao `npm run encerrar`
// derrubar o servidor certo em vez de matar quem estiver na porta.

import 'dotenv/config';
import { anotarServidor, apagarRegistro } from './registro-do-servidor.js';

process.env.PORT ??= '4107';
process.env.HOST ??= '127.0.0.1';
process.env.ORIGIN ??= `http://localhost:${process.env.PORT}`;

await anotarServidor(Number(process.env.PORT));

// Saída limpa também apaga a anotação: registro apontando para processo morto faria o
// `encerrar` da próxima vez achar que havia algo no ar.
const limpar = () => {
  void apagarRegistro();
};
process.on('exit', limpar);
process.on('SIGINT', () => {
  limpar();
  process.exit(0);
});
process.on('SIGTERM', () => {
  limpar();
  process.exit(0);
});

console.log(`Yokira Animes em http://localhost:${process.env.PORT}`);
console.log('Para encerrar: Ctrl+C nesta janela, ou `npm run encerrar` em outra.');

await import('../build/index.js');
