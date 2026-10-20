import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getAssignedMentors } from '../../lib/mentorship';
import type { Profile } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Calendar,
  Target,
  ListTodo,
  TrendingUp,
  Users,
  Compass,
  Clock,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Mail,
  BookOpen,
  FileCheck,
  Award,
  ChevronRight,
  X,
  Bell,
  Check,
  Edit3,
  Trash2,
} from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const { user, profile, role, poraplanId, connectEmail } = useAuth();
  const [mentors, setMentors] = useState<Profile[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(() => Boolean(user?.id));
  
  // Email connection banner state
  const [emailInput, setEmailInput] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  // Today's Study Focus state (persisted per student in session storage)
  const storageKey = `poraplan_today_focus_${user?.id || 'active'}`;
  const [todayFocus, setTodayFocus] = useState<string>(() => {
    try {
      return sessionStorage.getItem(storageKey) || '';
    } catch {
      return '';
    }
  });
  const [isFocusCompleted, setIsFocusCompleted] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(`${storageKey}_completed`) === 'true';
    } catch {
      return false;
    }
  });
  const [isEditingFocus, setIsEditingFocus] = useState<boolean>(false);
  const [focusInputValue, setFocusInputValue] = useState<string>('');

  // Informative Modals for Quick Links
  const [activeModal, setActiveModal] = useState<'my-study' | 'assignments' | 'doubts' | null>(null);
  const [doubtText, setDoubtText] = useState('');
  const [doubtSentMsg, setDoubtSentMsg] = useState<string | null>(null);

  // Notification dismiss state
  const [dismissNotifications, setDismissNotifications] = useState(false);

  // Fetch real mentor pairings from database
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    getAssignedMentors(user.id).then(({ mentors: assignedList }) => {
      if (isMounted) {
        setMentors(assignedList);
        setLoadingMentors(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleLinkEmail = async () => {
    if (!emailInput.trim()) return;
    setIsLinking(true);
    setLinkMsg(null);
    const { error } = await connectEmail(emailInput.trim());
    if (error) {
      setLinkMsg(`Error: ${error.message}`);
    } else {
      setLinkMsg('Personal email linked successfully!');
      setEmailInput('');
    }
    setIsLinking(false);
  };

  const handleSaveFocus = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = focusInputValue.trim();
    if (!clean) return;
    setTodayFocus(clean);
    setIsFocusCompleted(false);
    setIsEditingFocus(false);
    try {
      sessionStorage.setItem(storageKey, clean);
      sessionStorage.setItem(`${storageKey}_completed`, 'false');
    } catch {
      // Storage unavailable
    }
  };

  const handleToggleFocusComplete = () => {
    const next = !isFocusCompleted;
    setIsFocusCompleted(next);
    try {
      sessionStorage.setItem(`${storageKey}_completed`, String(next));
    } catch {
      // Storage unavailable
    }
  };

  const handleClearFocus = () => {
    setTodayFocus('');
    setIsFocusCompleted(false);
    setIsEditingFocus(false);
    setFocusInputValue('');
    try {
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(`${storageKey}_completed`);
    } catch {
      // Storage unavailable
    }
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const studentName = profile?.full_name || user?.user_metadata?.full_name || 'Academic Scholar';
  const assignedMentor = mentors.length > 0 ? mentors[0] : null;

  return (
    <div className="w-full py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* ========================================================================= */}
        {/* 1. GREETING & "WHAT SHOULD I DO NOW?" ORIENTATION HEADER                 */}
        {/* ========================================================================= */}
        <section
          aria-labelledby="student-greeting"
          className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-4 sm:p-7 shadow-brutal space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
                  STUDENT WORKSPACE
                </span>
                <Badge variant="teal" size="sm">ACTIVE SESSION</Badge>
              </div>

              <h1 id="student-greeting" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg tracking-tight">
                Welcome, {studentName}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-brand-bg/85 pt-0.5">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                  {currentDate}
                </span>
                <span>•</span>
                <span className="font-bold text-brand-gold">
                  ID: {poraplanId || profile?.poraplan_id || 'PP001'}
                </span>
                <span>•</span>
                <span className="uppercase text-brand-teal font-bold">{role || 'Student'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start">
              <div className="px-3 py-1.5 border-2 border-brand-dark bg-brand-paper text-brand-dark text-xs font-mono font-bold shadow-brutal-xs flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <span>RLS Protected</span>
              </div>
            </div>
          </div>

          {/* "What Should I Do Now?" Immediate Orientation Bar */}
          <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-gold text-brand-dark shadow-brutal-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-mono text-xs font-extrabold tracking-wide uppercase">
                  <Sparkles className="w-4 h-4 text-brand-navy shrink-0 stroke-[2.5]" />
                  <span>WHAT SHOULD I DO NOW?</span>
                </div>
                <p className="text-xs font-sans font-medium text-brand-dark/90 leading-relaxed">
                  {todayFocus ? (
                    <>
                      <span className="font-bold">Active Priority:</span> Work on your focus goal:{' '}
                      <span className="font-extrabold underline decoration-brand-navy/60">{todayFocus}</span>.{' '}
                      {isFocusCompleted ? 'Great job! Target marked complete.' : 'Complete your reading and practice exercises.'}
                    </>
                  ) : (
                    <>
                      <span className="font-bold">Immediate Next Action:</span> Set your{' '}
                      <span className="font-bold underline">Today's Study Focus</span> below (Step 1: Plan) to anchor your study session.
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!todayFocus ? (
                  <a
                    href="#focus"
                    onClick={() => {
                      setIsEditingFocus(true);
                      setFocusInputValue('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-brand-dark bg-brand-navy text-brand-bg text-xs font-mono font-bold shadow-brutal-xs hover:bg-brand-dark transition-colors"
                  >
                    <span>Set Today's Focus</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handleToggleFocusComplete}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-brand-dark text-xs font-mono font-bold shadow-brutal-xs transition-colors ${
                      isFocusCompleted
                        ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                        : 'bg-brand-navy text-brand-bg hover:bg-brand-dark'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isFocusCompleted ? 'Completed ✓' : 'Mark Completed'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. RELEVANT NOTIFICATIONS & NOTICE BOARD                                  */}
        {/* ========================================================================= */}
        {!dismissNotifications && (
          <section
            aria-label="Academic Notice Board"
            className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center justify-between border-b-2 border-brand-dark/20 pb-2.5">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-teal stroke-[2.5]" />
                <h2 className="font-heading font-extrabold text-xs sm:text-sm text-brand-navy uppercase tracking-wider">
                  Academic Notice Board &amp; System Alerts
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDismissNotifications(true)}
                className="text-brand-muted hover:text-brand-dark p-1 text-[11px] font-mono flex items-center gap-1"
                aria-label="Dismiss notifications"
              >
                <span>Dismiss</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Mentorship pairing status notice */}
              <div className="p-3 border-2 border-brand-dark bg-brand-teal-light/40 flex items-start gap-2.5">
                <Users className="w-4 h-4 text-brand-teal shrink-0 mt-0.5 stroke-[2.2]" />
                <div className="space-y-0.5">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                    MENTORSHIP STATUS
                  </span>
                  <p className="font-sans text-brand-dark">
                    {loadingMentors
                      ? 'Checking assigned mentor database records...'
                      : assignedMentor
                      ? `Paired with ${assignedMentor.full_name}. Problem set evaluations and review feedback route directly to your mentor.`
                      : 'Independent study track active. You can record daily focus notes while awaiting mentor pairing.'}
                  </p>
                </div>
              </div>

              {/* Study workflow notice */}
              <div className="p-3 border-2 border-brand-dark bg-brand-navy-light/40 flex items-start gap-2.5">
                <Compass className="w-4 h-4 text-brand-navy shrink-0 mt-0.5 stroke-[2.2]" />
                <div className="space-y-0.5">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-navy">
                    7-STEP STUDY CYCLE
                  </span>
                  <p className="font-sans text-brand-dark">
                    PoraPlan workflow: <span className="font-semibold">Plan → Study → Practice → Submit → Review → Feedback → Progress</span>.
                  </p>
                </div>
              </div>
            </div>

            {/* Email Link Prompt Banner (if personal email not yet connected) */}
            {!profile?.linked_email && (
              <div className="p-3 border-2 border-brand-dark bg-brand-gold-light flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-brand-navy">
                    <Mail className="w-3.5 h-3.5 text-brand-navy shrink-0" />
                    <span>CONNECT YOUR PERSONAL EMAIL</span>
                  </div>
                  <p className="text-xs text-brand-dark/85 font-sans">
                    Link your personal email address to enable self-service password recovery and Google sign-in.
                  </p>
                  {linkMsg && (
                    <p className="text-[11px] font-sans font-bold text-emerald-800 pt-0.5">{linkMsg}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="student@example.com"
                    className="px-2.5 py-1 text-xs border-2 border-brand-dark bg-brand-paper font-sans"
                  />
                  <button
                    type="button"
                    onClick={handleLinkEmail}
                    disabled={isLinking}
                    className="px-3 py-1 border-2 border-brand-dark bg-brand-navy text-brand-bg text-xs font-mono font-bold hover:bg-brand-dark shadow-brutal-xs"
                  >
                    {isLinking ? 'Linking...' : 'Connect'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ========================================================================= */}
        {/* 3. BASIC PROGRESS SUMMARY                                                 */}
        {/* ========================================================================= */}
        <section id="progress" aria-labelledby="progress-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="progress-title" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-teal stroke-[2.5]" />
              Basic Progress Summary
            </h2>
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted bg-brand-paper border border-brand-dark px-2 py-0.5 shadow-brutal-xs">
              HONEST METRICS
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Metric 1: Streak */}
            <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  STUDY STREAK
                </span>
                <Clock className="w-4 h-4 text-brand-gold stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                -- <span className="text-xs font-mono font-normal text-brand-muted">Days</span>
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                Starts on first logged session
              </span>
            </div>

            {/* Metric 2: Today's Focus */}
            <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  TODAY'S FOCUS
                </span>
                <Target className="w-4 h-4 text-brand-teal stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                {todayFocus ? (isFocusCompleted ? '1 / 1' : '1 Active') : '0 / 1'}
              </div>
              <span className="text-[10px] font-mono text-brand-teal font-bold mt-1">
                {todayFocus ? (isFocusCompleted ? 'Target Achieved ✓' : 'In Progress') : 'Not Set Today'}
              </span>
            </div>

            {/* Metric 3: Practice Submissions */}
            <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  SUBMISSIONS
                </span>
                <CheckCircle2 className="w-4 h-4 text-brand-navy stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                0 <span className="text-xs font-mono font-normal text-brand-muted">Sets</span>
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                Awaiting mentor assignment
              </span>
            </div>

            {/* Metric 4: Mentor Track */}
            <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  MENTOR STATUS
                </span>
                <Users className="w-4 h-4 text-brand-gold stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-sm sm:text-base text-brand-navy truncate">
                {loadingMentors ? 'Checking...' : assignedMentor ? assignedMentor.full_name : 'Self-Paced'}
              </div>
              <span className="text-[10px] font-mono text-brand-teal font-bold mt-1">
                {assignedMentor ? 'Mentor Assigned' : 'Self-Paced Track'}
              </span>
            </div>
          </div>

          {/* 7-Step Study Workflow Visual Tracker */}
          <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper-tint shadow-brutal-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                STUDY CYCLE PROGRESSION
              </span>
              <span className="font-mono text-[10px] text-brand-navy font-bold">
                {todayFocus ? 'Step 2: Study & Step 3: Practice' : 'Step 1: Plan'}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px]">
              <div className={`p-1 border border-brand-dark font-bold ${!todayFocus ? 'bg-brand-gold text-brand-dark' : 'bg-brand-paper text-brand-dark'}`}>
                1. Plan
              </div>
              <div className={`p-1 border border-brand-dark font-bold ${todayFocus && !isFocusCompleted ? 'bg-brand-teal text-white' : 'bg-brand-paper text-brand-muted'}`}>
                2. Study
              </div>
              <div className={`p-1 border border-brand-dark font-bold ${todayFocus && isFocusCompleted ? 'bg-brand-teal text-white' : 'bg-brand-paper text-brand-muted'}`}>
                3. Practice
              </div>
              <div className="p-1 border border-brand-dark bg-brand-paper text-brand-muted font-bold">
                4. Submit
              </div>
              <div className="p-1 border border-brand-dark bg-brand-paper text-brand-muted font-bold">
                5. Review
              </div>
              <div className="p-1 border border-brand-dark bg-brand-paper text-brand-muted font-bold">
                6. Feedback
              </div>
              <div className="p-1 border border-brand-dark bg-brand-paper text-brand-muted font-bold">
                7. Progress
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. PRIMARY STUDY GRID: TODAY'S FOCUS & TODAY'S TASKS                      */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          
          {/* Today's Focus Card */}
          <section
            id="focus"
            aria-labelledby="focus-title"
            className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                  <h2 id="focus-title" className="font-heading font-extrabold text-base text-brand-navy">
                    Today's Study Focus
                  </h2>
                </div>
                <Badge variant={todayFocus ? (isFocusCompleted ? 'teal' : 'gold') : 'muted'} size="sm">
                  {todayFocus ? (isFocusCompleted ? 'COMPLETED' : 'ACTIVE FOCUS') : 'NO FOCUS SET'}
                </Badge>
              </div>

              {isEditingFocus ? (
                /* Focus Setting / Editing Form */
                <form onSubmit={handleSaveFocus} className="space-y-3 p-4 border-2 border-brand-dark bg-brand-paper-tint">
                  <label htmlFor="focus-input" className="block font-mono text-xs font-bold text-brand-navy uppercase">
                    Define Your Daily Focus Topic:
                  </label>
                  <input
                    id="focus-input"
                    type="text"
                    value={focusInputValue}
                    onChange={(e) => setFocusInputValue(e.target.value)}
                    placeholder="e.g. Physics: Wave Mechanics Chapter 3"
                    className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-brand-paper font-sans"
                    autoFocus
                  />
                  <div className="text-[11px] font-mono text-brand-muted">
                    Quick suggestions:{' '}
                    <button
                      type="button"
                      onClick={() => setFocusInputValue('Mathematics: Calculus & Derivatives')}
                      className="underline text-brand-navy hover:text-brand-teal mr-2"
                    >
                      Math
                    </button>
                    <button
                      type="button"
                      onClick={() => setFocusInputValue('Physics: Thermodynamics & Work')}
                      className="underline text-brand-navy hover:text-brand-teal mr-2"
                    >
                      Physics
                    </button>
                    <button
                      type="button"
                      onClick={() => setFocusInputValue('Chemistry: Organic Reaction Mechanisms')}
                      className="underline text-brand-navy hover:text-brand-teal"
                    >
                      Chemistry
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button type="submit" size="sm" variant="primary">
                      Save Daily Focus
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingFocus(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : todayFocus ? (
                /* Active Focus Display */
                <div className="p-4 border-2 border-brand-dark bg-brand-teal-light/50 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                        SESSION FOCUS TARGET
                      </span>
                      <h3 className={`font-heading font-extrabold text-base text-brand-navy ${isFocusCompleted ? 'line-through text-brand-muted' : ''}`}>
                        {todayFocus}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setFocusInputValue(todayFocus);
                          setIsEditingFocus(true);
                        }}
                        className="p-1 border border-brand-dark bg-brand-paper text-brand-dark hover:bg-brand-gold-light"
                        title="Edit Focus Topic"
                        aria-label="Edit focus topic"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleClearFocus}
                        className="p-1 border border-brand-dark bg-brand-paper text-brand-dark hover:bg-red-50 hover:text-red-700"
                        title="Clear Focus"
                        aria-label="Clear focus topic"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-brand-dark/85 font-sans leading-relaxed">
                    {isFocusCompleted
                      ? 'Congratulations on finishing your target! You can proceed to practice problem sets or set a new topic.'
                      : 'Concentrate on your core concepts and practice exercises. Mark as completed when your study block concludes.'}
                  </p>

                  <div className="pt-2 border-t border-brand-dark/20 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleToggleFocusComplete}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-brand-dark text-xs font-mono font-bold shadow-brutal-xs transition-colors ${
                        isFocusCompleted
                          ? 'bg-emerald-700 text-white'
                          : 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isFocusCompleted ? 'Target Completed ✓' : 'Mark Target As Completed'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Empty State Card */
                <div className="p-5 border-2 border-dashed border-brand-dark/40 bg-brand-paper-tint text-center space-y-2.5 my-2">
                  <div className="w-10 h-10 border-2 border-brand-dark bg-brand-teal-light rounded-none mx-auto flex items-center justify-center">
                    <Target className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-sm text-brand-navy">
                      No Focus Goal Set For Today
                    </h3>
                    <p className="text-xs text-brand-muted font-sans mt-1 max-w-sm mx-auto leading-relaxed">
                      Setting a daily focus defines the primary chapter or concept you study today, keeping your session disciplined.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setFocusInputValue('');
                      setIsEditingFocus(true);
                    }}
                    className="mt-2"
                  >
                    Set Today's Focus Goal
                  </Button>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
              <span>Step 1 &amp; 2: Plan &amp; Study</span>
              <span className="font-bold text-brand-dark">Active Session</span>
            </div>
          </section>

          {/* Today's Tasks Card */}
          <section
            id="tasks"
            aria-labelledby="tasks-title"
            className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                  <h2 id="tasks-title" className="font-heading font-extrabold text-base text-brand-navy">
                    Today's Tasks
                  </h2>
                </div>
                <Badge variant="muted" size="sm">0 SCHEDULED</Badge>
              </div>

              {/* Explicit Empty State Card */}
              <div className="p-5 border-2 border-dashed border-brand-dark/40 bg-brand-paper-tint text-center space-y-2.5 my-2">
                <div className="w-10 h-10 border-2 border-brand-dark bg-brand-gold-light rounded-none mx-auto flex items-center justify-center">
                  <ListTodo className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-brand-navy">
                    Your Task Queue Is Empty
                  </h3>
                  <p className="text-xs text-brand-muted font-sans mt-1 max-w-sm mx-auto leading-relaxed">
                    Tasks scheduled by you or assigned by your mentor (reading chapters, problem sets, and revision checkpoints) will appear here in order of priority.
                  </p>
                </div>

                <div className="p-2.5 border border-brand-dark/20 bg-brand-paper text-left text-xs font-mono space-y-1">
                  <span className="text-[10px] text-brand-muted uppercase block font-bold">Standard Task Structure:</span>
                  <div className="text-brand-dark text-[11px] flex items-center justify-between">
                    <span>• Priority &amp; Subject</span>
                    <span className="text-brand-muted">High / Medium / Low</span>
                  </div>
                  <div className="text-brand-dark text-[11px] flex items-center justify-between">
                    <span>• Duration &amp; Target</span>
                    <span className="text-brand-muted">50 min disciplined block</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
              <span>Step 3: Practice &amp; Homework</span>
              <span className="font-bold text-brand-dark">Queue Empty</span>
            </div>
          </section>

        </div>

        {/* ========================================================================= */}
        {/* 5. UPCOMING EVALUATION                                                    */}
        {/* ========================================================================= */}
        <section
          id="evaluations"
          aria-labelledby="evaluations-title"
          className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-brand-navy stroke-[2.5]" />
              <h2 id="evaluations-title" className="font-heading font-extrabold text-base text-brand-navy">
                Upcoming Evaluation
              </h2>
            </div>
            <Badge variant="muted" size="sm">0 SCHEDULED</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="md:col-span-2 space-y-2">
              <h3 className="font-heading font-bold text-sm text-brand-navy">
                No Milestone Evaluations Scheduled
              </h3>
              <p className="text-xs text-brand-muted font-sans leading-relaxed">
                In PoraPlan, evaluations are milestone checks and mentor reviews that occur after you submit completed problem sets (Step 5: Review → Step 6: Feedback). Your mentor schedules evaluations to measure concept retention and calibrates your upcoming study plan.
              </p>
              <div className="pt-1 flex flex-wrap gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 border border-brand-dark bg-brand-paper-tint text-brand-navy font-bold">
                  Format: Oral or Written Check
                </span>
                <span className="px-2 py-0.5 border border-brand-dark bg-brand-paper-tint text-brand-teal font-bold">
                  Trigger: Post-Assignment Submission
                </span>
              </div>
            </div>

            <div className="p-4 border-2 border-brand-dark bg-brand-paper-tint space-y-2 text-xs font-mono">
              <div className="flex items-center gap-1.5 font-bold text-brand-navy">
                <CheckCircle2 className="w-4 h-4 text-brand-teal" />
                <span>EVALUATION PROTOCOL</span>
              </div>
              <ul className="space-y-1 text-[11px] text-brand-muted">
                <li>• Step 4: Submit assignment</li>
                <li>• Step 5: Mentor review &amp; grading</li>
                <li>• Step 6: Detailed feedback session</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. QUICK LINKS: MY STUDY, ASSIGNMENTS, AND DOUBTS                         */}
        {/* ========================================================================= */}
        <section id="quick-links" aria-labelledby="quick-links-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="quick-links-title" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy flex items-center gap-2">
              <Compass className="w-4 h-4 text-brand-navy stroke-[2.5]" />
              Quick Links: Academic Workspace
            </h2>
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
              PRIMARY MODULES
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            
            {/* Quick Link 1: My Study */}
            <div
              onClick={() => setActiveModal('my-study')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveModal('my-study');
                }
              }}
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                    STEP 1 &amp; 2 • PLAN &amp; STUDY
                  </span>
                  <BookOpen className="w-4 h-4 text-brand-dark group-hover:text-brand-teal transition-colors" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal transition-colors">
                  My Study
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Access disciplined study routines, chapter-wise guidance, and syllabus milestone trackers.
                </p>
              </div>

              <div className="mt-4 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy group-hover:text-brand-teal">
                <span>View Study Routine</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Quick Link 2: Assignments */}
            <div
              onClick={() => setActiveModal('assignments')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveModal('assignments');
                }
              }}
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-gold">
                    STEP 3 &amp; 4 • PRACTICE &amp; SUBMIT
                  </span>
                  <FileCheck className="w-4 h-4 text-brand-dark group-hover:text-brand-gold transition-colors" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-gold transition-colors">
                  Assignments
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Submit completed homework problem sets and view mentor feedback and correction notes.
                </p>
              </div>

              <div className="mt-4 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy group-hover:text-brand-gold">
                <span>View Assignments Queue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Quick Link 3: Doubts */}
            <div
              onClick={() => setActiveModal('doubts')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveModal('doubts');
                }
              }}
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-navy">
                    STEP 6 • FEEDBACK &amp; QUERY
                  </span>
                  <HelpCircle className="w-4 h-4 text-brand-dark group-hover:text-brand-navy transition-colors" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-navy transition-colors">
                  Doubts &amp; Inquiries
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Stuck on a tricky calculation or concept? Send your inquiry directly to your assigned mentor.
                </p>
              </div>

              <div className="mt-4 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Ask Mentor A Doubt</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* 7. MENTORSHIP STATUS SECTION                                             */}
        {/* ========================================================================= */}
        <section
          id="mentorship"
          aria-labelledby="mentorship-title"
          className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-navy stroke-[2.5]" />
              <h2 id="mentorship-title" className="font-heading font-extrabold text-base text-brand-navy">
                Your Mentor
              </h2>
            </div>
            <Badge variant={mentors.length > 0 ? 'teal' : 'paper'} size="sm">
              {loadingMentors ? 'CHECKING...' : mentors.length > 0 ? 'MENTOR ASSIGNED' : 'SELF-PACED'}
            </Badge>
          </div>

          {loadingMentors ? (
            <div className="p-4 text-center font-mono text-xs text-brand-muted">
              Checking assigned mentor status in Supabase database...
            </div>
          ) : mentors.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-brand-dark font-sans leading-relaxed">
                You have an assigned mentor. Your mentor reviews your practice submissions, answers your conceptual doubts, and guides your study targets:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {mentors.map((mentor) => (
                  <div
                    key={mentor.id}
                    className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-heading font-bold text-sm text-brand-navy">
                        {mentor.full_name}
                      </h3>
                      <p className="font-mono text-[11px] text-brand-muted mt-0.5">
                        {mentor.email}
                      </p>
                    </div>
                    <Badge variant="gold" size="sm">MENTOR</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 border-2 border-brand-dark bg-brand-teal-light/50 space-y-2">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-brand-teal stroke-[2.5]" />
                <span className="font-mono text-xs font-bold uppercase text-brand-dark">
                  Self-Paced Study Track
                </span>
              </div>
              <p className="text-xs text-brand-dark/85 font-sans leading-relaxed">
                You are currently studying independently. When a mentor is paired with your account by the administrator, their feedback, problem sets, and review evaluations will appear here automatically.
              </p>
            </div>
          )}
        </section>

      </div>

      {/* ========================================================================= */}
      {/* 8. WORKSPACE MODALS (MY STUDY, ASSIGNMENTS, DOUBTS)                       */}
      {/* ========================================================================= */}

      {/* MODAL 1: MY STUDY */}
      {activeModal === 'my-study' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="my-study-title"
        >
          <div className="w-full max-w-lg bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                <h2 id="my-study-title" className="font-heading font-extrabold text-lg text-brand-navy">
                  My Study Routine &amp; Syllabus
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 border-2 border-brand-dark bg-brand-paper-tint hover:bg-brand-paper shadow-brutal-xs"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-brand-dark" />
              </button>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="p-3.5 border-2 border-brand-dark bg-brand-teal-light/40 space-y-1.5">
                <span className="font-mono text-[10px] font-bold uppercase text-brand-teal block">
                  THE DISCIPLINED 50/10 ROUTINE
                </span>
                <p className="text-brand-dark leading-relaxed">
                  PoraPlan recommends 50-minute intense study blocks followed by a mandatory 10-minute mental rest. Never study passively; write notes and summarize concepts in your own words.
                </p>
              </div>

              <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-2">
                <span className="font-mono text-[10px] font-bold uppercase text-brand-navy block">
                  CURRENT SYLLABUS STATUS
                </span>
                <p className="text-brand-muted leading-relaxed">
                  Chapter-wise curriculum tracking and syllabus milestones are undergoing backend schema preparation. For now, use your <span className="font-bold text-brand-dark">Today's Study Focus</span> block to log and track your active study sessions.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setActiveModal(null)}
                >
                  Understood
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ASSIGNMENTS */}
      {activeModal === 'assignments' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignments-title"
        >
          <div className="w-full max-w-lg bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                <h2 id="assignments-title" className="font-heading font-extrabold text-lg text-brand-navy">
                  Assignments &amp; Practice Queue
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 border-2 border-brand-dark bg-brand-paper-tint hover:bg-brand-paper shadow-brutal-xs"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-brand-dark" />
              </button>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase text-brand-muted">
                    SUBMISSION QUEUE
                  </span>
                  <Badge variant="muted" size="sm">0 PENDING</Badge>
                </div>
                <p className="text-brand-dark leading-relaxed">
                  No homework or problem sets have been assigned yet. When your mentor distributes an assignment, it will appear here along with the due date and submission criteria.
                </p>
              </div>

              <div className="p-3.5 border-2 border-brand-dark bg-brand-gold-light/40 space-y-1.5 font-mono text-[11px]">
                <span className="font-bold text-brand-navy block uppercase text-[10px]">
                  PRACTICE PROTOCOL (STEP 3 &amp; 4)
                </span>
                <p className="text-brand-dark/85 leading-relaxed font-sans text-xs">
                  Submissions must be completed on paper and scanned as a clear PDF or photo. Mentors inspect handwritten derivations to identify logical gaps and provide targeted review comments.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setActiveModal(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DOUBTS */}
      {activeModal === 'doubts' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doubts-title"
        >
          <div className="w-full max-w-lg bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand-navy stroke-[2.5]" />
                <h2 id="doubts-title" className="font-heading font-extrabold text-lg text-brand-navy">
                  Doubts &amp; Academic Inquiries
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setDoubtSentMsg(null);
                }}
                className="p-1 border-2 border-brand-dark bg-brand-paper-tint hover:bg-brand-paper shadow-brutal-xs"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-brand-dark" />
              </button>
            </div>

            <div className="space-y-3 font-sans text-xs">
              {assignedMentor ? (
                <div className="p-3 border-2 border-brand-dark bg-brand-teal-light/40 space-y-1">
                  <span className="font-mono text-[10px] font-bold uppercase text-brand-teal block">
                    ASSIGNED MENTOR
                  </span>
                  <p className="font-bold text-brand-navy text-sm font-heading">
                    {assignedMentor.full_name}
                  </p>
                  <p className="font-mono text-[11px] text-brand-muted">
                    {assignedMentor.email}
                  </p>
                </div>
              ) : (
                <div className="p-3 border-2 border-brand-dark bg-brand-gold-light/40 space-y-1">
                  <span className="font-mono text-[10px] font-bold uppercase text-brand-gold block">
                    SELF-PACED NOTICE
                  </span>
                  <p className="text-brand-dark">
                    You do not have a dedicated mentor assigned yet. Inquiries will be logged for administrative assignment.
                  </p>
                </div>
              )}

              {doubtSentMsg ? (
                <div className="p-3 border-2 border-brand-dark bg-emerald-50 text-emerald-900 font-medium">
                  {doubtSentMsg}
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="doubt-textarea" className="block font-mono text-[11px] font-bold text-brand-navy uppercase">
                    Your Question or Conceptual Doubt:
                  </label>
                  <textarea
                    id="doubt-textarea"
                    rows={4}
                    value={doubtText}
                    onChange={(e) => setDoubtText(e.target.value)}
                    placeholder="Describe the exact step or question where you feel stuck (e.g. Physics Chapter 3 Problem #14: I am unable to resolve the tangential acceleration vector)..."
                    className="w-full p-2.5 text-xs border-2 border-brand-dark bg-brand-paper font-sans"
                  />
                  <p className="font-mono text-[10px] text-brand-muted">
                    Be specific: mentioning chapter, question number, and your thought process gets the best mentor feedback.
                  </p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between border-t border-brand-dark/20">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveModal(null);
                    setDoubtSentMsg(null);
                  }}
                >
                  Close
                </Button>
                {!doubtSentMsg && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      if (!doubtText.trim()) return;
                      setDoubtSentMsg('Your doubt inquiry has been recorded. Your mentor will review it during your next study evaluation.');
                      setDoubtText('');
                    }}
                  >
                    Submit Doubt
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
