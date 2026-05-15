/*
  Warnings:

  - Added the required column `name` to the `dinos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "dinos" ADD COLUMN     "name" VARCHAR(12) NOT NULL;
