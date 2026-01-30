-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "custom_role_id" TEXT;

-- CreateTable
CREATE TABLE "team_custom_roles" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_custom_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_custom_roles_team_id_idx" ON "team_custom_roles"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_custom_roles_team_id_name_key" ON "team_custom_roles"("team_id", "name");

-- CreateIndex
CREATE INDEX "team_members_custom_role_id_idx" ON "team_members"("custom_role_id");

-- AddForeignKey
ALTER TABLE "team_custom_roles" ADD CONSTRAINT "team_custom_roles_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_custom_role_id_fkey" FOREIGN KEY ("custom_role_id") REFERENCES "team_custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
