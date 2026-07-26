-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "category" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'medium';

-- CreateTable
CREATE TABLE "RevisionQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT,
    "topicId" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" INTEGER NOT NULL DEFAULT 50,
    "nextReviewAt" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "route" TEXT NOT NULL,
    "routeParams" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevisionQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RevisionQueue_userId_nextReviewAt_idx" ON "RevisionQueue"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "RevisionQueue_userId_isCompleted_idx" ON "RevisionQueue"("userId", "isCompleted");

-- CreateIndex
CREATE INDEX "RevisionQueue_userId_contentType_idx" ON "RevisionQueue"("userId", "contentType");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionQueue_userId_contentType_contentId_key" ON "RevisionQueue"("userId", "contentType", "contentId");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_unlocked_idx" ON "UserAchievement"("userId", "unlocked");

-- CreateIndex
CREATE INDEX "UserAchievement_achievementId_idx" ON "UserAchievement"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "Bookmark_userId_createdAt_idx" ON "Bookmark"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CQExamSubmission_userId_submittedAt_idx" ON "CQExamSubmission"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "ExamResult_userId_completedAt_idx" ON "ExamResult"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "MCQExamSetResult_userId_submittedAt_idx" ON "MCQExamSetResult"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_category_createdAt_idx" ON "Notification"("userId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Progress_userId_contentType_lastAccessed_idx" ON "Progress"("userId", "contentType", "lastAccessed");

-- CreateIndex
CREATE INDEX "Progress_userId_lastAccessed_idx" ON "Progress"("userId", "lastAccessed");

-- CreateIndex
CREATE INDEX "RecentlyViewed_userId_contentType_viewedAt_idx" ON "RecentlyViewed"("userId", "contentType", "viewedAt");

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
