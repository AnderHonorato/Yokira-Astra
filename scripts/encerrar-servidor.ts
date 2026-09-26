// Arquivo: scripts/encerrar-servidor.ts
// Derruba o servidor DESTE projeto, e só ele. Uso: npm run encerrar
//
// O jeito antigo era perguntar ao sistema quem estava na porta e matar. Isso nunca
// funcionou no Windows — `lsof` e `fuser` não existem lá — e, onde funcionava, matava o
// que estivesse na porta, mesmo sendo outro projeto que chegou primeiro. Agora o
// `iniciar` deixa anotado quem ele é, e aqui derrubamos exatamente esse processo.

import 'dotenv/config';
import { apagarRegistro, lerRegistro, processoVivo } from './registro-do-servidor.js';

const registro = await lerRegistro();

if (!registro) {
  console.log('Nenhum servidor deste projeto está anotado como no ar.');
  console.log('Se a porta estiver ocupada, o processo é de outra coisa — não encerro por palpite.');
  process.exit(0);
}

if (!processoVivo(registro.pid)) {
  console.log(`O processo ${registro.pid} já não existe. Limpando a anotação.`);
  await apagarRegistro();
  process.exit(0);
}

try {
  process.kill(registro.pid, 'SIGTERM');
  console.log(`Servidor encerrado (processo ${registro.pid}, porta ${registro.porta}).`);
  await apagarRegistro();
} catch (erro) {
  const motivo = erro instanceof Error ? erro.message : String(erro);
  console.error(`Não consegui encerrar o processo ${registro.pid}: ${motivo}`);
  process.exit(1);
}
