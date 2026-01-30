-- AlterTable
ALTER TABLE "personal_tasks" ADD COLUMN     "board_id" TEXT,
ADD COLUMN     "commands" TEXT,
ADD COLUMN     "executed_at" TIMESTAMP(3),
ADD COLUMN     "terminal_queue_id" TEXT;

-- CreateTable
CREATE TABLE "personal_task_boards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_task_boards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_task_boards_user_id_idx" ON "personal_task_boards"("user_id");

-- CreateIndex
CREATE INDEX "personal_tasks_board_id_idx" ON "personal_tasks"("board_id");

-- AddForeignKey
ALTER TABLE "personal_task_boards" ADD CONSTRAINT "personal_task_boards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_tasks" ADD CONSTRAINT "personal_tasks_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "personal_task_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
