-- AlterTable: add soft delete support to profiles (consistent with User, Post, Comment)
ALTER TABLE "profiles" ADD COLUMN "deletedAt" TIMESTAMP(3);
