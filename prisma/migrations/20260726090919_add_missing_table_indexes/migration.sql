-- CreateIndex
CREATE INDEX "ContactMessage_isRead_createdAt_idx" ON "ContactMessage"("isRead", "createdAt");

-- CreateIndex
CREATE INDEX "ContentBundle_isActive_deletedAt_idx" ON "ContentBundle"("isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "ContentPackage_isActive_deletedAt_idx" ON "ContentPackage"("isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "Navigation_location_isActive_idx" ON "Navigation"("location", "isActive");

-- CreateIndex
CREATE INDEX "Testimonial_isActive_order_idx" ON "Testimonial"("isActive", "order");
