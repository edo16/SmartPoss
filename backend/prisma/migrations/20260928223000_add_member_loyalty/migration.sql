-- CreateEnum
CREATE TYPE "PointTransactionType" AS ENUM (
    'EARN',
    'REDEEM',
    'ADJUSTMENT'
);

-- Add memberCode as nullable first
ALTER TABLE "Customer"
ADD COLUMN "memberCode" TEXT;

-- Generate member codes for existing customers
WITH numbered_customers AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY "storeId"
            ORDER BY "createdAt", id
        ) AS row_number
    FROM "Customer"
)
UPDATE "Customer" c
SET "memberCode" =
    'MBR-' || LPAD(n.row_number::TEXT, 6, '0')
FROM numbered_customers n
WHERE c.id = n.id;

-- Make memberCode required
ALTER TABLE "Customer"
ALTER COLUMN "memberCode" SET NOT NULL;

-- Create PointHistory
CREATE TABLE "PointHistory" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "PointTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointHistory_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "PointHistory_customerId_idx"
ON "PointHistory"("customerId");

CREATE INDEX "PointHistory_orderId_idx"
ON "PointHistory"("orderId");

CREATE INDEX "PointHistory_type_idx"
ON "PointHistory"("type");

CREATE INDEX "PointHistory_createdAt_idx"
ON "PointHistory"("createdAt");

-- Unique member code per store
CREATE UNIQUE INDEX "Customer_storeId_memberCode_key"
ON "Customer"("storeId", "memberCode");

-- Foreign keys
ALTER TABLE "PointHistory"
ADD CONSTRAINT "PointHistory_customerId_fkey"
FOREIGN KEY ("customerId")
REFERENCES "Customer"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "PointHistory"
ADD CONSTRAINT "PointHistory_orderId_fkey"
FOREIGN KEY ("orderId")
REFERENCES "Order"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;