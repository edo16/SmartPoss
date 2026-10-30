-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM (
  'PENDING',
  'COMPLETED',
  'CANCELLED'
);

-- CreateTable
CREATE TABLE "Refund" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "confirmedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),

  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");
CREATE INDEX "Refund_status_idx" ON "Refund"("status");
CREATE INDEX "Refund_createdAt_idx" ON "Refund"("createdAt");
CREATE INDEX "Refund_requestedById_idx" ON "Refund"("requestedById");
CREATE INDEX "Refund_confirmedById_idx" ON "Refund"("confirmedById");

-- AddForeignKey
ALTER TABLE "Refund"
ADD CONSTRAINT "Refund_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Refund"
ADD CONSTRAINT "Refund_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Refund"
ADD CONSTRAINT "Refund_confirmedById_fkey"
FOREIGN KEY ("confirmedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
