'use client'

import {
AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,
AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useHierarchyMetadata } from '@/hooks/use-hierarchy-metadata'
import { AnimatePresence,motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { triggerDownload } from '@/lib/dom-utils'
import { useMCQExamPackages } from './hooks/use-mcq-exam-packages'

// Sub-components
import { BulkCreateSetsDialog } from './components/BulkCreateSetsDialog'
import { BulkUploadDialog } from './components/BulkUploadDialog'
import { ExamResults } from './components/ExamResults'
import { ExamSetForm } from './components/ExamSetForm'
import { Leaderboard } from './components/Leaderboard'
import { MCQRetakeRequests } from './components/MCQRetakeRequests'
import { PackageDetail } from './components/PackageDetail'
import { PackageForm } from './components/PackageForm'
import { PackageList } from './components/PackageList'
import { QuestionManager } from './components/QuestionManager'
import { QuestionSearchDialog } from './components/QuestionSearchDialog'

export default function AdminMCQExamPackagesPage() {
  const { classLevelLabels } = useHierarchyMetadata()
  const {
    viewMode, setViewMode,
    editId, setEditId,
    selectedPackageId, setSelectedPackageId,
    selectedSetId: _selectedSetId, setSelectedSetId,
    deleteTarget, setDeleteTarget,
    loading, saving,
    packages, total,
    currentPackage, setCurrentPackage,
    examSets, currentSet, setCurrentSet: _setCurrentSet,
    setResults,
    classes, subjects, setSubjects: _setSubjects,
    search, setSearch,
    filterClassId, setFilterClassId,
    filterStatus, setFilterStatus,
    pkgTitle, setPkgTitle,
    pkgDescription, setPkgDescription,
    pkgClassId, setPkgClassId,
    pkgSubjectIds, setPkgSubjectIds,
    pkgPrice, setPkgPrice,
    pkgOriginalPrice, setPkgOriginalPrice,
    pkgThumbnail, setPkgThumbnail,
    pkgIsActive, setPkgIsActive,
    pkgIsPremium, setPkgIsPremium,
    pkgOrder, setPkgOrder,
    pkgStatus, setPkgStatus,
    setTitle, setSetTitle,
    setDescription, setSetDescription,
    setScheduledDate, setSetScheduledDate,
    setStartTime, setSetStartTime,
    setEndTime, setSetEndTime,
    setDuration, setSetDuration,
    setMarksPerQ, setSetMarksPerQ,
    setNegativeMarks, setSetNegativeMarks,
    setInstructions, setSetInstructions,
    setAllowRetake, setSetAllowRetake,
    setPracticeMode, setSetPracticeMode,
    setAllowUnlimitedAttempts, setSetAllowUnlimitedAttempts,
    setMaxAttempts, setSetMaxAttempts,
    setReviewAnswers, setSetReviewAnswers,
    setShowExplanations, setSetShowExplanations,
    setShowCorrectAnswers, setSetShowCorrectAnswers,
    setAutoPublishResults, setSetAutoPublishResults,
    setPassMarks, setSetPassMarks,
    setOrder, setSetOrder,
    setStatus, setSetStatus,
    searchDialogOpen, setSearchDialogOpen,
    searchMcqs, setSearchMcqs, searchMcqLoading,
    selectedMcqIds, setSelectedMcqIds,
    searchMcqClassLevel, setSearchMcqClassLevel,
    searchMcqSubjectId, setSearchMcqSubjectId,
    searchMcqChapterId, setSearchMcqChapterId,
    searchMcqText, setSearchMcqText,
    searchMcqSubjects,
    searchMcqChapters,
    resultDetailOpen, setResultDetailOpen,
    selectedResult, setSelectedResult,
    bulkCreateDialogOpen, setBulkCreateDialogOpen,
    bulkPrefix, setBulkPrefix,
    bulkStartDate, setBulkStartDate,
    bulkIntervalDays, setBulkIntervalDays,
    bulkCount, setBulkCount,
    bulkDuration, setBulkDuration,
    bulkMarksPerQ, setBulkMarksPerQ,
    bulkNegativeMarks, setBulkNegativeMarks,
    leaderboardData, leaderboardSetTitle, leaderboardLoading,
    bulkUploadDialogOpen, setBulkUploadDialogOpen,
    bulkUploadFile, setBulkUploadFile,
    bulkUploadLoading, bulkUploadResult,
    bulkUploadSubjectId, setBulkUploadSubjectId,
    bulkUploadSubjects: _bulkUploadSubjects,
    retakeRequests, retakeRequestsLoading,
    fetchPackages: _fetchPackages, fetchPackageDetail, fetchSetDetail, fetchResults,
    fetchSubjectsForClass, fetchSearchMcqSubjects, fetchSearchMcqChapters,
    handleSavePackage, handleSaveSet, handleDelete,
    handleBulkCreateSets, handleSearchMcqs, handleAddMcqs,
    handleRemoveQuestion, handleMoveQuestion, handleBulkUploadMcqs,
    openLeaderboard, togglePackageActive,
    fetchRetakeRequests, handleApproveRetakeRequest
  } = useMCQExamPackages()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <AnimatePresence mode="wait">
        {viewMode === 'list' && (
          <motion.div key="list" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <PackageList
              loading={loading} total={total} packages={packages} classes={classes}
              search={search} setSearch={setSearch} filterClassId={filterClassId} setFilterClassId={setFilterClassId}
              filterStatus={filterStatus} setFilterStatus={setFilterStatus}
              onOpenCreate={() => { setEditId(null); setViewMode('editor'); }}
              onOpenDetail={(pkg) => { setSelectedPackageId(pkg.id); setCurrentPackage(pkg); fetchPackageDetail(pkg.id); setViewMode('detail'); }}
              onToggleActive={togglePackageActive}
              onOpenEdit={(pkg) => {
                setEditId(pkg.id); setPkgTitle(pkg.title); setPkgDescription(pkg.description || '');
                setPkgClassId(pkg.classId); setPkgPrice(String(pkg.price)); setPkgOriginalPrice(String(pkg.originalPrice));
                setPkgThumbnail(pkg.thumbnail || ''); setPkgIsActive(pkg.isActive); setPkgIsPremium(pkg.isPremium ?? true); setPkgOrder(String(pkg.order));
                setPkgStatus(pkg.status); try { setPkgSubjectIds(        pkg.subjectIds || []) } catch { setPkgSubjectIds([]) }
                fetchSubjectsForClass(pkg.classId); setViewMode('editor');
              }}
              onDelete={(id) => setDeleteTarget({ type: 'package', id })}
            />
          </motion.div>
        )}

        {viewMode === 'editor' && (
          <motion.div key="editor" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <PackageForm
              editId={editId} pkgTitle={pkgTitle} setPkgTitle={setPkgTitle} pkgDescription={pkgDescription} setPkgDescription={setPkgDescription}
              pkgThumbnail={pkgThumbnail} setPkgThumbnail={setPkgThumbnail} pkgClassId={pkgClassId} onClassChange={(id) => { setPkgClassId(id); setPkgSubjectIds([]); fetchSubjectsForClass(id) }}
              classes={classes} pkgSubjectIds={pkgSubjectIds} setPkgSubjectIds={setPkgSubjectIds} subjects={subjects}
              pkgPrice={pkgPrice} setPkgPrice={setPkgPrice} pkgOriginalPrice={pkgOriginalPrice} setPkgOriginalPrice={setPkgOriginalPrice}
              pkgIsActive={pkgIsActive} setPkgIsActive={setPkgIsActive} pkgIsPremium={pkgIsPremium} setPkgIsPremium={setPkgIsPremium} pkgOrder={pkgOrder} setPkgOrder={setPkgOrder}
              pkgStatus={pkgStatus} setPkgStatus={setPkgStatus} saving={saving} onSave={handleSavePackage} onCancel={() => setViewMode('list')}
              onWorkflowTransition={() => { _fetchPackages(); if (editId) fetchPackageDetail(editId) }}
            />
          </motion.div>
        )}

        {viewMode === 'detail' && (
          <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <PackageDetail
              loading={loading} currentPackage={currentPackage} examSets={examSets}
              onBack={() => setViewMode('list')}
              onEditPackage={(pkg) => {
                setEditId(pkg.id); setPkgTitle(pkg.title); setPkgDescription(pkg.description || '');
                setPkgClassId(pkg.classId); setPkgPrice(String(pkg.price)); setPkgOriginalPrice(String(pkg.originalPrice));
                setPkgThumbnail(pkg.thumbnail || ''); setPkgIsActive(pkg.isActive); setPkgIsPremium(pkg.isPremium ?? true); setPkgOrder(String(pkg.order));
                setPkgStatus(pkg.status); try { setPkgSubjectIds(        pkg.subjectIds || []) } catch { setPkgSubjectIds([]) }
                fetchSubjectsForClass(pkg.classId); setViewMode('editor');
              }}
              onOpenBulkCreate={() => setBulkCreateDialogOpen(true)}
              onOpenCreateSet={() => { setEditId(null); setViewMode('set-editor'); }}
              onOpenQuestionManager={(id) => { setSelectedSetId(id); fetchSetDetail(id); setViewMode('question-manager'); }}
              onOpenResults={(id) => { setSelectedSetId(id); fetchResults(id); setViewMode('results'); }}
              onOpenLeaderboard={openLeaderboard}
              onOpenRetakeRequests={(id) => { setSelectedSetId(id); fetchSetDetail(id); fetchRetakeRequests(id); setViewMode('retake-requests'); }}
              onOpenEditSet={(set) => {
                setEditId(set.id); setSetTitle(set.title); setSetDescription(set.description || '');
                setSetScheduledDate(set.scheduledDate ? new Date(set.scheduledDate).toISOString().split('T')[0] : '');
                setSetStartTime(set.startTime || '00:00'); setSetEndTime(set.endTime || '23:59');
                setSetDuration(String(set.duration)); setSetMarksPerQ(String(set.marksPerQ)); setSetNegativeMarks(String(set.negativeMarks));
                setSetInstructions(set.instructions || ''); setSetAllowRetake(set.allowRetake || false);
                setSetPracticeMode(set.practiceMode ?? true); setSetAllowUnlimitedAttempts(set.allowUnlimitedAttempts ?? true);
                setSetMaxAttempts(String(set.maxAttempts ?? '')); setSetReviewAnswers(set.reviewAnswers ?? true);
                setSetShowExplanations(set.showExplanations ?? true); setSetShowCorrectAnswers(set.showCorrectAnswers ?? true);
                setSetAutoPublishResults(set.autoPublishResults ?? false); setSetPassMarks(String(set.passMarks ?? ''));
                setSetOrder(String(set.order)); setSetStatus(set.status);
                setViewMode('set-editor');
              }}
              onDeleteSet={(id) => setDeleteTarget({ type: 'set', id, packageId: selectedPackageId! })}
            />
          </motion.div>
        )}

        {viewMode === 'set-editor' && (
          <motion.div key="set-editor" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <ExamSetForm
              editId={editId} currentSet={currentSet} setTitle={setTitle} setSetTitle={setSetTitle} setDescription={setDescription} setSetDescription={setSetDescription}
              setScheduledDate={setScheduledDate} setSetScheduledDate={setSetScheduledDate} setStartTime={setStartTime} setSetStartTime={setSetStartTime}
  setEndTime={setEndTime} setSetEndTime={setSetEndTime} setDuration={setDuration} setSetDuration={setSetDuration} setMarksPerQ={setMarksPerQ}
  setSetMarksPerQ={setSetMarksPerQ} setNegativeMarks={setNegativeMarks} setSetNegativeMarks={setSetNegativeMarks} setInstructions={setInstructions}
  setSetInstructions={setSetInstructions} setAllowRetake={setAllowRetake} setSetAllowRetake={setSetAllowRetake}
  setPracticeMode={setPracticeMode} setSetPracticeMode={setSetPracticeMode}
  setAllowUnlimitedAttempts={setAllowUnlimitedAttempts} setSetAllowUnlimitedAttempts={setSetAllowUnlimitedAttempts}
  setMaxAttempts={setMaxAttempts} setSetMaxAttempts={setSetMaxAttempts}
  setReviewAnswers={setReviewAnswers} setSetReviewAnswers={setSetReviewAnswers}
  setShowExplanations={setShowExplanations} setSetShowExplanations={setSetShowExplanations}
  setShowCorrectAnswers={setShowCorrectAnswers} setSetShowCorrectAnswers={setSetShowCorrectAnswers}
  setAutoPublishResults={setAutoPublishResults} setSetAutoPublishResults={setSetAutoPublishResults}
  setPassMarks={setPassMarks} setSetPassMarks={setSetPassMarks}
  setOrder={setOrder} setSetOrder={setSetOrder} setStatus={setStatus} setSetStatus={setSetStatus}
              saving={saving} onSave={handleSaveSet} onCancel={() => setViewMode('detail')}
            />
          </motion.div>
        )}

        {viewMode === 'question-manager' && (
          <motion.div key="question-manager" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <QuestionManager
              loading={loading} currentSet={currentSet} onBack={() => setViewMode('detail')}
              onOpenBulkUpload={() => setBulkUploadDialogOpen(true)}
              onOpenAddQuestion={() => {
                setSelectedMcqIds([]); setSearchMcqClassLevel(currentPackage?.class?.slug || '');
                setSearchMcqSubjectId(''); setSearchMcqChapterId(''); setSearchMcqText(''); setSearchMcqs([])
                setSearchDialogOpen(true); if (currentPackage?.class?.slug) fetchSearchMcqSubjects(currentPackage.class.slug);
              }}
              onRemoveQuestion={handleRemoveQuestion}
              onMoveQuestion={handleMoveQuestion}
            />
          </motion.div>
        )}

        {viewMode === 'results' && (
          <motion.div key="results" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <ExamResults
              loading={loading} currentSet={currentSet} results={setResults} onBack={() => setViewMode('detail')}
              selectedResult={selectedResult} setSelectedResult={setSelectedResult} detailOpen={resultDetailOpen} setDetailOpen={setResultDetailOpen}
              classLevelLabels={classLevelLabels}
            />
          </motion.div>
        )}

        {viewMode === 'leaderboard' && (
          <motion.div key="leaderboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <Leaderboard
              loading={leaderboardLoading} title={leaderboardSetTitle} data={leaderboardData} onBack={() => setViewMode('detail')}
              classLevelLabels={classLevelLabels}
            />
          </motion.div>
        )}

        {viewMode === 'retake-requests' && (
          <motion.div key="retake-requests" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
            <MCQRetakeRequests
              loading={retakeRequestsLoading} requests={retakeRequests}
              currentSet={currentSet} saving={saving}
              onBack={() => setViewMode('detail')}
              onRefresh={(id) => fetchRetakeRequests(id)}
              onApprove={handleApproveRetakeRequest}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <BulkCreateSetsDialog
        open={bulkCreateDialogOpen} onOpenChange={setBulkCreateDialogOpen}
        bulkPrefix={bulkPrefix} setBulkPrefix={setBulkPrefix} bulkStartDate={bulkStartDate} setBulkStartDate={setBulkStartDate}
        bulkIntervalDays={bulkIntervalDays} setBulkIntervalDays={setBulkIntervalDays} bulkCount={bulkCount} setBulkCount={setBulkCount}
        bulkDuration={bulkDuration} setBulkDuration={setBulkDuration} bulkMarksPerQ={bulkMarksPerQ} setBulkMarksPerQ={setBulkMarksPerQ}
        bulkNegativeMarks={bulkNegativeMarks} setBulkNegativeMarks={setBulkNegativeMarks} onSave={handleBulkCreateSets} saving={saving}
      />

      <BulkUploadDialog
        open={bulkUploadDialogOpen} onOpenChange={setBulkUploadDialogOpen}
        subjects={subjects} subjectId={bulkUploadSubjectId} setSubjectId={setBulkUploadSubjectId}
        file={bulkUploadFile} setFile={setBulkUploadFile} loading={bulkUploadLoading} result={bulkUploadResult}
        onUpload={handleBulkUploadMcqs} onDownloadTemplate={async () => {
          try {
            const res = await fetch('/api/admin/mcq-exam-packages/bulk-upload-questions')
            if (res.ok) {
              const blob = await res.blob()
              const url = window.URL.createObjectURL(blob)
              triggerDownload(url, 'mcq-exam-set-template.xlsx')
              window.URL.revokeObjectURL(url)
            }
          } catch {
            // handle error
          }
        }}
      />

      <QuestionSearchDialog
        open={searchDialogOpen} onOpenChange={setSearchDialogOpen}
        searchMcqClassLevel={searchMcqClassLevel} setSearchMcqClassLevel={setSearchMcqClassLevel} classLevelLabels={classLevelLabels}
        searchMcqSubjectId={searchMcqSubjectId} setSearchMcqSubjectId={setSearchMcqSubjectId} searchMcqSubjects={searchMcqSubjects}
        searchMcqChapterId={searchMcqChapterId} setSearchMcqChapterId={setSearchMcqChapterId} searchMcqChapters={searchMcqChapters}
        searchMcqText={searchMcqText} setSearchMcqText={setSearchMcqText} onSearch={handleSearchMcqs} loading={searchMcqLoading}
        results={searchMcqs} selectedIds={selectedMcqIds} setSelectedIds={setSelectedMcqIds}
        alreadyInSetIds={currentSet?.questions?.map(q => q.mcqId) || []} saving={saving} onAddSelected={handleAddMcqs}
        onClassChange={(val) => { setSearchMcqClassLevel(val === '_all' ? '' : val); setSearchMcqSubjectId(''); setSearchMcqChapterId(''); fetchSearchMcqSubjects(val === '_all' ? '' : val); }}
        onSubjectChange={(val) => { setSearchMcqSubjectId(val === '_all' ? '' : val); setSearchMcqChapterId(''); fetchSearchMcqChapters(val === '_all' ? '' : val); }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {deleteTarget?.type === 'package' ? 'প্যাকেজ ডিলিট' : 'এক্সাম সেট ডিলিট'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'package'
                ? 'আপনি কি নিশ্চিত এই এক্সাম প্যাকেজ মুছে ফেলতে চান? এর সকল এক্সাম সেট, প্রশ্ন ও ফলাফলও মুছে যাবে।'
                : 'আপনি কি নিশ্চিত এই এক্সাম সেট মুছে ফেলতে চান? এর সকল প্রশ্ন ও ফলাফলও মুছে যাবে।'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">ডিলিট করুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
