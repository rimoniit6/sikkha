-- AlterTable
ALTER TABLE "BoardYear" ADD COLUMN     "yearId" TEXT;

-- AlterTable
ALTER TABLE "CQ" ADD COLUMN     "yearId" TEXT;

-- AlterTable
ALTER TABLE "ContentBundle" ADD COLUMN     "yearId" TEXT;

-- AlterTable
ALTER TABLE "MCQ" ADD COLUMN     "yearId" TEXT;

-- CreateIndex
CREATE INDEX "BoardYear_yearId_idx" ON "BoardYear"("yearId");

-- CreateIndex
CREATE INDEX "CQ_yearId_idx" ON "CQ"("yearId");

-- CreateIndex
CREATE INDEX "ContentBundle_yearId_idx" ON "ContentBundle"("yearId");

-- CreateIndex
CREATE INDEX "MCQ_yearId_idx" ON "MCQ"("yearId");

-- AddForeignKey
ALTER TABLE "MCQ" ADD CONSTRAINT "MCQ_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "ExamYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CQ" ADD CONSTRAINT "CQ_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "ExamYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardYear" ADD CONSTRAINT "BoardYear_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "ExamYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBundle" ADD CONSTRAINT "ContentBundle_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "ExamYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
