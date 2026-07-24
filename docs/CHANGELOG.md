# Changelog

> Version history for শিক্ষা বাংলা.

## [0.2.0] - 2026-07-23

### Added
- Payment system transaction integrity fixes
- Package subscription creation on admin approval
- Shared payment helpers (`resolveContentClassLevel`, `batchResolveContentClassLevels`)
- Access/batch-check content type consistency (short-questions, bundle, package)
- `handleApiError` standardization across all 211 API routes
- Admin auth standardization (`withAdmin`/`withSuperAdmin`)
- Exam results statistics correctness (highestScore now uses percentage)
- Soft-deleted record filtering in exam results
- CQ exam package transaction client fixes (`recalculateSetTotals`, `recalculatePackageTotalSets`)
- Production documentation suite (18 files)

### Fixed
- Payment approval now creates UserSubscription records
- `handleSubscriptionCreation` uses `tx` instead of `db` for transaction atomicity
- `highestScore` statistic now uses `MAX(percentage)` instead of `MAX(score)`
- Soft-deleted exam results no longer counted in statistics
- 27 routes missing `handleApiError` in catch blocks
- 11 routes with orphaned `NextResponse.json` fragments after migration
- 8 routes with broken catch block syntax from partial migration
- Unused `NextResponse` import in bundles route

### Changed
- Admin auth standardized: `requireAdmin` → `withAdmin`, `requireSuperAdmin` → `withSuperAdmin`
- All mutation routes now use `handleApiError` for consistent error responses
- Exam results stats query now filters `deletedAt IS NULL`

## [0.1.0] - 2026-07-14

### Initial Release
- Student platform with MCQ, CQ, lectures, board questions
- Admin panel with full CRUD
- Payment system with manual approval
- Premium packages and bundles
- Course system with lessons and assignments
- Exam system with custom exam creation
- MCQ and CQ exam packages
- Analytics dashboard
- Audit logging
- Blog system
