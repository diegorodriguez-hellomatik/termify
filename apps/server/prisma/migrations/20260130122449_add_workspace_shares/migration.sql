-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'WORKSPACE_SHARED';
ALTER TYPE "NotificationType" ADD VALUE 'WORKSPACE_SHARE_REVOKED';
ALTER TYPE "NotificationType" ADD VALUE 'WORKSPACE_SHARE_UPDATED';

-- CreateTable
CREATE TABLE "workspace_shares" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "type" "ShareType" NOT NULL,
    "shared_with_id" TEXT,
    "shared_email" TEXT,
    "share_token" TEXT,
    "permission" "SharePermission" NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3),
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_shares_share_token_key" ON "workspace_shares"("share_token");

-- CreateIndex
CREATE INDEX "workspace_shares_workspace_id_idx" ON "workspace_shares"("workspace_id");

-- CreateIndex
CREATE INDEX "workspace_shares_shared_with_id_idx" ON "workspace_shares"("shared_with_id");

-- CreateIndex
CREATE INDEX "workspace_shares_share_token_idx" ON "workspace_shares"("share_token");

-- AddForeignKey
ALTER TABLE "workspace_shares" ADD CONSTRAINT "workspace_shares_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_shares" ADD CONSTRAINT "workspace_shares_shared_with_id_fkey" FOREIGN KEY ("shared_with_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_shares" ADD CONSTRAINT "workspace_shares_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
