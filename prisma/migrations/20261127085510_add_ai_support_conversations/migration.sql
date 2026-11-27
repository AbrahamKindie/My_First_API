-- CreateEnum
CREATE TYPE "AiSupportConversationStatus" AS ENUM ('ACTIVE', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AiSupportMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "AiSupportConversation" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "guestTokenHash" TEXT,
    "guestTokenExpiresAt" TIMESTAMP(3),
    "title" TEXT,
    "status" "AiSupportConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "supportTicketId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSupportConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSupportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AiSupportMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiSupportConversation_guestTokenHash_key" ON "AiSupportConversation"("guestTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AiSupportConversation_supportTicketId_key" ON "AiSupportConversation"("supportTicketId");

-- CreateIndex
CREATE INDEX "AiSupportConversation_userId_updatedAt_idx" ON "AiSupportConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AiSupportConversation_status_updatedAt_idx" ON "AiSupportConversation"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "AiSupportConversation_guestTokenExpiresAt_idx" ON "AiSupportConversation"("guestTokenExpiresAt");

-- CreateIndex
CREATE INDEX "AiSupportMessage_conversationId_createdAt_idx" ON "AiSupportMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiSupportConversation" ADD CONSTRAINT "AiSupportConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSupportConversation" ADD CONSTRAINT "AiSupportConversation_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES "SupportTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSupportMessage" ADD CONSTRAINT "AiSupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiSupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
