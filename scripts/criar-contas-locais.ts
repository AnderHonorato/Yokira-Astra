// Arquivo: scripts/criar-contas-locais.ts
// Cria (ou reajusta) as duas contas de trabalho desta cópia local. Existe porque o
// banco desta cópia veio do original: as contas de lá continuam válidas, mas a senha
// delas não é a do seed, e sem uma senha conhecida ninguém entra para testar.
//
// Uso: npm run contas:locais

import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { banco } from '../src/lib/servidor/banco/cliente.js';

const PARAMETROS_ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

const CONTAS = [
  {
    email: process.env.ADMIN_LOCAL_EMAIL ?? 'admin@yokira.local',
    senha: process.env.ADMIN_LOCAL_SENHA ?? 'YokiraLocal#2026',
    nome: 'Administrador local',
    papel: 'ADMINISTRADOR' as const
  },
  {
    email: 'espectador@yokira.local',
    senha: 'YokiraLocal#2026',
    nome: 'Espectador local',
    papel: 'ESPECTADOR' as const
  }
];

for (const conta of CONTAS) {
  const senhaHash = await hash(conta.senha, PARAMETROS_ARGON);
  await banco.usuario.upsert({
    where: { email: conta.email },
    create: {
      email: conta.email,
      nome: conta.nome,
      papel: conta.papel,
      emailVerificado: true,
      senhaHash,
      perfis: { create: { apelido: conta.nome } }
    },
    // A senha é reajustada de propósito: o objetivo do script é garantir acesso.
    update: { papel: conta.papel, emailVerificado: true, senhaHash }
  });
  console.log(`${conta.email} pronta (${conta.papel}), senha: ${conta.senha}`);
}

console.log('\nEstas contas valem só nesta cópia local. Não use estas senhas em produção.');
