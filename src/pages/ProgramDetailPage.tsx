import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getProgramWithFullDetails } from '../lib/programs';
import {
  getApplications,
  submitApplication,
  getApplicationStatusBadgeVariant,
  getApplicationStatusLabel,
} from '../lib/applications';
import type { ProgramWithCurriculumAndCohorts, ProgramApplicationWithMeta } from '../types/database';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import {
  Clock,
  Laptop,
  CheckCircle2,
  BookOpen,
  Users,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  Calendar,
  Layers,
  ArrowLeft,
  Mail,
  GraduationCap,
  Zap,
  Send,
  FileCheck,
  ShieldCheck,
  X,
} from 'lucide-react';

export const ProgramDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, profile, role } = useAuth();

  const [program, setProgram] = useState<ProgramWithCurriculumAndCohorts | null>(null);
  const [existingApplication, setExistingApplication] = useState<ProgramApplicationWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Request Modal State
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [requestMessage, setRequestMessage] = useState('');
  const [mentorExperience, setMentorExperience] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadProgram() {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        const res = await getProgramWithFullDetails(slug);
        if (!isMounted) return;

        if (res.error || !res.program) {
          setError(res.error?.message || 'Program not found.');
        } else {
          if (res.program.publication_status !== 'published') {
            setError('This program is currently not published for public view.');
          } else {
            setProgram(res.program);
            if (res.program.curriculum.length > 0) {
              setExpandedSections({ [res.program.curriculum[0].id]: true });
            }

            const activeCohorts = res.program.cohorts.filter((c) => c.status !== 'archived');
            if (activeCohorts.length > 0) {
              setSelectedCohortId(activeCohorts[0].id);
            }

            // Check if authenticated user already has an active request/application
            if (user?.id) {
              const appsRes = await getApplications({
                applicantId: user.id,
                programId: res.program.id,
              });
              if (appsRes.applications.length > 0) {
                setExistingApplication(appsRes.applications[0]);
              }
            }
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Error loading program details');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProgram();
    return () => {
      isMounted = false;
    };
  }, [slug, user?.id]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenRequestModal = () => {
    setRequestError(null);
    setRequestMessage('');
    setMentorExperience('');
    setRequestModalOpen(true);
  };

  const handleCloseRequestModal = () => {
    setRequestModalOpen(false);
    setRequestError(null);
  };

  const handleSubmitEnrollmentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !program) return;

    setIsSubmittingRequest(true);
    setRequestError(null);

    const appType: 'student' | 'mentor' = role === 'mentor' ? 'mentor' : 'student';

    const { application, error: submitErr } = await submitApplication({
      applicant_id: user.id,
      application_type: appType,
      program_id: program.id,
      cohort_id: selectedCohortId || null,
      application_message: requestMessage.trim() || null,
      experience: role === 'mentor' ? mentorExperience.trim() || null : null,
    });

    setIsSubmittingRequest(false);

    if (submitErr || !application) {
      setRequestError(submitErr?.message || 'Failed to submit enrollment request. Please try again.');
    } else {
      setRequestModalOpen(false);
      setSuccessMessage(
        appType === 'student'
          ? 'Enrollment request submitted successfully and is pending administrator review.'
          : 'Mentor application submitted successfully and is pending review.'
      );
      // Reload applications
      const appsRes = await getApplications({
        applicantId: user.id,
        programId: program.id,
      });
      if (appsRes.applications.length > 0) {
        setExistingApplication(appsRes.applications[0]);
      }
    }
  };

  if (loading) {
    return (
      <div className="w-full py-20 px-4 flex items-center justify-center academic-grid-pattern min-h-[70vh]">
        <div className="p-10 border-3 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3 max-w-sm">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" />
          <p className="font-heading font-extrabold text-sm text-brand-navy">
            LOADING PROGRAM DETAILS
          </p>
          <p className="font-mono text-xs text-brand-muted">
            Fetching curriculum roadmap and scheduled cohorts...
          </p>
        </div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="w-full py-16 px-4 academic-grid-pattern min-h-[70vh]">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="w-6 h-6 shrink-0 stroke-[2.5]" />
              <h2 className="font-heading font-black text-xl">Program Unavailable</h2>
            </div>
            <p className="font-sans text-sm text-brand-dark/80 leading-relaxed">
              {error || 'The requested program could not be loaded.'}
            </p>
            <div className="pt-2">
              <Button
                to="/programs"
                variant="outline"
                size="sm"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Return to Program Catalog
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isAcademic = program.category === 'academic_mentorship';
  const isOpen = program.enrollment_status === 'open';
  const activeCohorts = program.cohorts.filter((c) => c.status !== 'archived');
  const entityTerm = isAcademic ? 'Cohort' : 'Course';

  return (
    <div className="w-full py-10 sm:py-14 px-4 sm:px-6 lg:px-8 academic-grid-pattern min-h-[85vh]">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link
            to="/programs"
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-brand-dark hover:text-brand-teal"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            Back to Programs
          </Link>
          <span className="text-brand-muted font-mono text-xs">/</span>
          <Badge variant={isAcademic ? 'gold' : 'teal'} size="sm">
            {isAcademic ? 'Academic Program' : 'Upskilling Program'}
          </Badge>
        </div>

        {/* Global Notification */}
        {successMessage && (
          <div className="p-4 border-2 border-brand-dark bg-emerald-50 text-emerald-950 flex items-center justify-between gap-3 shadow-brutal">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 stroke-[2.5]" />
              <span className="font-sans text-xs sm:text-sm font-semibold">{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-800 hover:text-emerald-950 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Hero Offering Card */}
        <div className="border-3 border-brand-dark bg-brand-paper shadow-brutal overflow-hidden">
          {/* Admin-uploaded Thumbnail or Restrained Fallback */}
          {program.cover_image_url ? (
            <div className="w-full h-56 sm:h-72 border-b-2 border-brand-dark bg-brand-paper-tint overflow-hidden">
              <img
                src={program.cover_image_url}
                alt={program.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="w-full h-32 sm:h-40 border-b-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between px-6 sm:px-10">
              <div className="flex items-center gap-3">
                <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs">
                  {isAcademic ? (
                    <GraduationCap className="w-6 h-6 text-brand-gold stroke-[2.5]" />
                  ) : (
                    <Zap className="w-6 h-6 text-brand-teal stroke-[2.5]" />
                  )}
                </div>
                <div>
                  <span className="font-mono text-xs font-bold text-brand-muted uppercase tracking-wider block">
                    {isAcademic ? 'Academic Program Offering' : 'Upskilling Program Offering'}
                  </span>
                  <span className="font-heading font-extrabold text-sm sm:text-base text-brand-navy">
                    {isAcademic ? 'Semester Syllabus Mentorship' : 'Practical Skill Sprint'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-brand-dark pb-4">
              <Badge variant={isAcademic ? 'gold' : 'teal'} size="md">
                {isAcademic ? 'Academic Program' : 'Upskilling Program'}
              </Badge>

              {isOpen ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-emerald-800 px-3 py-1 border-2 border-emerald-700 bg-emerald-50 shadow-brutal-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block animate-pulse" />
                  Enrollment Open
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-brand-muted px-3 py-1 border-2 border-brand-dark/30 bg-brand-paper-tint">
                  Enrollment Closed
                </span>
              )}
            </div>

            <div className="space-y-3">
              <h1 className="font-heading font-black text-2xl sm:text-4xl text-brand-navy tracking-tight leading-snug">
                {program.name}
              </h1>
              <p className="font-sans text-sm sm:text-base text-brand-dark/90 leading-relaxed max-w-4xl">
                {program.short_description}
              </p>
            </div>

            {/* Quick Specifications Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {program.duration && (
                <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-0.5 shadow-brutal-xs">
                  <span className="font-mono text-[10px] uppercase text-brand-muted block font-bold">
                    Program Duration
                  </span>
                  <span className="font-sans font-bold text-xs sm:text-sm text-brand-dark flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand-teal stroke-[2.5]" />
                    {program.duration}
                  </span>
                </div>
              )}

              {program.delivery_mode && (
                <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-0.5 shadow-brutal-xs">
                  <span className="font-mono text-[10px] uppercase text-brand-muted block font-bold">
                    Delivery Mode
                  </span>
                  <span className="font-sans font-bold text-xs sm:text-sm text-brand-dark flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5 text-brand-navy stroke-[2.5]" />
                    {program.delivery_mode}
                  </span>
                </div>
              )}

              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-0.5 shadow-brutal-xs">
                <span className="font-mono text-[10px] uppercase text-brand-muted block font-bold">
                  Scheduled {isAcademic ? 'Cohorts' : 'Sessions'}
                </span>
                <span className="font-mono font-bold text-xs sm:text-sm text-brand-dark flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-brand-gold stroke-[2.5]" />
                  {activeCohorts.length} Active / Planned
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview / Detailed Description */}
            {program.description && (
              <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-3">
                <h2 className="font-heading font-extrabold text-lg text-brand-navy flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                  Program Overview
                </h2>
                <div className="font-sans text-xs sm:text-sm text-brand-dark/85 leading-relaxed space-y-3 whitespace-pre-line">
                  {program.description}
                </div>
              </div>
            )}

            {/* Learning Objectives Preview */}
            {program.learning_objectives && program.learning_objectives.length > 0 && (
              <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-3">
                <h2 className="font-heading font-extrabold text-lg text-brand-navy flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                  Learning Outcomes &amp; Goals
                </h2>
                <ul className="space-y-2 font-sans text-xs sm:text-sm text-brand-dark/90 pt-1">
                  {program.learning_objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0 mt-0.5 stroke-[2.5]" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Curriculum Roadmap */}
            <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
              <div className="border-b-2 border-brand-dark pb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-heading font-extrabold text-lg text-brand-navy flex items-center gap-2">
                    <Layers className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                    Curriculum Structure &amp; Learning Modules
                  </h2>
                  <p className="font-sans text-xs text-brand-dark/70 mt-0.5">
                    Structured roadmap organized into systematic learning blocks.
                  </p>
                </div>
                <span className="font-mono text-xs font-bold text-brand-muted">
                  {program.curriculum.length} Phases
                </span>
              </div>

              {program.curriculum.length === 0 ? (
                <p className="text-xs font-mono text-brand-muted italic p-4 text-center">
                  Curriculum topics are being finalized for upcoming intakes.
                </p>
              ) : (
                <div className="space-y-3 pt-2">
                  {program.curriculum.map((section, idx) => {
                    const isExpanded = Boolean(expandedSections[section.id]);
                    return (
                      <div
                        key={section.id}
                        className="border-2 border-brand-dark bg-brand-paper-tint shadow-brutal-xs overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSection(section.id)}
                          className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-brand-paper transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 border border-brand-dark bg-brand-navy text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <h3 className="font-heading font-bold text-sm sm:text-base text-brand-navy">
                                {section.title}
                              </h3>
                              {section.description && (
                                <p className="font-sans text-xs text-brand-dark/70 line-clamp-1 mt-0.5">
                                  {section.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-xs text-brand-muted hidden sm:inline-block">
                              {section.topics.length} {section.topics.length === 1 ? 'Topic' : 'Topics'}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-brand-dark stroke-[2.5]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-brand-dark stroke-[2.5]" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-4 border-t-2 border-brand-dark bg-white space-y-3">
                            {section.topics.length === 0 ? (
                              <p className="font-mono text-xs text-brand-muted italic">
                                Topics for this module will be posted before start date.
                              </p>
                            ) : (
                              <ul className="space-y-2.5 font-sans text-xs">
                                {section.topics.map((topic) => (
                                  <li key={topic.id} className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0 mt-0.5 stroke-[2.5]" />
                                    <div className="space-y-0.5">
                                      <p className="font-sans font-bold text-brand-navy">
                                        {topic.title}
                                      </p>
                                      {topic.description && (
                                        <p className="font-sans text-[11px] text-brand-dark/75">
                                          {topic.description}
                                        </p>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Scheduled Cohorts / Courses */}
            <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
              <div className="border-b-2 border-brand-dark pb-3">
                <h2 className="font-heading font-extrabold text-lg text-brand-navy flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                  Scheduled {isAcademic ? 'Academic Cohorts' : 'Course Intakes'}
                </h2>
                <p className="font-sans text-xs text-brand-dark/70 mt-0.5">
                  Specific university batches and course sessions associated with this program.
                </p>
              </div>

              {activeCohorts.length === 0 ? (
                <p className="text-xs font-mono text-brand-muted italic p-3 text-center">
                  No upcoming {entityTerm.toLowerCase()}s scheduled yet. Check back soon.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeCohorts.map((cohort) => (
                    <div
                      key={cohort.id}
                      className="p-4 border-2 border-brand-dark bg-brand-paper-tint shadow-brutal-xs space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-brand-teal px-2 py-0.5 border border-brand-dark bg-brand-paper">
                          {cohort.code}
                        </span>
                        <Badge
                          variant={cohort.status === 'active' ? 'teal' : cohort.status === 'planned' ? 'gold' : 'paper'}
                          size="sm"
                        >
                          {cohort.status.toUpperCase()}
                        </Badge>
                      </div>

                      <h3 className="font-heading font-bold text-sm sm:text-base text-brand-navy">
                        {cohort.name}
                      </h3>

                      {cohort.description && (
                        <p className="font-sans text-xs text-brand-dark/80">
                          {cohort.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 pt-1 font-mono text-[11px] text-brand-muted border-t border-brand-dark/15">
                        {cohort.start_date && (
                          <span>
                            Start: <strong className="text-brand-dark">{cohort.start_date}</strong>
                          </span>
                        )}
                        {cohort.end_date && (
                          <span>
                            End: <strong className="text-brand-dark">{cohort.end_date}</strong>
                          </span>
                        )}
                        {cohort.capacity && (
                          <span>
                            Capacity: <strong className="text-brand-dark">{cohort.capacity} scholars</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Target Audience & Prerequisites */}
            {(program.target_audience || program.prerequisites) && (
              <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
                <h3 className="font-heading font-extrabold text-base text-brand-navy border-b-2 border-brand-dark pb-2">
                  Eligibility &amp; Target Audience
                </h3>

                {program.target_audience && (
                  <div className="space-y-1 font-sans text-xs">
                    <span className="font-mono text-[10px] uppercase text-brand-muted font-bold block">
                      Who Is This For?
                    </span>
                    <p className="text-brand-dark/85 leading-relaxed">
                      {program.target_audience}
                    </p>
                  </div>
                )}

                {program.prerequisites && (
                  <div className="space-y-1 font-sans text-xs border-t border-brand-dark/20 pt-3">
                    <span className="font-mono text-[10px] uppercase text-brand-muted font-bold block">
                      Prerequisites &amp; Requirements
                    </span>
                    <p className="text-brand-dark/85 leading-relaxed">
                      {program.prerequisites}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Admissions & Enrollment Desk */}
          <div className="space-y-6">
            <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-5 sticky top-20">
              <div className="border-b-2 border-brand-dark pb-3">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
                  ADMISSIONS &amp; ENROLLMENT
                </span>
                <h3 className="font-heading font-extrabold text-base text-brand-navy">
                  Enrollment Desk
                </h3>
              </div>

              {/* State 1: Active Existing Request */}
              {existingApplication ? (
                <div className="space-y-3">
                  <div className="p-4 border-2 border-brand-dark bg-brand-paper-tint space-y-2 shadow-brutal-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                        Request Status
                      </span>
                      <Badge
                        variant={getApplicationStatusBadgeVariant(existingApplication.status)}
                        size="sm"
                      >
                        {existingApplication.status.toUpperCase()}
                      </Badge>
                    </div>

                    <p className="font-heading font-extrabold text-sm text-brand-navy">
                      {getApplicationStatusLabel(existingApplication.status)}
                    </p>

                    {existingApplication.cohort && (
                      <p className="font-mono text-[11px] text-brand-dark">
                        {isAcademic ? 'Cohort' : 'Session'}: <strong>{existingApplication.cohort.name}</strong>
                      </p>
                    )}

                    <span className="font-mono text-[10px] text-brand-muted block">
                      Submitted: {new Date(existingApplication.submitted_at).toLocaleDateString()}
                    </span>

                    {existingApplication.status === 'approved' && existingApplication.application_type === 'student' && (
                      <div className="pt-2 border-t border-brand-dark/20">
                        <span className="font-mono text-[11px] font-bold text-brand-teal flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal stroke-[2.5]" />
                          Active Enrollment Created
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    to={role === 'student' ? '/student/applications' : '/mentor/applications'}
                    variant="outline"
                    size="sm"
                    fullWidth
                    leftIcon={<FileCheck className="w-3.5 h-3.5" />}
                  >
                    View in My Applications
                  </Button>
                </div>
              ) : isOpen ? (
                /* State 2: Open and No Existing Request */
                <div className="space-y-4">
                  <div className="p-3 border-2 border-emerald-600 bg-emerald-50 text-emerald-950 font-sans text-xs leading-relaxed space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 stroke-[2.5]" />
                      Admissions Currently Open
                    </p>
                    <p className="text-[11px]">
                      Enrollment requests for upcoming intakes are reviewed directly by our administration team.
                    </p>
                  </div>

                  {!user ? (
                    <div className="space-y-2">
                      <Button
                        to={`/login?redirect=/programs/${program.slug}`}
                        variant="primary"
                        size="md"
                        fullWidth
                      >
                        Sign In to Request Enrollment
                      </Button>
                      <Button
                        to="/contact"
                        variant="outline"
                        size="sm"
                        fullWidth
                      >
                        Contact PoraPlan
                      </Button>
                    </div>
                  ) : role === 'admin' ? (
                    <div className="space-y-2">
                      <Button
                        to="/admin/programs"
                        variant="outline"
                        size="sm"
                        fullWidth
                      >
                        Manage in Admin Console
                      </Button>
                      <Button
                        to={`/admin/applications?programId=${program.id}`}
                        variant="primary"
                        size="sm"
                        fullWidth
                      >
                        View Applications for this Offering
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        onClick={handleOpenRequestModal}
                        variant="primary"
                        size="md"
                        fullWidth
                        leftIcon={<Send className="w-3.5 h-3.5" />}
                      >
                        {role === 'mentor' ? 'Apply to Mentor Program' : 'Request Enrollment'}
                      </Button>
                      <Button
                        to="/contact"
                        variant="outline"
                        size="sm"
                        fullWidth
                      >
                        Contact Before Enrolling
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* State 3: Closed */
                <div className="space-y-3">
                  <div className="p-3 border-2 border-red-600 bg-red-50 text-red-950 font-sans text-xs leading-relaxed space-y-1">
                    <p className="font-bold">Enrollment Closed</p>
                    <p className="text-[11px]">
                      This offering is not accepting new requests at this time. Upcoming intakes will be announced on the notice board.
                    </p>
                  </div>
                  <Button
                    to="/programs"
                    variant="outline"
                    size="md"
                    fullWidth
                  >
                    Explore Other Programs
                  </Button>
                </div>
              )}

              {/* Direct Inquiries & Official Channels */}
              <div className="pt-4 border-t-2 border-brand-dark/20 space-y-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
                  Questions &amp; Direct Support
                </span>
                <p className="font-sans text-xs text-brand-dark/80 leading-relaxed">
                  Have questions about syllabus review, mentor pairings, or cohort timing?
                </p>
                <a
                  href={`mailto:poraplan.bd@gmail.com?subject=Enrollment%20Inquiry:%20${encodeURIComponent(program.name)}`}
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 border-2 border-brand-dark bg-brand-paper-tint font-mono text-xs font-bold text-brand-dark hover:bg-brand-paper transition-colors shadow-brutal-xs"
                >
                  <Mail className="w-3.5 h-3.5 text-brand-teal" />
                  <span>poraplan.bd@gmail.com</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enrollment Request Modal */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 bg-brand-dark/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg border-3 border-brand-dark bg-brand-paper shadow-brutal-lg my-8">
            <div className="p-5 border-b-2 border-brand-dark flex items-center justify-between bg-brand-paper-tint">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                <h3 className="font-heading font-black text-lg text-brand-navy">
                  {role === 'mentor' ? 'Mentor Application' : 'Request Program Enrollment'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseRequestModal}
                className="p-1 border border-brand-dark bg-white hover:bg-brand-paper shadow-brutal-xs text-brand-dark"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <form onSubmit={handleSubmitEnrollmentRequest} className="p-6 space-y-4">
              {requestError && (
                <div className="p-3 border-2 border-brand-dark bg-red-50 text-red-950 flex items-center gap-2 text-xs font-semibold shadow-brutal-xs">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 stroke-[2.5]" />
                  <span>{requestError}</span>
                </div>
              )}

              {/* Target Program & Applicant Info */}
              <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-1 font-sans text-xs">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
                  Target Program
                </span>
                <p className="font-bold text-brand-navy text-sm">
                  {program.name}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] text-brand-dark">
                  <span>Applicant: <strong>{profile?.full_name || user?.email}</strong></span>
                  {profile?.poraplan_id && (
                    <span className="px-1.5 py-0.2 border border-brand-dark/30 bg-white">
                      ID: {profile.poraplan_id}
                    </span>
                  )}
                </div>
              </div>

              {/* Cohort Selection (if cohorts exist) */}
              {activeCohorts.length > 0 && (
                <div className="space-y-1.5">
                  <label htmlFor="cohortSelect" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                    Select Preferred {isAcademic ? 'Cohort' : 'Session'} <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="cohortSelect"
                    required
                    value={selectedCohortId}
                    onChange={(e) => setSelectedCohortId(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    {activeCohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Message / Goals */}
              <div className="space-y-1.5">
                <label htmlFor="requestMessage" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                  {role === 'mentor' ? 'Mentorship Approach & Availability' : 'Study Goals & Syllabus Focus'}
                </label>
                <textarea
                  id="requestMessage"
                  rows={3}
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal leading-relaxed"
                  placeholder={
                    role === 'mentor'
                      ? 'Briefly describe your subject expertise and weekly availability...'
                      : 'Outline which university courses or topics you need study assistance with...'
                  }
                />
              </div>

              {/* Mentor-Specific Experience Field */}
              {role === 'mentor' && (
                <div className="space-y-1.5">
                  <label htmlFor="mentorExperience" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                    Teaching or Mentoring Experience
                  </label>
                  <textarea
                    id="mentorExperience"
                    rows={2}
                    value={mentorExperience}
                    onChange={(e) => setMentorExperience(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal leading-relaxed"
                    placeholder="Briefly note previous teaching, TA, or mentorship experience..."
                  />
                </div>
              )}

              {/* Review Policy Note */}
              <p className="font-sans text-[11px] text-brand-muted leading-relaxed">
                Requests are reviewed by PoraPlan administration. Submission does not guarantee immediate cohort admission. You will be notified once reviewed.
              </p>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-brand-dark">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseRequestModal}
                  disabled={isSubmittingRequest}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingRequest}
                  leftIcon={
                    isSubmittingRequest ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )
                  }
                >
                  {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
