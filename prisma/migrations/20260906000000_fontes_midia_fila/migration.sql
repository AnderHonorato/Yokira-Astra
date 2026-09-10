ALTER TABLE "TrabalhoProcessamento" ADD COLUMN "tentativas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TrabalhoProcessamento" ADD COLUMN "leaseAte" DATETIME;
ALTER TABLE "TrabalhoProcessamento" ADD COLUMN "executor" TEXT;

CREATE TABLE "FonteMidia" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "episodioId" TEXT NOT NULL,
 "arquivoId" TEXT,
 "tipo" TEXT NOT NULL,
 "url" TEXT,
 "embedId" TEXT,
 "mime" TEXT,
 "estado" TEXT NOT NULL DEFAULT 'PENDENTE',
 "ativa" BOOLEAN NOT NULL DEFAULT false,
 "temporaria" BOOLEAN NOT NULL DEFAULT false,
 "aviso" TEXT,
 "chaveIdempotencia" TEXT NOT NULL,
 "assinaturaPedido" TEXT NOT NULL,
 "verificadaEm" DATETIME,
 "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "atualizadaEm" DATETIME NOT NULL,
 FOREIGN KEY ("episodioId") REFERENCES "Episodio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("arquivoId") REFERENCES "ArquivoMidia"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FonteMidia_arquivoId_key" ON "FonteMidia"("arquivoId");
CREATE UNIQUE INDEX "FonteMidia_chaveIdempotencia_key" ON "FonteMidia"("chaveIdempotencia");
CREATE INDEX "FonteMidia_episodioId_ativa_idx" ON "FonteMidia"("episodioId", "ativa");
CREATE UNIQUE INDEX "FonteMidia_uma_ativa_por_episodio" ON "FonteMidia"("episodioId") WHERE "ativa" = 1;

-- Catálogo e variantes existentes permanecem intactos. Migração aditiva e
-- determinística: só o arquivo pronto mais recente é inicialmente ativo.
INSERT INTO "FonteMidia" ("id", "episodioId", "arquivoId", "tipo", "estado", "ativa", "chaveIdempotencia", "assinaturaPedido", "criadaEm", "atualizadaEm")
SELECT 'legado-' || a."id", a."episodioId", a."id", 'HLS_LOCAL', 'PRONTO',
 CASE WHEN a."id" = (SELECT b."id" FROM "ArquivoMidia" b WHERE b."episodioId" = a."episodioId" AND EXISTS (SELECT 1 FROM "VarianteHls" v WHERE v."arquivoId" = b."id") ORDER BY b."criadoEm" DESC, b."id" DESC LIMIT 1) THEN 1 ELSE 0 END,
 'legado-' || a."id", 'legado', a."criadoEm", CURRENT_TIMESTAMP
FROM "ArquivoMidia" a WHERE EXISTS (SELECT 1 FROM "VarianteHls" v WHERE v."arquivoId" = a."id");
