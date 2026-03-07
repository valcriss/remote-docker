-- AlterTable
ALTER TABLE "PortForward" ADD COLUMN "instanceId" TEXT;

-- AddForeignKey
ALTER TABLE "PortForward" ADD CONSTRAINT "PortForward_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "UserInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
