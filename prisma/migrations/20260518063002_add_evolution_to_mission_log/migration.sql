/*
  Warnings:

  - Added the required column `stageAfter` to the `mission_logs` table without a default value. This is not possible if the table is not empty.
  - Made the column `stageBefore` on table `mission_logs` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "mission_logs" ADD COLUMN     "stageAfter" "DinoStage" NOT NULL,
ALTER COLUMN "stageBefore" SET NOT NULL;
