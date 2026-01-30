-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "terminal_task_queues" (
    "id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "terminal_task_queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminal_queue_commands" (
    "id" TEXT NOT NULL,
    "queue_id" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "status" "CommandStatus" NOT NULL DEFAULT 'PENDING',
    "position" INTEGER NOT NULL DEFAULT 0,
    "output" TEXT,
    "exit_code" INTEGER,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terminal_queue_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "terminal_task_queues_terminal_id_idx" ON "terminal_task_queues"("terminal_id");

-- CreateIndex
CREATE INDEX "terminal_task_queues_user_id_idx" ON "terminal_task_queues"("user_id");

-- CreateIndex
CREATE INDEX "terminal_task_queues_status_idx" ON "terminal_task_queues"("status");

-- CreateIndex
CREATE INDEX "terminal_queue_commands_queue_id_idx" ON "terminal_queue_commands"("queue_id");

-- CreateIndex
CREATE INDEX "terminal_queue_commands_status_idx" ON "terminal_queue_commands"("status");

-- AddForeignKey
ALTER TABLE "terminal_task_queues" ADD CONSTRAINT "terminal_task_queues_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminal_task_queues" ADD CONSTRAINT "terminal_task_queues_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "terminals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminal_queue_commands" ADD CONSTRAINT "terminal_queue_commands_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "terminal_task_queues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
