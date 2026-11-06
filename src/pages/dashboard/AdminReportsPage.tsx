import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  generateAdminAcademicIntelligence,
  type AdminAcademicIntelligenceReport,
  type ReportPeriod,
} from '../../lib/reports';
import { formatLocalDate } from '../../lib/library';
import { Button } from '../../components/common/Button';
import {
  Printer,
  ShieldCheck,
  RefreshCw,
  Loader2,
  AlertCircle,
  Users,
  GraduationCap,
  Clock,
  FileCheck,
  AlertTriangle,
  Search,
  ExternalLink,
  CheckCircle2,
  X,
} from 'lucide-react';

export const AdminReportsPage: React.FC = () => {
  const { user, profile } = useAuth();

  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatLocalDate(d);
  });
  const [customEnd, setCustomEnd] = useState(() => formatLocalDate(new Date()));

  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'mentors'>('overview');
  const [report, setReport] = useState<AdminAcademicIntelligenceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters for Student Directory
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState<string>('all');
  const [studentAttentionFilter, setStudentAttentionFilter] = useState<string>('all');

  // Filters for Mentor Directory
  const [mentorSearch, setMentorSearch] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { report: rep, error: err } = await generateAdminAcademicIntelligence(
        period,
        period === 'custom' ? customStart : undefined,
        period === 'custom' ? customEnd : undefined,
        {
          requestingUserId: profile?.id || user?.id,
          requestingUserRole: 'admin',
        }
      );

      if (err) {
        setError(err.message || 'Unable to generate administrative academic intelligence.');
      } else {
        setReport(rep);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred during report generation.');
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd, profile?.id, user?.id]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Filtered Students
  const filteredStudents = (report?.students || []).filter((s) => {
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      const match =
        s.studentName.toLowerCase().includes(q) ||
        s.poraplanId.toLowerCase().includes(q) ||
        (s.university && s.university.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q)) ||
        (s.programName && s.programName.toLowerCase().includes(q)) ||
        (s.mentorName && s.mentorName.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (studentStatusFilter !== 'all' && s.enrollmentStatus !== studentStatusFilter) {
      return false;
    }
    if (studentAttentionFilter !== 'all' && s.attentionLevel !== studentAttentionFilter) {
      return false;
    }
    return true;
  });

  // Filtered Mentors
  const filteredMentors = (report?.mentors || []).filter((m) => {
    if (mentorSearch.trim()) {
      const q = mentorSearch.toLowerCase();
      const match =
        m.mentorName.toLowerCase().includes(q) ||
        m.poraplanId.toLowerCase().includes(q) ||
        m.expertiseSubjects.some((subj) => subj.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Scoped Academic Typography and Print Stylesheet */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@600;700&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=Source+Serif+4:ital,opsz,wght@0,8..60,600;0,8..60,700;0,8..60,800;1,8..60,600&display=swap');

        .academic-doc {
          font-family: 'Source Sans 3', 'Noto Sans Bengali', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #082B4C;
          line-height: 1.45;
        }

        .academic-heading,
        .academic-doc h1,
        .academic-doc h2,
        .academic-doc h3,
        .academic-doc h4 {
          font-family: 'Source Serif 4', 'Noto Serif Bengali', Georgia, 'Times New Roman', serif;
        }

        .academic-sans {
          font-family: 'Source Sans 3', 'Noto Sans Bengali', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        @page {
          size: A4 portrait;
          margin: 10mm 12mm 10mm 12mm;
        }

        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #082B4C !important;
            font-size: 9pt !important;
            line-height: 1.35 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          nav, aside, header.sticky, main > footer, .print\\:hidden {
            display: none !important;
          }
          article header, article footer, .academic-doc header, .academic-doc footer {
            display: flex !important;
          }
          .break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .shadow-brutal, .shadow-brutal-sm, .shadow-brutal-xs {
            box-shadow: none !important;
          }
          .border-2 {
            border-width: 1px !important;
          }
        }
      `}</style>

      {/* ========================================================================= */}
      {/* 1. INTERACTIVE CONTROL BAR (SCREEN ONLY)                                  */}
      {/* ========================================================================= */}
      <div className="print:hidden p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-brand-gold bg-brand-navy px-2 py-0.5 border border-brand-dark">
              ADMINISTRATIVE ACADEMIC INTELLIGENCE
            </span>
            <span className="font-mono text-[10px] text-brand-muted">
              PLATFORM OPERATIONAL OVERSIGHT
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy tracking-tight">
            Admin Academic Intelligence &amp; Operations
          </h1>
          <p className="text-xs text-brand-muted mt-0.5">
            Audit platform-wide syllabus execution, review mentor operational workloads, and track evidence-based student attention radars.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchReports}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handlePrint}
            className="flex items-center gap-1.5 shadow-brutal-xs bg-brand-navy text-white hover:bg-brand-navy/90"
          >
            <Printer className="w-4 h-4" />
            <span>Print Overview (A4)</span>
          </Button>
        </div>
      </div>

      {/* Filter Row: Period Selector & Section Tabs (Hidden in Print) */}
      <div className="print:hidden p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 border-2 font-mono text-xs font-bold transition-all ${
              activeTab === 'overview'
                ? 'border-brand-dark bg-brand-teal text-white shadow-brutal-xs'
                : 'border-transparent text-brand-muted hover:border-brand-dark hover:bg-brand-paper-tint hover:text-brand-dark'
            }`}
          >
            Executive Overview &amp; Attention
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`px-3 py-1.5 border-2 font-mono text-xs font-bold transition-all ${
              activeTab === 'students'
                ? 'border-brand-dark bg-brand-teal text-white shadow-brutal-xs'
                : 'border-transparent text-brand-muted hover:border-brand-dark hover:bg-brand-paper-tint hover:text-brand-dark'
            }`}
          >
            Student Progress Directory ({report?.students.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mentors')}
            className={`px-3 py-1.5 border-2 font-mono text-xs font-bold transition-all ${
              activeTab === 'mentors'
                ? 'border-brand-dark bg-brand-teal text-white shadow-brutal-xs'
                : 'border-transparent text-brand-muted hover:border-brand-dark hover:bg-brand-paper-tint hover:text-brand-dark'
            }`}
          >
            Mentor Workload Directory ({report?.mentors.length || 0})
          </button>
        </div>

        {/* Audit Period Selector */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="font-bold text-brand-muted uppercase text-[10px]">Window:</span>
          {(['schedule', 'weekly', 'monthly', 'custom'] as ReportPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-xs font-bold uppercase transition-all ${
                period === p
                  ? 'border-2 border-brand-dark bg-brand-navy text-white shadow-brutal-xs'
                  : 'border border-brand-dark/20 text-brand-muted hover:border-brand-dark hover:text-brand-dark'
              }`}
            >
              {p === 'schedule' ? 'Schedule' : p}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-0.5 border border-brand-dark bg-white text-xs font-bold"
              />
              <span>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-0.5 border border-brand-dark bg-white text-xs font-bold"
              />
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. REPORT CONTENT BODY                                                    */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="p-16 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-teal animate-spin mx-auto" />
          <h3 className="font-heading font-extrabold text-base text-brand-navy">
            COMPILING ADMINISTRATIVE ACADEMIC INTELLIGENCE
          </h3>
          <p className="font-mono text-xs text-brand-muted">
            Aggregating platform enrollments, mentor workloads, student task execution rates, and assessment mastery...
          </p>
        </div>
      ) : error ? (
        <div className="p-6 border-2 border-brand-dark bg-red-50 text-red-900 shadow-brutal flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-heading font-bold text-sm">Failed to generate administrative report</h4>
            <p className="font-mono text-xs text-red-800">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchReports} className="mt-2">
              Retry Generation
            </Button>
          </div>
        </div>
      ) : report ? (
        <div className="academic-doc space-y-6">
          {/* ===================================================================== */}
          {/* TAB 1: EXECUTIVE OVERVIEW & ATTENTION RADAR                           */}
          {/* ===================================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Executive Printable Summary Card */}
              <article className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0 print:space-y-4">
                {/* Official Institutional Header */}
                <header className="border-b-2 border-brand-dark pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <img
                      src="/poraplan-logo.png"
                      alt="PoraPlan Logo"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/assets/poraplan-logo.png';
                      }}
                      className="w-12 h-12 object-contain rounded border border-brand-dark/20 bg-white p-1 shrink-0"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="academic-sans text-[9px] uppercase font-bold tracking-widest text-brand-gold bg-brand-navy px-2 py-0.5 border border-brand-dark">
                          PORAPLAN ACADEMIC INTELLIGENCE
                        </span>
                        <span className="academic-sans text-[9px] text-brand-muted">
                          CONFIDENTIAL • PLATFORM OPERATIONAL ARCHIVE
                        </span>
                      </div>
                      <h2 className="academic-heading text-xl sm:text-2xl font-bold text-brand-navy tracking-tight">
                        Executive Operations &amp; Academic Overview
                      </h2>
                      <p className="academic-sans text-xs text-brand-muted">
                        Platform-wide audit of enrolled scholars, mentor capacity, pending reviews, and evidence-based attention items.
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right space-y-0.5 text-xs academic-sans border-t sm:border-t-0 pt-2 sm:pt-0 border-brand-dark/20 shrink-0">
                    <div className="text-brand-navy font-bold">
                      <span className="text-brand-muted block text-[9px] uppercase tracking-wider">AUDIT WINDOW</span>
                      <span>{report.dateRange.startDate} — {report.dateRange.endDate}</span>
                    </div>
                    <div className="text-[10px] text-brand-muted">
                      Window Type: <strong className="text-brand-dark">{report.dateRange.label}</strong>
                    </div>
                    <div className="text-[10px] text-brand-muted">
                      Compiled: {new Date(report.generatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </header>

                {/* 6 Core KPI Indicators (Distinguishes Registered vs Active Users) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 break-inside-avoid">
                  {/* 1. Students */}
                  <div className="p-3 border-2 border-brand-dark bg-white shadow-brutal-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-brand-muted mb-1">
                      <span className="text-[9.5px] uppercase font-bold academic-sans">Students</span>
                      <Users className="w-3.5 h-3.5 text-brand-teal" />
                    </div>
                    <div>
                      <div className="academic-heading text-2xl font-bold text-brand-navy">
                        {report.overview.activeStudents}
                      </div>
                      <div className="text-[9.5px] academic-sans text-brand-muted mt-0.5">
                        Active of {report.overview.totalRegisteredStudents} registered
                      </div>
                    </div>
                  </div>

                  {/* 2. Mentors */}
                  <div className="p-3 border-2 border-brand-dark bg-white shadow-brutal-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-brand-muted mb-1">
                      <span className="text-[9.5px] uppercase font-bold academic-sans">Mentors</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-navy" />
                    </div>
                    <div>
                      <div className="academic-heading text-2xl font-bold text-brand-navy">
                        {report.overview.activeMentors}
                      </div>
                      <div className="text-[9.5px] academic-sans text-brand-muted mt-0.5">
                        Active of {report.overview.totalMentors} registered
                      </div>
                    </div>
                  </div>

                  {/* 3. Enrollments */}
                  <div className="p-3 border-2 border-brand-dark bg-white shadow-brutal-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-brand-muted mb-1">
                      <span className="text-[9.5px] uppercase font-bold academic-sans">Enrollments</span>
                      <GraduationCap className="w-3.5 h-3.5 text-brand-teal" />
                    </div>
                    <div>
                      <div className="academic-heading text-2xl font-bold text-brand-navy">
                        {report.overview.activeEnrollments}
                      </div>
                      <div className="text-[9.5px] academic-sans text-brand-muted mt-0.5">
                        Active program seats
                      </div>
                    </div>
                  </div>

                  {/* 4. Attention Radar */}
                  <div className="p-3 border-2 border-brand-dark bg-white shadow-brutal-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-brand-muted mb-1">
                      <span className="text-[9.5px] uppercase font-bold academic-sans">Attention</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
                    </div>
                    <div>
                      <div className={`academic-heading text-2xl font-bold ${report.overview.scholarsNeedingAttentionCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {report.overview.scholarsNeedingAttentionCount}
                      </div>
                      <div className="text-[9.5px] academic-sans text-brand-muted mt-0.5">
                        Scholars flagged
                      </div>
                    </div>
                  </div>

                  {/* 5. Pending Reviews */}
                  <div className="p-3 border-2 border-brand-dark bg-white shadow-brutal-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-brand-muted mb-1">
                      <span className="text-[9.5px] uppercase font-bold academic-sans">Review Queue</span>
                      <FileCheck className="w-3.5 h-3.5 text-amber-700" />
                    </div>
                    <div>
                      <div className={`academic-heading text-2xl font-bold ${report.overview.totalSubmissionsPendingReview > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {report.overview.totalSubmissionsPendingReview}
                      </div>
                      <div className="text-[9.5px] academic-sans text-brand-muted mt-0.5">
                        Submissions to grade
                      </div>
                    </div>
                  </div>

                  {/* 6. Overdue Tasks */}
                  <div className="p-3 border-2 border-brand-dark bg-white shadow-brutal-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-brand-muted mb-1">
                      <span className="text-[9.5px] uppercase font-bold academic-sans">Task Backlog</span>
                      <Clock className="w-3.5 h-3.5 text-brand-gold" />
                    </div>
                    <div>
                      <div className={`academic-heading text-2xl font-bold ${report.overview.totalOverdueTasks > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {report.overview.totalOverdueTasks}
                      </div>
                      <div className="text-[9.5px] academic-sans text-brand-muted mt-0.5">
                        Overdue tasks total
                      </div>
                    </div>
                  </div>
                </div>

                {/* Evidence-Based Attention Radar (Section C4) */}
                <div className="space-y-3 break-inside-avoid">
                  <div className="flex items-center justify-between">
                    <h3 className="academic-heading font-bold text-sm sm:text-base text-brand-navy flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-700" />
                      <span>Evidence-Based Academic Attention Radar</span>
                    </h3>
                    <span className="text-[10px] academic-sans text-brand-muted">
                      Neutral, criteria-driven monitoring based strictly on verifiable records
                    </span>
                  </div>

                  {report.attentionItems.length === 0 ? (
                    <div className="p-4 border-2 border-brand-dark bg-emerald-50/50 text-emerald-900 text-xs academic-sans flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>All active scholars are on track with zero critical backlogs or severe completion deficits in this window.</span>
                    </div>
                  ) : (
                    <div className="border-2 border-brand-dark bg-white overflow-x-auto">
                      <table className="w-full text-left text-xs academic-sans">
                        <thead className="bg-brand-paper border-b-2 border-brand-dark text-brand-navy uppercase text-[9.5px] tracking-wider font-bold">
                          <tr>
                            <th className="p-2.5">Scholar</th>
                            <th className="p-2.5">Assigned Mentor</th>
                            <th className="p-2.5 text-center">Status</th>
                            <th className="p-2.5">Specific Reason &amp; Evidence</th>
                            <th className="p-2.5 text-right print:hidden">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-dark/15">
                          {report.attentionItems.map((item) => (
                            <tr key={item.studentId} className="hover:bg-brand-paper-tint/50">
                              <td className="p-2.5 font-bold text-brand-navy">
                                <div>{item.studentName}</div>
                                <div className="text-[10px] font-mono text-brand-teal">{item.poraplanId}</div>
                              </td>
                              <td className="p-2.5 text-brand-dark">
                                {item.mentorName}
                              </td>
                              <td className="p-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 border text-[9.5px] font-bold uppercase inline-block ${
                                    item.level === 'critical'
                                      ? 'bg-red-700 text-white border-red-900'
                                      : item.level === 'warning'
                                      ? 'bg-amber-600 text-white border-amber-800'
                                      : 'bg-slate-200 text-brand-dark border-brand-dark/40'
                                  }`}
                                >
                                  {item.levelLabel}
                                </span>
                              </td>
                              <td className="p-2.5 text-brand-dark">
                                <div className="font-semibold text-brand-navy">{item.reason}</div>
                                <div className="text-[10.5px] text-brand-muted mt-0.5 font-mono">{item.evidence}</div>
                              </td>
                              <td className="p-2.5 text-right print:hidden">
                                <Link
                                  to={`/student/reports?studentId=${item.studentId}`}
                                  className="px-2.5 py-1 border border-brand-dark bg-brand-bg text-[11px] font-bold text-brand-navy hover:bg-brand-teal hover:text-white transition-colors shadow-xs inline-flex items-center gap-1"
                                >
                                  <span>Audit Report</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <footer className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-[10px] academic-sans text-brand-muted break-inside-avoid">
                  <div>PoraPlan Academic Intelligence • Official Administration Archive</div>
                  <div className="font-bold">Executive Report</div>
                </footer>
              </article>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 2: STUDENT PROGRESS MONITORING DIRECTORY (SECTION C2)             */}
          {/* ===================================================================== */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              {/* Directory Filter Bar */}
              <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex-1 flex items-center gap-2 border-2 border-brand-dark bg-white px-3 py-1.5 shadow-xs">
                  <Search className="w-4 h-4 text-brand-muted shrink-0" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by student name, ID, university, department, or mentor..."
                    className="w-full bg-transparent text-xs text-brand-dark focus:outline-none"
                  />
                  {studentSearch && (
                    <button type="button" onClick={() => setStudentSearch('')} className="text-brand-muted hover:text-brand-dark" aria-label="Clear student search">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-brand-muted">Enrollment:</span>
                    <select
                      value={studentStatusFilter}
                      onChange={(e) => setStudentStatusFilter(e.target.value)}
                      className="px-2 py-1 border-2 border-brand-dark bg-white text-xs font-bold"
                    >
                      <option value="all">All ({report.students.length})</option>
                      <option value="active">Active Only</option>
                      <option value="completed">Completed</option>
                      <option value="inactive">Inactive</option>
                      <option value="none">Not Enrolled</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-brand-muted">Attention:</span>
                    <select
                      value={studentAttentionFilter}
                      onChange={(e) => setStudentAttentionFilter(e.target.value)}
                      className="px-2 py-1 border-2 border-brand-dark bg-white text-xs font-bold"
                    >
                      <option value="all">All Levels</option>
                      <option value="critical">Critical Attention</option>
                      <option value="warning">Needs Attention</option>
                      <option value="normal">On Track</option>
                      <option value="insufficient_data">Insufficient Data</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Student Directory Table */}
              <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal overflow-x-auto">
                <table className="w-full text-left text-xs academic-sans">
                  <thead className="bg-brand-paper-tint border-b-2 border-brand-dark text-brand-navy uppercase text-[9.5px] tracking-wider font-bold">
                    <tr>
                      <th className="p-3">Student &amp; Academic Meta</th>
                      <th className="p-3">Program &amp; Mentor</th>
                      <th className="p-3 text-center">Tasks (Rate / Overdue)</th>
                      <th className="p-3 text-center">Mastery Score</th>
                      <th className="p-3 text-center">Consistency</th>
                      <th className="p-3 text-center">Attention Status</th>
                      <th className="p-3 text-right">Official Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/15">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-brand-muted italic">
                          No students match the selected filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s) => (
                        <tr key={s.studentId} className="hover:bg-brand-paper-tint/50">
                          <td className="p-3">
                            <div className="font-bold text-brand-navy text-sm">{s.studentName}</div>
                            <div className="text-[10.5px] font-mono text-brand-teal font-semibold">{s.poraplanId}</div>
                            {(s.university || s.department) && (
                              <div className="text-[10px] text-brand-muted mt-0.5">
                                {[s.university, s.department, s.batch ? `Batch ${s.batch}` : null].filter(Boolean).join(' • ')}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-brand-navy">{s.programName || 'Not Enrolled'}</div>
                            <div className="text-[10px] text-brand-muted">
                              Mentor: <strong className="text-brand-dark">{s.mentorName || 'Unassigned'}</strong>
                            </div>
                            <div className="mt-0.5">
                              <span
                                className={`text-[9px] uppercase font-bold px-1.5 py-0.2 border ${
                                  s.enrollmentStatus === 'active'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : s.enrollmentStatus === 'completed'
                                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-300'
                                }`}
                              >
                                {s.enrollmentStatus}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {s.isCompletionRateApplicable ? (
                              <div>
                                <span className="font-bold text-brand-navy text-sm">{s.taskCompletionRate}%</span>
                                <div className="text-[10px] text-brand-muted">
                                  {s.tasksCompleted}/{s.tasksAssigned} tasks
                                </div>
                                {s.tasksOverdue > 0 && (
                                  <span className="block text-[10px] font-bold text-red-700">
                                    {s.tasksOverdue} overdue
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-brand-muted text-[10px]">N/A (0 tasks)</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {s.averageScorePercentage !== null ? (
                              <div>
                                <span
                                  className={`font-bold text-sm ${
                                    s.averageScorePercentage >= 85
                                      ? 'text-emerald-700'
                                      : s.averageScorePercentage < 70
                                      ? 'text-red-700'
                                      : 'text-brand-navy'
                                  }`}
                                >
                                  {s.averageScorePercentage}%
                                </span>
                                <div className="text-[10px] text-brand-muted">
                                  {s.scoredEvaluationsCount} exam{s.scoredEvaluationsCount === 1 ? '' : 's'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-brand-muted text-[10px]">No scored exams</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {s.consistencyPercentage !== null ? (
                              <div>
                                <span className="font-bold text-brand-navy text-sm">{s.consistencyPercentage}%</span>
                                <div className="text-[10px] text-brand-muted">
                                  {s.activeStudyDays}/{s.scheduledDaysCount} scheduled days
                                </div>
                              </div>
                            ) : (
                              <span className="text-brand-muted text-[10px]">N/A</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 border text-[9px] font-bold uppercase inline-block ${
                                s.attentionLevel === 'critical'
                                  ? 'bg-red-700 text-white border-red-900'
                                  : s.attentionLevel === 'warning'
                                  ? 'bg-amber-600 text-white border-amber-800'
                                  : s.attentionLevel === 'normal'
                                  ? 'bg-emerald-700 text-white border-emerald-900'
                                  : 'bg-slate-200 text-brand-dark border-brand-dark/30'
                              }`}
                              title={s.attentionReason}
                            >
                              {s.attentionLevel === 'insufficient_data'
                                ? 'Insufficient Data'
                                : s.attentionLevel}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <Link
                              to={`/student/reports?studentId=${s.studentId}`}
                              className="px-2.5 py-1 border-2 border-brand-dark bg-white font-mono text-[11px] font-bold text-brand-navy hover:bg-brand-teal hover:text-white transition-all shadow-xs inline-flex items-center gap-1"
                            >
                              <span>View Report</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 3: MENTOR WORKLOAD & OPERATIONS DIRECTORY (SECTION C3)            */}
          {/* ===================================================================== */}
          {activeTab === 'mentors' && (
            <div className="space-y-4">
              {/* Mentor Search Bar */}
              <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex items-center justify-between gap-3 text-xs font-mono">
                <div className="flex-1 flex items-center gap-2 border-2 border-brand-dark bg-white px-3 py-1.5 shadow-xs">
                  <Search className="w-4 h-4 text-brand-muted shrink-0" />
                  <input
                    type="text"
                    value={mentorSearch}
                    onChange={(e) => setMentorSearch(e.target.value)}
                    placeholder="Search by mentor name, ID, or expertise subjects..."
                    className="w-full bg-transparent text-xs text-brand-dark focus:outline-none"
                  />
                  {mentorSearch && (
                    <button type="button" onClick={() => setMentorSearch('')} className="text-brand-muted hover:text-brand-dark" aria-label="Clear mentor search">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Mentor Workload Directory Table */}
              <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal overflow-x-auto">
                <table className="w-full text-left text-xs academic-sans">
                  <thead className="bg-brand-paper-tint border-b-2 border-brand-dark text-brand-navy uppercase text-[9.5px] tracking-wider font-bold">
                    <tr>
                      <th className="p-3">Mentor &amp; Expertise</th>
                      <th className="p-3 text-center">Assigned Mentees</th>
                      <th className="p-3 text-center">Active Cohorts</th>
                      <th className="p-3 text-center">Recent Evaluations</th>
                      <th className="p-3 text-center">Reviews Queue</th>
                      <th className="p-3 text-center">Mentees Requiring Attention</th>
                      <th className="p-3 text-right">Mentor Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/15">
                    {filteredMentors.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-brand-muted italic">
                          No mentors match the search query.
                        </td>
                      </tr>
                    ) : (
                      filteredMentors.map((m) => (
                        <tr key={m.mentorId} className="hover:bg-brand-paper-tint/50">
                          <td className="p-3">
                            <div className="font-bold text-brand-navy text-sm">{m.mentorName}</div>
                            <div className="text-[10.5px] font-mono text-brand-gold font-semibold">{m.poraplanId}</div>
                            {m.expertiseSubjects.length > 0 && (
                              <div className="text-[10px] text-brand-muted mt-0.5">
                                Subjects: {m.expertiseSubjects.join(', ')}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-bold text-brand-navy text-sm">{m.activeMenteesCount}</span>
                            <span className="text-[10px] text-brand-muted block">Active scholars</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-bold text-brand-navy text-sm">{m.activeCohortsCount}</span>
                            <span className="text-[10px] text-brand-muted block">Cohorts</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-bold text-brand-navy text-sm">{m.recentEvaluationsCount}</span>
                            <span className="text-[10px] text-brand-muted block">Evaluations done</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`font-bold text-sm ${m.pendingReviewsCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {m.pendingReviewsCount}
                            </span>
                            <span className="text-[10px] text-brand-muted block">Pending review</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`font-bold text-sm ${m.menteesNeedingAttentionCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                              {m.menteesNeedingAttentionCount}
                            </span>
                            <span className="text-[10px] text-brand-muted block">Flagged mentees</span>
                          </td>
                          <td className="p-3 text-right">
                            <Link
                              to={`/mentor/reports?mentorId=${m.mentorId}`}
                              className="px-2.5 py-1 border-2 border-brand-dark bg-white font-mono text-[11px] font-bold text-brand-navy hover:bg-brand-navy hover:text-white transition-all shadow-xs inline-flex items-center gap-1"
                            >
                              <span>Audit Roster</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

