import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getApplications,
  adminReviewApplication,
  getApplicationStatusBadgeVariant,
} from '../../lib/applications';
import { getPrograms } from '../../lib/programs';
import type {
  ProgramApplicationWithMeta,
  Program,
  ApplicationStatus,
  ApplicationType,
} from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  FileText,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck,
  Users,
  Mail,
  Phone,
  ShieldCheck,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

export const AdminApplicationsPage: React.FC = () => {
  const { user } = useAuth();

  const [applications, setApplications] = useState<ProgramApplicationWithMeta[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ApplicationType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all');
  const [programFilter, setProgramFilter] = useState<string>('all');

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ProgramApplicationWithMeta | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'under_review' | 'approved' | 'rejected'>('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const loadData = async () => {
    try {
      const [appsRes, progRes] = await Promise.all([
        getApplications(),
        getPrograms({ includeUnpublished: true }),
      ]);

      if (appsRes.error) {
        setError(appsRes.error.message);
      } else {
        setApplications(appsRes.applications);
        setPrograms(progRes.programs);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [appsRes, progRes] = await Promise.all([
          getApplications(),
          getPrograms({ includeUnpublished: true }),
        ]);
        if (!isMounted) return;
        if (appsRes.error) {
          setError(appsRes.error.message);
        } else {
          setApplications(appsRes.applications);
          setPrograms(progRes.programs);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load applications');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Notifications timeout
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  // Filter & Search logic
  const filteredApplications = applications.filter((app) => {
    if (typeFilter !== 'all' && app.application_type !== typeFilter) return false;
    if (statusFilter !== 'all' && app.status !== statusFilter) return false;
    if (programFilter !== 'all' && app.program_id !== programFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const name = (app.applicant?.full_name || '').toLowerCase();
      const poraplanId = (app.applicant?.poraplan_id || '').toLowerCase();
      const email = (app.applicant?.email || '').toLowerCase();
      const progName = (app.program?.name || '').toLowerCase();
      if (!name.includes(q) && !poraplanId.includes(q) && !email.includes(q) && !progName.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const handleOpenReviewModal = (app: ProgramApplicationWithMeta) => {
    setSelectedApp(app);
    setReviewDecision(app.status === 'pending' || app.status === 'under_review' ? 'approved' : app.status as any);
    setReviewNote(app.admin_review_note || '');
    setReviewModalOpen(true);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !user?.id) return;

    setIsSubmittingReview(true);
    setError(null);

    const res = await adminReviewApplication({
      applicationId: selectedApp.id,
      decision: reviewDecision,
      reviewNote: reviewNote.trim() || undefined,
      adminId: user.id,
    });

    setIsSubmittingReview(false);

    if (res.error || !res.success) {
      setError(res.error?.message || res.message || 'Failed to submit review.');
    } else {
      setSuccessMessage(res.message);
      setReviewModalOpen(false);
      await loadData();
    }
  };

  // Metrics summary
  const totalApps = applications.length;
  const pendingCount = applications.filter((a) => a.status === 'pending').length;
  const underReviewCount = applications.filter((a) => a.status === 'under_review').length;
  const approvedCount = applications.filter((a) => a.status === 'approved').length;
  const rejectedCount = applications.filter((a) => a.status === 'rejected').length;

  return (
    <div className="w-full py-6 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header Banner */}
        <div className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-6 shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
                ADMIN CONSOLE
              </span>
              <Badge variant="navy" size="sm" className="bg-brand-paper text-brand-dark">
                APPLICATIONS DESK
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg">
              Program Applications Management
            </h1>
            <p className="font-mono text-xs text-brand-bg/75">
              Review and record decisions for student and mentor intake applications.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-brand-gold font-bold">
            <span className="px-3 py-1 bg-brand-paper border border-brand-dark text-brand-dark shadow-brutal-xs">
              {pendingCount} Pending Decisions
            </span>
          </div>
        </div>

        {/* Global Feedback Banners */}
        {successMessage && (
          <div className="p-3.5 border-2 border-brand-dark bg-emerald-50 text-emerald-950 flex items-center gap-3 shadow-brutal-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 stroke-[2.5]" />
            <span className="font-sans text-xs sm:text-sm font-semibold">{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 border-2 border-brand-dark bg-red-50 text-red-950 flex items-center gap-3 shadow-brutal-xs">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 stroke-[2.5]" />
            <span className="font-sans text-xs sm:text-sm font-semibold">{error}</span>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
            <span className="font-mono text-[10px] uppercase text-brand-muted font-bold block">
              Total Submissions
            </span>
            <span className="font-heading font-extrabold text-xl text-brand-navy">
              {totalApps}
            </span>
          </div>
          <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
            <span className="font-mono text-[10px] uppercase text-brand-muted font-bold block">
              Pending
            </span>
            <span className="font-heading font-extrabold text-xl text-brand-navy">
              {pendingCount}
            </span>
          </div>
          <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
            <span className="font-mono text-[10px] uppercase text-brand-muted font-bold block">
              Under Review
            </span>
            <span className="font-heading font-extrabold text-xl text-brand-gold-dark">
              {underReviewCount}
            </span>
          </div>
          <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
            <span className="font-mono text-[10px] uppercase text-brand-muted font-bold block">
              Approved
            </span>
            <span className="font-heading font-extrabold text-xl text-emerald-700">
              {approvedCount}
            </span>
          </div>
          <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
            <span className="font-mono text-[10px] uppercase text-brand-muted font-bold block">
              Declined
            </span>
            <span className="font-heading font-extrabold text-xl text-red-700">
              {rejectedCount}
            </span>
          </div>
        </div>

        {/* Filters & Search Control */}
        <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-brand-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name, ID, or program..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border-2 border-brand-dark bg-white font-sans focus:outline-none focus:ring-1 focus:ring-brand-teal"
              />
            </div>

            {/* Program Dropdown */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-brand-muted uppercase font-bold shrink-0">
                Program:
              </span>
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="px-2.5 py-1 text-xs border border-brand-dark bg-white font-sans max-w-[200px] truncate"
              >
                <option value="all">All Programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Type & Status Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-brand-dark/20 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-brand-muted uppercase font-bold mr-1">Type:</span>
              {(['all', 'student', 'mentor'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-0.5 font-mono text-xs border uppercase ${
                    typeFilter === t
                      ? 'bg-brand-navy text-white border-brand-dark font-bold'
                      : 'bg-brand-paper-tint text-brand-dark border-brand-dark/40 hover:bg-brand-paper'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-brand-muted uppercase font-bold mr-1">Status:</span>
              {(['all', 'pending', 'under_review', 'approved', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-0.5 font-mono text-xs uppercase border ${
                    statusFilter === s
                      ? 'bg-brand-dark text-white border-brand-dark font-bold'
                      : 'bg-brand-paper-tint text-brand-dark border-brand-dark/40 hover:bg-brand-paper'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Applications List */}
        {loading ? (
          <div className="p-12 text-center border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" />
            <p className="font-mono text-xs text-brand-muted">Loading applications...</p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="p-10 text-center border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-2">
            <FileText className="w-8 h-8 text-brand-muted mx-auto" />
            <p className="font-heading font-extrabold text-brand-navy">No Applications Found</p>
            <p className="font-sans text-xs text-brand-muted">
              No applications match the current filter or search criteria.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((app) => {
              const isStudentApp = app.application_type === 'student';

              return (
                <div
                  key={app.id}
                  className="p-5 sm:p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4"
                >
                  {/* Row Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-brand-dark pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={isStudentApp ? 'teal' : 'gold'} size="sm">
                        {isStudentApp ? 'STUDENT INTAKE' : 'MENTOR INTAKE'}
                      </Badge>

                      <Badge
                        variant={getApplicationStatusBadgeVariant(app.status)}
                        size="sm"
                      >
                        {app.status.toUpperCase()}
                      </Badge>

                      <span className="font-mono text-xs font-bold text-brand-dark">
                        {app.applicant?.poraplan_id || 'ID PENDING'}
                      </span>
                    </div>

                    <span className="font-mono text-xs text-brand-muted">
                      Submitted: {new Date(app.submitted_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Program & Applicant Coordinates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Applicant details */}
                    <div className="space-y-1.5">
                      <span className="font-mono text-[10px] uppercase text-brand-muted font-bold block">
                        Applicant Dossier
                      </span>
                      <h3 className="font-heading font-black text-lg text-brand-navy">
                        {app.applicant?.full_name || 'Member Applicant'}
                      </h3>
                      <div className="font-sans text-xs text-brand-dark/80 space-y-0.5">
                        <p className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Mail className="w-3.5 h-3.5 text-brand-teal" />
                          {app.applicant?.email}
                        </p>
                        {app.applicant?.whatsapp_number && (
                          <p className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-800 font-bold">
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            {app.applicant.whatsapp_number}
                          </p>
                        )}
                        <p className="pt-0.5">
                          {[app.applicant?.university, app.applicant?.department, app.applicant?.batch]
                            .filter(Boolean)
                            .join(' • ') || 'Academic details pending'}
                        </p>
                      </div>
                    </div>

                    {/* Right: Target Program & Cohort */}
                    <div className="space-y-1.5">
                      <span className="font-mono text-[10px] uppercase text-brand-muted font-bold block">
                        Target Offering &amp; Intake
                      </span>
                      <h4 className="font-heading font-bold text-base text-brand-navy">
                        {app.program?.name}
                      </h4>
                      {app.cohort ? (
                        <div className="font-mono text-xs text-brand-teal font-bold flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {app.cohort.name} ({app.cohort.code})
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-brand-muted">General Program Intake</span>
                      )}
                    </div>
                  </div>

                  {/* Application Statement */}
                  {app.application_message && (
                    <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint text-xs space-y-1">
                      <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
                        Application Message
                      </span>
                      <p className="font-sans text-brand-dark/90 leading-relaxed italic">
                        "{app.application_message}"
                      </p>
                    </div>
                  )}

                  {/* Actions & Decision Ribbon */}
                  <div className="pt-3 border-t-2 border-brand-dark flex flex-wrap items-center justify-between gap-3">
                    <div className="font-mono text-xs text-brand-muted">
                      {app.reviewed_at && (
                        <span>
                          Reviewed: {new Date(app.reviewed_at).toLocaleDateString()} by {app.reviewer?.full_name || 'Admin'}
                        </span>
                      )}
                      {app.admin_review_note && (
                        <span className="block text-[11px] text-brand-dark mt-0.5">
                          Note: "{app.admin_review_note}"
                        </span>
                      )}
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenReviewModal(app)}
                      leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                    >
                      Review Decision
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REVIEW & DECISION MODAL */}
      {reviewModalOpen && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-xl bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  Administrative Action
                </span>
                <h3 className="font-heading font-extrabold text-lg text-brand-navy">
                  Review Application: {selectedApp.applicant?.full_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="p-1 border border-brand-dark bg-brand-paper-tint"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Critical Workflow Notice based on Decision */}
            {reviewDecision === 'approved' && selectedApp.application_type === 'student' && (
              <div className="p-3.5 border-2 border-emerald-600 bg-emerald-50 text-emerald-950 font-sans text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                  Student Enrollment will be Created
                </p>
                <p className="text-[11px] leading-relaxed">
                  Approving this student application atomically checks cohort capacity, verifies no duplicate active enrollment, creates a <code className="font-bold font-mono">program_enrollments</code> record, and dispatches a student admission notification.
                </p>
                {selectedApp.cohort?.capacity && (
                  <p className="font-mono text-[10px] font-bold text-emerald-800 pt-1">
                    Cohort Capacity: {selectedApp.cohort.capacity} scholars
                  </p>
                )}
              </div>
            )}

            {reviewDecision === 'approved' && selectedApp.application_type === 'mentor' && (
              <div className="p-3.5 border-2 border-brand-teal bg-teal-50 text-teal-950 font-sans text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-brand-teal stroke-[2.5]" />
                  Mentor Eligibility Approved (No Enrollment)
                </p>
                <p className="text-[11px] leading-relaxed">
                  Approving this mentor application marks the mentor as eligible for this program. It <strong>does NOT</strong> create a student enrollment nor automatically assign the mentor to any cohort (Milestone 4).
                </p>
              </div>
            )}

            {reviewDecision === 'rejected' && (
              <div className="p-3 border-2 border-red-600 bg-red-50 text-red-950 font-sans text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>
                  Declining this application will record a rejected status and notify the applicant.
                </span>
              </div>
            )}

            <form onSubmit={handleSaveReview} className="space-y-4">
              {/* Decision Selector */}
              <div className="space-y-1">
                <label className="font-mono text-xs uppercase font-bold block">
                  Select Administrative Decision <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={reviewDecision}
                  onChange={(e) => setReviewDecision(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-white font-sans font-bold"
                >
                  <option value="approved">Approve Application</option>
                  <option value="under_review">Mark Under Review</option>
                  <option value="rejected">Decline Application</option>
                </select>
              </div>

              {/* Internal Review Note */}
              <div className="space-y-1">
                <label className="font-mono text-xs uppercase font-bold block">
                  Internal Review Note (Recorded in system registry)
                </label>
                <textarea
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="e.g. Credentials verified, recommended for Batch 67 cohort."
                  className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-white font-sans leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-brand-dark">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReviewModalOpen(false)}
                  disabled={isSubmittingReview}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingReview}
                  leftIcon={isSubmittingReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                >
                  {isSubmittingReview ? 'Recording Decision...' : 'Confirm Decision'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
