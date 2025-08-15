-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "discordWebhookUrl" TEXT;

-- AlterTable
ALTER TABLE "boards" ADD COLUMN     "sendDiscordUpdates" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "discordMessageId" TEXT;

-- AlterTable
ALTER TABLE "checklist_items" ADD COLUMN     "discordMessageId" TEXT;