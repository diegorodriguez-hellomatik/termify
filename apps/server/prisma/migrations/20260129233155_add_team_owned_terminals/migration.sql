-- AlterTable
ALTER TABLE "terminals" ADD COLUMN     "team_id" TEXT;

-- CreateIndex
CREATE INDEX "terminals_team_id_idx" ON "terminals"("team_id");

-- AddForeignKey
ALTER TABLE "terminals" ADD CONSTRAINT "terminals_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
