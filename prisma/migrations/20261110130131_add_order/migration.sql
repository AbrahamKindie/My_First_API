-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY', 'CHAPA');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH_ON_DELIVERY',
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "shippingAddress" TEXT,
ADD COLUMN     "shippingCity" TEXT,
ADD COLUMN     "shippingCountry" TEXT,
ADD COLUMN     "shippingName" TEXT,
ADD COLUMN     "shippingPhone" TEXT;

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "Order_paymentMethod_idx" ON "Order"("paymentMethod");
