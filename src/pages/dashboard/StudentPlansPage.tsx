import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getStudentStudyPlans, type StudyPlanWithMeta } from '../../lib/studyPlans';
import { getAssignedMentors } from '../../lib/mentorship';
import type { Profile } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Compass,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Loader2,
  Users,
  BookOpen,
  Calendar,
  ListTodo,
  RefreshCw,
} from 'lucide-react';

export const StudentPlansPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState<StudyPlanWithMeta[]>([]);
  const [mentors, setMentors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  const studentId = user?.id || '';

  const loadData = () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      getStudentStudyPlans(studentId),
      getAssignedMentors(studentId),
    ])
      .then(([plansRes, mentorsRes]) => {
        if (plansRes.error) {
          setError(plansRes.error.message);
        } else {
          setPlans(plansRes.plans);
        }
        setMentors(mentorsRes.mentors);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load study plans.';
        setError(msg);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!studentId) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }
    let isMounted = true;

    Promise.all([
      getStudentStudyPlans(studentId),
      getAssignedMentors(studentId),
    ])
      .then(([plansRes, mentorsRes]) => {
        if (!isMounted) return;
        if (plansRes.error) {
          setError(plansRes.error.message);
        } else {
          setPlans(plansRes.plans);
        }
        setMentors(mentorsRes.mentors);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load study plans.';
        setError(msg);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const assignedMentor = mentors.length > 0 ? mentors[0] : null;

  const filteredPlans = plans.filter((plan) => {
    if (statusFilter === 'all') return true;
    return plan.status === statusFilter;
  });

  return (
    <div className="w-full py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Top Header Banner */}
        <section aria-labelledby="study-plans-heading" className="border-2 border-brand-dark bg-brand-navy text-brand-paper shadow-brutal p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-wider uppercase font-bold text-brand-gold bg-brand-navy border border-brand-gold/40 px-2 py-0.5 shadow-brutal-xs">
                  STUDY ROADMAPS
                </span>
              </div>
              <h1 id="study-plans-heading" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg tracking-tight">
                Study Plans
              </h1>
              <p className="text-xs sm:text-sm text-brand-bg/80 font-sans max-w-2xl leading-relaxed">
                Clear study roadmaps organized by your mentor to guide what topics to study and in what order.
              </p>
            </div>

            {/* Quick Stats Banner */}
            <div className="flex items-center gap-3 self-start sm:self-center">
              <div className="border border-brand-paper/30 bg-brand-navy p-3 text-center min-w-[90px] shadow-brutal-xs">
                <span className="text-xs font-mono text-brand-paper/70 block uppercase">Total Plans</span>
                <span className="text-xl font-heading font-extrabold text-brand-gold">{plans.length}</span>
              </div>
              <div className="border border-brand-paper/30 bg-brand-navy p-3 text-center min-w-[90px] shadow-brutal-xs">
                <span className="text-xs font-mono text-brand-paper/70 block uppercase">Active</span>
                <span className="text-xl font-heading font-extrabold text-brand-teal-light">
                  {plans.filter((p) => p.status === 'active').length}
                </span>
              </div>
            </div>
          </div>

          {/* Mentor Alignment Strip */}
          {assignedMentor && (
            <div className="mt-4 pt-3 border-t border-brand-paper/20 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-brand-bg/90">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-gold" />
                <span>Supervising Mentor:</span>
                <strong className="text-brand-gold font-bold">
                  {assignedMentor.full_name}{assignedMentor.poraplan_id ? ` (${assignedMentor.poraplan_id})` : ''}
                </strong>
              </div>
              {profile?.poraplan_id && (
                <div className="text-[11px] text-brand-paper/70">
                  Student ID: <span className="text-brand-teal-light font-bold">{profile.poraplan_id}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Filter Controls & Reload */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 border-2 border-brand-dark bg-brand-paper p-1 shadow-brutal-xs self-start">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 font-heading text-xs font-bold transition-colors ${
                statusFilter === 'all'
                  ? 'bg-brand-navy text-brand-paper border border-brand-dark'
                  : 'text-brand-dark hover:bg-brand-bg'
              }`}
            >
              ALL PLANS ({plans.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 font-heading text-xs font-bold transition-colors ${
                statusFilter === 'active'
                  ? 'bg-brand-navy text-brand-paper border border-brand-dark'
                  : 'text-brand-dark hover:bg-brand-bg'
              }`}
            >
              ACTIVE ({plans.filter((p) => p.status === 'active').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 font-heading text-xs font-bold transition-colors ${
                statusFilter === 'completed'
                  ? 'bg-brand-navy text-brand-paper border border-brand-dark'
                  : 'text-brand-dark hover:bg-brand-bg'
              }`}
            >
              COMPLETED ({plans.filter((p) => p.status === 'completed').length})
            </button>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-heading font-bold border-2 border-brand-dark bg-brand-paper shadow-brutal-xs hover:bg-brand-bg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 border-2 border-brand-dark bg-red-50 text-brand-dark shadow-brutal flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-heading font-extrabold text-sm text-red-900">
                Unable to load study plans
              </h3>
              <p className="text-xs text-red-700 font-sans">{error}</p>
              <button
                type="button"
                onClick={loadData}
                className="mt-2 text-xs font-bold underline text-red-900 hover:text-red-950 font-mono"
              >
                Retry request
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" />
            <h2 className="font-heading font-extrabold text-sm text-brand-navy">
              RETRIEVING STUDY PLANS
            </h2>
            <span className="font-mono text-xs text-brand-muted block">
              Accessing verified student curriculum roadmaps...
            </span>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredPlans.length === 0 && (
          <section aria-labelledby="empty-plans-title" className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-brand-teal-light border-2 border-brand-dark mx-auto flex items-center justify-center shadow-brutal-xs">
              <Compass className="w-8 h-8 text-brand-navy stroke-[2.2]" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h2 id="empty-plans-title" className="font-heading font-extrabold text-lg text-brand-navy">
                NO STUDY PLANS ASSIGNED YET
              </h2>
              <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
                {statusFilter !== 'all'
                  ? `There are no study plans with status "${statusFilter}" currently.`
                  : 'Your assigned mentor has not published a study roadmap for your curriculum yet. Once your mentor organizes topics and target deadlines, they will appear here.'}
              </p>
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-2">
              <Link to="/student/subjects">
                <Button variant="outline" size="sm" leftIcon={<BookOpen className="w-3.5 h-3.5" />}>
                  View My Study Areas
                </Button>
              </Link>
              <Link to="/student/dashboard">
                <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </section>
        )}

        {/* Plans List Grid */}
        {!loading && !error && filteredPlans.length > 0 && (
          <section aria-label="Study plans list" className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {filteredPlans.map((plan) => (
              <article
                key={plan.id}
                className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 flex flex-col justify-between space-y-4 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {plan.subject_name ? (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-brand-teal-light border border-brand-dark px-2 py-0.5 text-brand-navy flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-brand-navy" />
                          {plan.subject_name}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-brand-bg border border-brand-dark px-2 py-0.5 text-brand-muted">
                          General Plan
                        </span>
                      )}
                      <Badge variant={plan.status === 'active' ? 'teal' : 'muted'} size="sm">
                        {plan.status.toUpperCase()}
                      </Badge>
                    </div>

                    <span className="font-mono text-[11px] font-bold text-brand-navy bg-brand-gold-light border border-brand-dark px-2 py-0.5 shadow-brutal-xs flex items-center gap-1">
                      <ListTodo className="w-3 h-3 text-brand-dark" />
                      {plan.items_count} {plan.items_count === 1 ? 'Topic' : 'Topics'}
                    </span>
                  </div>

                  {/* Plan Title & Description */}
                  <div>
                    <h2 className="text-base sm:text-lg font-heading font-extrabold text-brand-navy group-hover:text-brand-teal transition-colors line-clamp-2">
                      {plan.title}
                    </h2>
                    <p className="text-xs text-brand-dark/85 font-sans mt-1.5 line-clamp-3 leading-relaxed">
                      {plan.description || 'No detailed learning overview provided for this study roadmap.'}
                    </p>
                  </div>
                </div>

                {/* Footer Ribbon & Action */}
                <div className="pt-3 border-t-2 border-brand-dark flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] font-mono text-brand-muted">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {plan.created_at ? new Date(plan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                    </span>
                  </div>

                  <Link to={`/student/plans/${plan.id}`}>
                    <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      View Roadmap
                    </Button>
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* Academic Workflow Guidance Footer */}
        <section aria-labelledby="workflow-guidance-title" className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 border-2 border-brand-dark bg-brand-gold-light flex items-center justify-center shrink-0 shadow-brutal-xs">
              <Sparkles className="w-5 h-5 text-brand-dark stroke-[2.2]" />
            </div>
            <div>
              <h2 id="workflow-guidance-title" className="font-heading font-bold text-xs sm:text-sm text-brand-navy">
                Curriculum Milestone Alignment
              </h2>
              <p className="text-xs text-brand-muted font-sans">
                Each study plan feeds into daily study sessions and problem-solving assignments supervised by your mentor.
              </p>
            </div>
          </div>

          <Link to="/student/subjects" className="shrink-0">
            <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3 h-3" />}>
              Study Areas
            </Button>
          </Link>
        </section>

      </div>
    </div>
  );
};
