import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getSubjectById } from '../../lib/subjects';
import { getProfile } from '../../lib/profiles';
import { getAssignedMentors, getAssignedStudents } from '../../lib/mentorship';
import type { Subject, Profile } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  BookOpen,
  ArrowLeft,
  Calendar,
  Users,
  AlertCircle,
  Loader2,
  FileText,
  ListTodo,
  FolderKanban,
  CheckCircle2,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

export const SubjectDetailPage: React.FC = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { user, role } = useAuth();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [studentProfile, setStudentProfile] = useState<Profile | null>(null);
  const [mentorProfile, setMentorProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const isMentor = role === 'mentor';
  const isAdmin = role === 'admin';
  const backUrl = isMentor ? '/mentor/subjects' : '/student/subjects';

  useEffect(() => {
    let isMounted = true;
    if (!subjectId || !user?.id) {
      Promise.resolve().then(() => {
        if (isMounted) setLoading(false);
      });
      return () => {
        isMounted = false;
      };
    }

    const fetchData = async () => {
      try {
        // 1. Fetch Subject
        const { subject: subData, error: subError } = await getSubjectById(subjectId);
        if (!isMounted) return;

        if (subError || !subData) {
          setError(subError?.message || 'Study area not found.');
          setLoading(false);
          return;
        }

        // 2. Authorization check
        if (!isAdmin) {
          if (!isMentor) {
            // Student role: can only view if it's their subject
            if (subData.student_id !== user.id) {
              setUnauthorized(true);
              setLoading(false);
              return;
            }
          } else {
            // Mentor role: can only view if student is in their assigned roster
            const { students: roster } = await getAssignedStudents(user.id);
            if (!isMounted) return;
            const isAssigned = roster.some((s) => s.id === subData.student_id);
            if (!isAssigned) {
              setUnauthorized(true);
              setLoading(false);
              return;
            }
          }
        }

        setSubject(subData);

        // 3. Fetch Student Profile
        const { profile: sProf } = await getProfile(subData.student_id);
        if (isMounted && sProf) setStudentProfile(sProf);

        // 4. Fetch Mentor Profile
        if (subData.created_by) {
          const { profile: mProf } = await getProfile(subData.created_by);
          if (isMounted && mProf) setMentorProfile(mProf);
        } else {
          const { mentors } = await getAssignedMentors(subData.student_id);
          if (isMounted && mentors.length > 0) setMentorProfile(mentors[0]);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Error loading study area.';
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
  }, [subjectId, user, isMentor, isAdmin]);

  if (loading) {
    return (
      <div className="w-full py-12 px-4 academic-grid-pattern min-h-[60vh] flex items-center justify-center">
        <div className="p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center max-w-sm">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto mb-3" />
          <h2 className="font-heading font-extrabold text-sm text-brand-navy">
            LOADING STUDY AREA
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
              You do not have permission to view this study area. Students can only view their own courses, and mentors can only inspect assigned students.
            </p>
          </div>
          <div className="pt-2">
            <Link to={backUrl}>
              <Button variant="primary" size="sm" fullWidth leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to My Study Areas
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="w-full py-12 px-4 academic-grid-pattern min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md w-full border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-brand-gold-light border-2 border-brand-dark mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-brand-dark stroke-[2.5]" />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-lg text-brand-navy">
              STUDY AREA NOT FOUND
            </h2>
            <p className="text-xs text-brand-dark/80 mt-1 font-sans">
              {error || 'The requested study area could not be located in the database.'}
            </p>
          </div>
          <div className="pt-2">
            <Link to={backUrl}>
              <Button variant="outline" size="sm" fullWidth leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Study Areas
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Top Header Banner */}
        <section
          aria-labelledby="subject-detail-heading"
          className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-5 sm:p-7 shadow-brutal space-y-4"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Link
                to={backUrl}
                className="inline-flex items-center gap-1 font-mono text-xs uppercase font-bold text-brand-gold hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                {isMentor ? 'Curriculum Management' : 'Study Areas'}
              </Link>
              <span className="text-brand-bg/50 font-mono text-xs">/</span>
              {subject.code && (
                <span className="font-mono text-xs uppercase text-brand-teal font-bold">
                  {subject.code}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 p-1 border-2 border-brand-dark bg-brand-teal-light text-brand-navy flex items-center justify-center shadow-brutal-xs shrink-0">
                  <BookOpen className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <h1 id="subject-detail-heading" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg tracking-tight">
                    {subject.name}
                  </h1>
                  <span className="text-xs font-mono text-brand-bg/75">
                    Course Status: <strong className="text-brand-gold uppercase">{subject.status}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={subject.status === 'active' ? 'teal' : 'muted'} size="sm">
                  {subject.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>

          {/* Academic Attribution Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-brand-bg/20 text-xs font-mono">
            <div className="p-2.5 border border-brand-dark bg-brand-paper text-brand-dark flex items-center gap-2 shadow-brutal-xs">
              <GraduationCap className="w-4 h-4 text-brand-teal shrink-0" />
              <div>
                <span className="text-[10px] text-brand-muted block uppercase">Enrolled Student</span>
                <span className="font-bold text-brand-navy">
                  {studentProfile ? `${studentProfile.full_name} (${studentProfile.poraplan_id || 'PP001'})` : 'Student Scholar'}
                </span>
              </div>
            </div>

            <div className="p-2.5 border border-brand-dark bg-brand-paper text-brand-dark flex items-center gap-2 shadow-brutal-xs">
              <Users className="w-4 h-4 text-brand-gold shrink-0" />
              <div>
                <span className="text-[10px] text-brand-muted block uppercase">Curriculum Mentor</span>
                <span className="font-bold text-brand-navy">
                  {mentorProfile ? `${mentorProfile.full_name} (${mentorProfile.poraplan_id || 'PPM001'})` : 'Assigned Mentor'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Syllabus Overview Card */}
        <section aria-labelledby="syllabus-overview-title" className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between border-b-2 border-brand-dark pb-2.5">
            <h2 id="syllabus-overview-title" className="font-heading font-extrabold text-base text-brand-navy flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-teal stroke-[2.5]" />
              Syllabus Overview &amp; Learning Objectives
            </h2>
            <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Registered {subject.created_at ? new Date(subject.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-brand-dark/90 font-sans leading-relaxed">
            {subject.description || 'No detailed syllabus summary provided. Study tasks and problem sets assigned to this subject follow the standardized term curriculum.'}
          </p>
        </section>

        {/* Downstream Academic Modules Status (Honest Previews) */}
        <section aria-labelledby="downstream-modules-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="downstream-modules-title" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy">
              Academic Components in this Study Area
            </h2>
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted bg-brand-paper border border-brand-dark px-2 py-0.5 shadow-brutal-xs">
              7-STEP WORKFLOW
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Component 1: Topics */}
            <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                  STEP 1 • PLAN
                </span>
                <CheckCircle2 className="w-4 h-4 text-brand-teal stroke-[2.2]" />
              </div>
              <h3 className="font-heading font-bold text-sm text-brand-navy">
                Topics &amp; Milestones
              </h3>
              <p className="text-xs text-brand-muted font-sans leading-relaxed">
                Chapter breakdown and syllabus milestones will be configured in the upcoming Study Plans milestone.
              </p>
              <div className="pt-2 border-t border-brand-dark/20 font-mono text-[11px] text-brand-dark font-bold">
                Status: Pending Plan
              </div>
            </div>

            {/* Component 2: Tasks */}
            <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-gold">
                  STEP 2 • STUDY
                </span>
                <ListTodo className="w-4 h-4 text-brand-gold stroke-[2.2]" />
              </div>
              <h3 className="font-heading font-bold text-sm text-brand-navy">
                Daily Study Tasks
              </h3>
              <p className="text-xs text-brand-muted font-sans leading-relaxed">
                Disciplined 50-minute study blocks scheduled specifically for {subject.name}.
              </p>
              <div className="pt-2 border-t border-brand-dark/20 font-mono text-[11px] text-brand-muted">
                0 Active Tasks
              </div>
            </div>

            {/* Component 3: Assignments */}
            <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-navy">
                  STEP 3 • PRACTICE
                </span>
                <FileText className="w-4 h-4 text-brand-navy stroke-[2.2]" />
              </div>
              <h3 className="font-heading font-bold text-sm text-brand-navy">
                Practice Problem Sets
              </h3>
              <p className="text-xs text-brand-muted font-sans leading-relaxed">
                Handwritten assignments and numerical exercises submitted for mentor review.
              </p>
              <div className="pt-2 border-t border-brand-dark/20 font-mono text-[11px] text-brand-muted">
                0 Assigned Sets
              </div>
            </div>

            {/* Component 4: Resources */}
            <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                  REPOSITORY
                </span>
                <FolderKanban className="w-4 h-4 text-brand-teal stroke-[2.2]" />
              </div>
              <h3 className="font-heading font-bold text-sm text-brand-navy">
                Reference Material
              </h3>
              <p className="text-xs text-brand-muted font-sans leading-relaxed">
                Curated formula sheets, textbook notes, and reference files for revision.
              </p>
              <div className="pt-2 border-t border-brand-dark/20 font-mono text-[11px] text-brand-muted">
                0 Shared Files
              </div>
            </div>
          </div>
        </section>

        {/* Back Link */}
        <div className="pt-2">
          <Link to={backUrl}>
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back to Study Areas
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
};
