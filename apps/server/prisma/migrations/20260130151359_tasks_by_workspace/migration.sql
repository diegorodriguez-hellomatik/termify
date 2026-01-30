-- Migration: Tasks by Workspace
-- This migration replaces boardId with workspaceId in personal_tasks table
-- and drops the personal_task_boards table

-- Step 1: Add workspace_id column to personal_tasks
ALTER TABLE "personal_tasks" ADD COLUMN "workspace_id" TEXT;

-- Step 2: Create index on workspace_id
CREATE INDEX "personal_tasks_workspace_id_idx" ON "personal_tasks"("workspace_id");

-- Step 3: Add foreign key constraint to workspaces table
ALTER TABLE "personal_tasks" ADD CONSTRAINT "personal_tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 4: Drop old board_id foreign key constraint (if exists)
ALTER TABLE "personal_tasks" DROP CONSTRAINT IF EXISTS "personal_tasks_board_id_fkey";

-- Step 5: Drop old board_id index (if exists)
DROP INDEX IF EXISTS "personal_tasks_board_id_idx";

-- Step 6: Drop board_id column from personal_tasks
ALTER TABLE "personal_tasks" DROP COLUMN IF EXISTS "board_id";

-- Step 7: Drop personal_task_boards table
DROP TABLE IF EXISTS "personal_task_boards";
