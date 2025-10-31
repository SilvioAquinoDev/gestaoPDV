/*
  Warnings:

  - The `status` column on the `caixa_abertura` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `tipo_pagamento` column on the `vendas` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CaixaStatus" AS ENUM ('ABERTO', 'FECHADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoPagamento" AS ENUM ('DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'OUTRO', 'PENDENTE');

-- AlterTable
ALTER TABLE "caixa_abertura" DROP COLUMN "status",
ADD COLUMN     "status" "CaixaStatus" NOT NULL DEFAULT 'ABERTO';

-- AlterTable
ALTER TABLE "configuracoes" ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'string';

-- AlterTable
ALTER TABLE "vendas" DROP COLUMN "tipo_pagamento",
ADD COLUMN     "tipo_pagamento" "TipoPagamento" NOT NULL DEFAULT 'DINHEIRO';

-- AlterTable
ALTER TABLE "webhook_logs" ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "user_agent" TEXT;

-- CreateIndex
CREATE INDEX "caixa_abertura_status_idx" ON "caixa_abertura"("status");

-- CreateIndex
CREATE INDEX "caixa_abertura_data_abertura_idx" ON "caixa_abertura"("data_abertura");

-- CreateIndex
CREATE INDEX "caixa_fechamento_data_fechamento_idx" ON "caixa_fechamento"("data_fechamento");

-- CreateIndex
CREATE INDEX "caixa_fechamento_caixa_abertura_id_idx" ON "caixa_fechamento"("caixa_abertura_id");

-- CreateIndex
CREATE INDEX "retiradas_data_retirada_idx" ON "retiradas"("data_retirada");

-- CreateIndex
CREATE INDEX "retiradas_caixa_abertura_id_idx" ON "retiradas"("caixa_abertura_id");

-- CreateIndex
CREATE INDEX "vendas_data_venda_idx" ON "vendas"("data_venda");

-- CreateIndex
CREATE INDEX "vendas_tipo_pagamento_idx" ON "vendas"("tipo_pagamento");

-- CreateIndex
CREATE INDEX "vendas_caixa_abertura_id_idx" ON "vendas"("caixa_abertura_id");

-- CreateIndex
CREATE INDEX "webhook_logs_created_at_idx" ON "webhook_logs"("created_at");
