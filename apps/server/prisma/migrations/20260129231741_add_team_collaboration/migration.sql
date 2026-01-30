-- CreateEnum
CREATE TYPE "ServerAuthMethod" AS ENUM ('PASSWORD', 'KEY', 'AGENT');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "linked_terminal_id" TEXT,
ADD COLUMN     "terminal_output_snapshot" TEXT;

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "is_team_default" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "team_id" TEXT;

-- CreateTable
CREATE TABLE "team_terminal_shares" (
    "id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'VIEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_terminal_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_snippets" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_snippets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_env_variables" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_env_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_servers" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 22,
    "username" TEXT,
    "authMethod" "ServerAuthMethod" NOT NULL DEFAULT 'PASSWORD',
    "description" TEXT,
    "documentation" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_status" "ServerStatus",
    "last_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_command_history" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "exit_code" INTEGER,
    "duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_command_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_audit_logs" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_notification_prefs" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "terminal_errors" BOOLEAN NOT NULL DEFAULT true,
    "long_commands" BOOLEAN NOT NULL DEFAULT true,
    "long_command_threshold" INTEGER NOT NULL DEFAULT 300,
    "task_mentions" BOOLEAN NOT NULL DEFAULT true,
    "server_status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_notification_prefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaborative_messages" (
    "id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collaborative_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_commands" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "exit_code" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_terminal_shares_terminal_id_idx" ON "team_terminal_shares"("terminal_id");

-- CreateIndex
CREATE INDEX "team_terminal_shares_team_id_idx" ON "team_terminal_shares"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_terminal_shares_terminal_id_team_id_key" ON "team_terminal_shares"("terminal_id", "team_id");

-- CreateIndex
CREATE INDEX "team_snippets_team_id_idx" ON "team_snippets"("team_id");

-- CreateIndex
CREATE INDEX "team_snippets_created_by_id_idx" ON "team_snippets"("created_by_id");

-- CreateIndex
CREATE INDEX "team_snippets_category_idx" ON "team_snippets"("category");

-- CreateIndex
CREATE INDEX "team_env_variables_team_id_idx" ON "team_env_variables"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_env_variables_team_id_name_key" ON "team_env_variables"("team_id", "name");

-- CreateIndex
CREATE INDEX "team_servers_team_id_idx" ON "team_servers"("team_id");

-- CreateIndex
CREATE INDEX "team_servers_created_by_id_idx" ON "team_servers"("created_by_id");

-- CreateIndex
CREATE INDEX "team_command_history_team_id_idx" ON "team_command_history"("team_id");

-- CreateIndex
CREATE INDEX "team_command_history_user_id_idx" ON "team_command_history"("user_id");

-- CreateIndex
CREATE INDEX "team_command_history_terminal_id_idx" ON "team_command_history"("terminal_id");

-- CreateIndex
CREATE INDEX "team_command_history_created_at_idx" ON "team_command_history"("created_at");

-- CreateIndex
CREATE INDEX "team_audit_logs_team_id_idx" ON "team_audit_logs"("team_id");

-- CreateIndex
CREATE INDEX "team_audit_logs_user_id_idx" ON "team_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "team_audit_logs_action_idx" ON "team_audit_logs"("action");

-- CreateIndex
CREATE INDEX "team_audit_logs_created_at_idx" ON "team_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "team_notification_prefs_team_id_idx" ON "team_notification_prefs"("team_id");

-- CreateIndex
CREATE INDEX "team_notification_prefs_user_id_idx" ON "team_notification_prefs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_notification_prefs_team_id_user_id_key" ON "team_notification_prefs"("team_id", "user_id");

-- CreateIndex
CREATE INDEX "collaborative_messages_terminal_id_idx" ON "collaborative_messages"("terminal_id");

-- CreateIndex
CREATE INDEX "collaborative_messages_user_id_idx" ON "collaborative_messages"("user_id");

-- CreateIndex
CREATE INDEX "collaborative_messages_created_at_idx" ON "collaborative_messages"("created_at");

-- CreateIndex
CREATE INDEX "task_commands_task_id_idx" ON "task_commands"("task_id");

-- CreateIndex
CREATE INDEX "task_commands_position_idx" ON "task_commands"("position");

-- CreateIndex
CREATE INDEX "tasks_linked_terminal_id_idx" ON "tasks"("linked_terminal_id");

-- CreateIndex
CREATE INDEX "workspaces_team_id_idx" ON "workspaces"("team_id");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_linked_terminal_id_fkey" FOREIGN KEY ("linked_terminal_id") REFERENCES "terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_terminal_shares" ADD CONSTRAINT "team_terminal_shares_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "terminals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_terminal_shares" ADD CONSTRAINT "team_terminal_shares_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_snippets" ADD CONSTRAINT "team_snippets_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_snippets" ADD CONSTRAINT "team_snippets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_env_variables" ADD CONSTRAINT "team_env_variables_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_servers" ADD CONSTRAINT "team_servers_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_servers" ADD CONSTRAINT "team_servers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_command_history" ADD CONSTRAINT "team_command_history_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_command_history" ADD CONSTRAINT "team_command_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_command_history" ADD CONSTRAINT "team_command_history_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "terminals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_audit_logs" ADD CONSTRAINT "team_audit_logs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_audit_logs" ADD CONSTRAINT "team_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_notification_prefs" ADD CONSTRAINT "team_notification_prefs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_notification_prefs" ADD CONSTRAINT "team_notification_prefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborative_messages" ADD CONSTRAINT "collaborative_messages_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "terminals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborative_messages" ADD CONSTRAINT "collaborative_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_commands" ADD CONSTRAINT "task_commands_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
