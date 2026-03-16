-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Nieuw gesprek',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Eén "Eerste gesprek" per profiel dat berichten heeft
INSERT INTO "Conversation" ("id", "profileId", "title", "createdAt")
SELECT 'legacy_' || "profileId", "profileId", 'Eerste gesprek', MIN("createdAt")
FROM "ConversationMessage"
GROUP BY "profileId";

-- RedefineTables: ConversationMessage met conversationId
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ConversationMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    CONSTRAINT "ConversationMessage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ConversationMessage" ("id", "role", "content", "createdAt", "profileId", "conversationId")
SELECT "id", "role", "content", "createdAt", "profileId", 'legacy_' || "profileId" FROM "ConversationMessage";
DROP TABLE "ConversationMessage";
ALTER TABLE "new_ConversationMessage" RENAME TO "ConversationMessage";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
