-- DropForeignKey
ALTER TABLE "AdminActivityLog" DROP CONSTRAINT "AdminActivityLog_actorId_fkey";

-- AlterTable
ALTER TABLE "AdminActivityLog" ALTER COLUMN "actorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "AdminActivityLog" ADD CONSTRAINT "AdminActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
