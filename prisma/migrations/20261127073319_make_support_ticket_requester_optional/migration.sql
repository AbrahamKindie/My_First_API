-- AlterEnum
ALTER TYPE "SupportTicketStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionDescription" TEXT,
ADD COLUMN     "resolutionSummary" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3);
