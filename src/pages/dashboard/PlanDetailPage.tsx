import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getStudyPlanById } from '../../lib/studyPlans';
import { getProfile } from '../../lib/profiles';
import { getAssignedStudents } from '../../lib/mentorship';
import type { StudyPlan, StudyPlanItem, Subject, Profile } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  BookOpen,
  ArrowLeft,
  Calendar,
  Users,
  AlertCircle,
  Loader2,
  ListTodo,
  GraduationCap,
  Sparkles,
  Clock,
  Compass,
  FileCheck,
} from 'lucide-react';

export const PlanDetailPage: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const { user, role } = useAuth();

  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [items, setItems] = useState<StudyPlanItem[]>([]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [studentProfile, setStudentProfile] = useState<Profile | null>(null);
  const [mentorProfile, setMentorProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const isMentor = role === 'mentor';
  const isAdmin = role === 'admin';
  const backUrl = isMentor ? '/mentor/plans' : '/student/plans';

  useEffect(() => {
    let isMounted = true;
    if (!planId || !user?.id) {
      Promise.resolve().then(() => {
        if (isMounted) setLoading(false);
      });
      return () => {
        isMounted = false;
      };
    }

    const fetchData = async () => {
      try {
        // 1. Fetch Plan & Items
        const { plan: planData, items: itemsData, subject: subData, error: planError } =
          await getStudyPlanById(planId);

        if (!isMounted) return;

        if (planError || !planData) {
          setError(planError?.message || 'Study plan not found.');
          setLoading(false);
          return;
        }

        // 2. Authorization check
        if (!isAdmin) {
          if (!isMentor) {
            // Student role: can only view if student_id matches
            if (planData.student_id !== user.id) {
              setUnauthorized(true);
              setLoading(false);
              return;
            }
          } else {
            // Mentor role: can only view if student is in assigned roster
            const { students: roster } = await getAssignedStudents(user.id);
            if (!isMounted) return;
            const isAssigned = roster.some((s) => s.id === planData.student_id);
            if (!isAssigned) {
              setUnauthorized(true);
              setLoading(false);
              return;
            }
          }
        }

        setPlan(planData);
        setItems(itemsData);
        setSubject(subData);

        // 3. Fetch Student Profile
        const { profile: sProf } = await getProfile(planData.student_id);
        if (isMounted && sProf) setStudentProfile(sProf);

        // 4. Fetch Mentor Profile
        if (planData.created_by) {
          const { profile: mProf } = await getProfile(planData.created_by);
          if (isMounted && mProf) setMentorProfile(mProf);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Error loading study plan.';
        setError(msg);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [planId, user, isMentor, isAdmin]);

  if (loading) {
    return (
      <div className="w-full py-12 px-4 academic-grid-pattern min-h-[60vh] flex items-center justify-center">
        <div className="p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center max-w-sm">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto mb-3" />
          <h2 className="font-heading font-extrabold text-sm text-brand-navy">
            LOADING STUDY PLAN
          </h2>
          <span className="font-mono text-xs text-brand-muted mt-1 block">
            Verifying curriculum permissions...
          </span>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="w-full py-12 px-4 academic-grid-pattern min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md w-full border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 border-2 border-brand-dark mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-700 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-lg text-brand-navy">
              ACCESS RESTRICTED
            </h2>
            <p className="text-xs text-brand-dark/80 mt-1 font-sans">
              You do not have permission to view this study plan. Students can only view their own plans, and mentors can only inspect assigned scholars.
            </p>
          </div>
          <div className="pt-2">
            <Link to={backUrl}>
              <Button variant="primary" size="sm" fullWidth leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Study Plans
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="w-full py-12 px-4 academic-grid-pattern min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md w-full border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-brand-gold-light border-2 border-brand-dark mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-brand-dark stroke-[2.5]" />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-lg text-brand-navy">
              STUDY PLAN NOT FOUND
            </h2>
            <p className="text-xs text-brand-dark/80 mt-1 font-sans">
              {error || 'The requested study plan could not be located in the database.'}
            </p>
          </div>
          <div className="pt-2">
            <Link to={backUrl}>
              <Button variant="outline" size="sm" fullWidth leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Study Plans
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono">
          <Link
            to={backUrl}
            className="text-brand-dark/75 hover:text-brand-teal flex items-center gap-1 font-bold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Study Plans
          </Link>
          <span className="text-brand-muted">/</span>
          <span className="text-brand-navy font-bold truncate max-w-xs">{plan.title}</span>
        </nav>

        {/* Primary Plan Header Card */}
        <section aria-labelledby="plan-detail-heading" className="border-2 border-brand-dark bg-brand-navy text-brand-paper shadow-brutal p-5 sm:p-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] tracking-wider uppercase font-bold text-brand-gold bg-brand-navy border border-brand-gold/40 px-2 py-0.5 shadow-brutal-xs">
                  STEP 1: PLAN • ROADMAP SPECIFICATION
                </span>
                {subject && (
                  <Link
                    to={isMentor ? `/mentor/subjects/${subject.id}` : `/student/subjects/${subject.id}`}
                    className="font-mono text-[10px] uppercase font-bold text-brand-teal-light bg-brand-teal/20 border border-brand-teal/40 px-2 py-0.5 hover:underline flex items-center gap-1"
                  >
                    <BookOpen className="w-3 h-3" />
                    {subject.name}
                  </Link>
                )}
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 p-1 border-2 border-brand-dark bg-brand-teal-light text-brand-navy flex items-center justify-center shadow-brutal-xs shrink-0 mt-0.5">
                  <Compass className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h1 id="plan-detail-heading" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg tracking-tight">
                    {plan.title}
                  </h1>
                  <span className="text-xs font-mono text-brand-bg/75">
                    Plan Status: <strong className="text-brand-gold uppercase">{plan.status}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={plan.status === 'active' ? 'teal' : 'muted'} size="sm">
                {plan.status.toUpperCase()}
              </Badge>
              <span className="font-mono text-xs font-bold bg-brand-paper text-brand-dark border border-brand-dark px-2.5 py-1 shadow-brutal-xs">
                {items.length} {items.length === 1 ? 'Topic' : 'Topics'}
              </span>
            </div>
          </div>

          {/* Academic Attribution Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-brand-bg/20 text-xs font-mono">
            <div className="p-2.5 border border-brand-dark bg-brand-paper text-brand-dark flex items-center gap-2 shadow-brutal-xs">
              <GraduationCap className="w-4 h-4 text-brand-teal shrink-0" />
              <div>
                <span className="text-[10px] text-brand-muted block uppercase">Assigned Student</span>
                <span className="font-bold text-brand-navy">
                  {studentProfile ? `${studentProfile.full_name} (${studentProfile.poraplan_id || 'PP001'})` : 'Student Scholar'}
                </span>
              </div>
            </div>

            <div className="p-2.5 border border-brand-dark bg-brand-paper text-brand-dark flex items-center gap-2 shadow-brutal-xs">
              <Users className="w-4 h-4 text-brand-gold shrink-0" />
              <div>
                <span className="text-[10px] text-brand-muted block uppercase">Supervising Mentor</span>
                <span className="font-bold text-brand-navy">
                  {mentorProfile ? `${mentorProfile.full_name} (${mentorProfile.poraplan_id || 'PPM001'})` : 'Assigned Mentor'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Roadmap Overview / Objectives Card */}
        <section aria-labelledby="roadmap-overview-title" className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between border-b-2 border-brand-dark pb-2.5">
            <h2 id="roadmap-overview-title" className="font-heading font-extrabold text-base text-brand-navy flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-teal stroke-[2.5]" />
              Roadmap Overview &amp; Learning Goals
            </h2>
            <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Created {plan.created_at ? new Date(plan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-brand-dark/90 font-sans leading-relaxed">
            {plan.description || 'No detailed learning objectives outlined. Topics below represent the sequenced study progression for this curriculum milestone.'}
          </p>
        </section>

        {/* Ordered Topics / Items List */}
        <section aria-labelledby="topics-list-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="topics-list-title" className="font-heading font-extrabold text-base text-brand-navy flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-brand-navy stroke-[2.2]" />
              Curriculum Topics &amp; Study Milestones
            </h2>
            <span className="font-mono text-xs text-brand-muted">
              {items.length} {items.length === 1 ? 'Milestone' : 'Milestones'}
            </span>
          </div>

          {items.length === 0 ? (
            <div className="p-8 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-2">
              <Compass className="w-6 h-6 text-brand-muted mx-auto" />
              <p className="font-heading font-bold text-xs text-brand-dark">
                No topics outlined for this plan yet.
              </p>
              <p className="text-xs text-brand-muted">
                Your mentor can add sequential chapter milestones and reading assignments.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, idx) => (
                <article
                  key={item.id}
                  className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 flex-1">
                    <div className="w-8 h-8 border-2 border-brand-dark bg-brand-navy text-brand-paper font-heading font-extrabold text-xs flex items-center justify-center shrink-0 shadow-brutal-xs">
                      #{idx + 1}
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy">
                          {item.title}
                        </h3>
                        <Badge
                          variant={item.status === 'completed' ? 'teal' : item.status === 'in_progress' ? 'gold' : 'muted'}
                          size="sm"
                        >
                          {item.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>

                      {item.instructions && (
                        <p className="text-xs text-brand-dark/85 font-sans leading-relaxed bg-brand-bg/50 p-2.5 border border-brand-dark/20">
                          {item.instructions}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs font-mono text-brand-muted pt-1">
                        {item.estimated_minutes && (
                          <span className="flex items-center gap-1 text-brand-navy font-bold">
                            <Clock className="w-3.5 h-3.5 text-brand-teal" />
                            {item.estimated_minutes} mins estimated
                          </span>
                        )}
                        {item.target_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Target: {new Date(item.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Downstream Roadmap Connection Preview (Honest Boundaries) */}
        <section aria-labelledby="downstream-preview-title" className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="downstream-preview-title" className="font-heading font-bold text-xs sm:text-sm text-brand-navy flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-brand-teal stroke-[2.2]" />
              Downstream Academic Progression
            </h2>
            <span className="font-mono text-[10px] font-bold uppercase text-brand-muted bg-brand-bg border border-brand-dark px-2 py-0.5">
              STEP 2 &amp; 3 NEXT
            </span>
          </div>

          <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
            These study plan topics will link directly into daily study tasks and practice problem assignments in the upcoming <strong>Tasks &amp; Assignments</strong> milestone.
          </p>
        </section>

      </div>
    </div>
  );
};
