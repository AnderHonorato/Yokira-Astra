-- Contadores denormalizados. As telas de catálogo mostram visualizações e curtidas em
-- cada cartão; contar linha a linha a cada renderização de trilha seria uma varredura
-- por cartão. O total fica aqui e é somado na mesma transação do evento.
ALTER TABLE "Titulo" ADD COLUMN "visualizacoes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Titulo" ADD COLUMN "curtidas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Episodio" ADD COLUMN "visualizacoes" INTEGER NOT NULL DEFAULT 0;

-- Marca de quem já viu a mensagem de boas-vindas. Nulo = ainda não viu.
ALTER TABLE "Usuario" ADD COLUMN "boasVindasEm" DATETIME;

-- Visualizacao ganha o título direto e o usuário. O título evita a junção por
-- Episodio -> Temporada -> Titulo no cálculo do "em alta"; o usuário permite não contar
-- a mesma pessoa duas vezes no mesmo episódio dentro da janela.
-- A tabela é recriada porque estava vazia: nunca recebeu uma linha desde que foi criada.
DROP TABLE IF EXISTS "Visualizacao";
CREATE TABLE "Visualizacao" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "episodioId" TEXT NOT NULL,
 "tituloId" TEXT NOT NULL,
 "usuarioId" TEXT,
 "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("episodioId") REFERENCES "Episodio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Visualizacao_episodioId_criadoEm_idx" ON "Visualizacao"("episodioId", "criadoEm");
CREATE INDEX "Visualizacao_tituloId_criadoEm_idx" ON "Visualizacao"("tituloId", "criadoEm");
CREATE INDEX "Visualizacao_criadoEm_idx" ON "Visualizacao"("criadoEm");
CREATE INDEX "Visualizacao_usuarioId_episodioId_criadoEm_idx" ON "Visualizacao"("usuarioId", "episodioId", "criadoEm");

-- Faixa editável da home. É uma tabela, e não texto no código, porque o pedido é
-- justamente poder trocar a mensagem pelo painel sem publicar versão nova.
CREATE TABLE "FaixaPromocional" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "chave" TEXT NOT NULL,
 "ativa" BOOLEAN NOT NULL DEFAULT false,
 "titulo" TEXT NOT NULL DEFAULT '',
 "texto" TEXT NOT NULL DEFAULT '',
 "rotuloBotao" TEXT,
 "destino" TEXT,
 "corInicial" TEXT NOT NULL DEFAULT '#7C3AED',
 "corFinal" TEXT NOT NULL DEFAULT '#2563EB',
 "atualizadaEm" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "FaixaPromocional_chave_key" ON "FaixaPromocional"("chave");

-- As duas faixas nascem desligadas: nada aparece na home antes de alguém escrever o
-- texto e ligar no painel.
INSERT INTO "FaixaPromocional" ("id", "chave", "ativa", "titulo", "texto", "atualizadaEm")
VALUES
 ('faixa-home', 'home', 0, '', '', CURRENT_TIMESTAMP),
 ('faixa-boas-vindas', 'boas-vindas', 0, '', '', CURRENT_TIMESTAMP);

-- Curtidas já existentes viram contador: curtir é avaliação nota 10.
UPDATE "Titulo" SET "curtidas" = (
 SELECT COUNT(*) FROM "Avaliacao" a WHERE a."tituloId" = "Titulo"."id" AND a."nota" = 10
);
