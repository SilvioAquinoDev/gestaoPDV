/*
  Warnings:

  - The `status` column on the `caixa_abertura` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `tipo_pagamento` column on the `vendas` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropIndex
DROP INDEX "public"."caixa_abertura_data_abertura_idx";

-- DropIndex
DROP INDEX "public"."caixa_abertura_status_idx";

-- DropIndex
DROP INDEX "public"."caixa_fechamento_caixa_abertura_id_idx";

-- DropIndex
DROP INDEX "public"."caixa_fechamento_data_fechamento_idx";

-- DropIndex
DROP INDEX "public"."retiradas_caixa_abertura_id_idx";

-- DropIndex
DROP INDEX "public"."retiradas_data_retirada_idx";

-- DropIndex
DROP INDEX "public"."vendas_caixa_abertura_id_idx";

-- DropIndex
DROP INDEX "public"."vendas_data_venda_idx";

-- DropIndex
DROP INDEX "public"."vendas_tipo_pagamento_idx";

-- DropIndex
DROP INDEX "public"."webhook_logs_created_at_idx";

-- AlterTable
ALTER TABLE "caixa_abertura" DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ABERTO';

-- AlterTable
ALTER TABLE "vendas" DROP COLUMN "tipo_pagamento",
ADD COLUMN     "tipo_pagamento" TEXT NOT NULL DEFAULT 'PENDENTE';

-- DropEnum
DROP TYPE "public"."CaixaStatus";

-- DropEnum
DROP TYPE "public"."TipoPagamento";
