import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getPublicProfile } from '../../lib/profiles';
import type { PublicProfile } from '../../types/database';
import { Badge, type BadgeVariant } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  GraduationCap,
  BookOpen,
  Calendar,
  Building,
  ShieldCheck,
  ArrowLeft,
  Edit3,
  Lock,
  Sparkles,
  AlertCircle,
  Loader2,
  Award,
} from 'lucide-react';

export const PublicProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser, profile: currentProfile } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchProfile() {
      if (!id) {
        setError('No member ID provided in URL');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { profile: data, error: fetchErr } = await getPublicProfile(id);
        if (!isMounted) return;

        if (fetchErr || !data) {
          setError(fetchErr?.message || 'Academic profile could not be found or is not publicly accessible.');
          setProfile(null);
        } else {
          setProfile(data);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setProfile(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Determine if the currently logged-in user is viewing their own profile
  const isOwner = Boolean(
    profile &&
      ((currentUser?.id && currentUser.id === profile.id) ||
        (currentProfile?.poraplan_id && currentProfile.poraplan_id === profile.poraplan_id))
  );

  const getRoleBadgeVariant = (role: string): BadgeVariant => {
    switch (role) {
      case 'mentor':
        return 'gold';
      case 'admin':
        return 'navy';
      case 'student':
      default:
        return 'teal';
    }
  };

  // Helper to split comma- or newline-separated tags
  const parseTags = (text?: string): string[] => {
    if (!text) return [];
    return text
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6">
        <div className="p-8 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center max-w-sm">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto mb-3" />
          <h2 className="font-heading font-extrabold text-sm text-brand-navy uppercase tracking-wider">
            Loading Academic Profile
          </h2>
          <p className="font-mono text-xs text-brand-muted mt-1">
            Retrieving public credentials...
          </p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-brand-navy hover:text-brand-teal transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-none border-2 border-brand-dark bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-brutal-xs">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-xl text-brand-navy">
              Profile Unavailable
            </h2>
            <p className="text-sm font-sans text-brand-dark/80 max-w-md mx-auto mt-2">
              {error || 'The requested member profile was not found or has been restricted.'}
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="outline"
              size="md"
              to="/dashboard"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-3 sm:space-y-6 animate-fade-in pb-6 sm:pb-12">
      {/* Top Navigation & Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-mono font-bold text-brand-navy hover:text-brand-teal transition-colors min-h-[32px] sm:min-h-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] sm:text-[11px] text-brand-muted uppercase tracking-wider flex items-center gap-1">
            <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-teal" />
            Protected Academic Profile
          </span>
        </div>
      </div>

      {/* Owner Notice Banner */}
      {isOwner && (
        <div className="border sm:border-2 border-brand-dark bg-amber-50 p-2.5 sm:p-4 shadow-none sm:shadow-brutal-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-start gap-2 sm:gap-3">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-brand-gold shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-brand-dark uppercase tracking-wider font-mono">
                Viewing Your Public Profile
              </p>
              <p className="text-[11px] sm:text-xs text-brand-dark/80 mt-0.5">
                This is how other students and mentors see your academic identity. Sensitive contact details (phone, email) and personal academic background notes are strictly shielded.
              </p>
            </div>
          </div>
          <Button
            to="/profile"
            variant="primary"
            size="sm"
            leftIcon={<Edit3 className="w-3.5 h-3.5" />}
            className="shrink-0 min-h-[32px] sm:min-h-0 text-[11px] sm:text-xs py-1 px-2.5 sm:py-1.5 sm:px-3"
          >
            Edit Profile
          </Button>
        </div>
      )}

      {/* Hero Profile Card */}
      <div className="border sm:border-2 border-brand-dark bg-brand-paper shadow-none sm:shadow-brutal p-2.5 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2.5 sm:gap-6">
          {/* Avatar or Initial Block */}
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="w-14 h-14 sm:w-28 sm:h-28 object-cover border sm:border-2 border-brand-dark shadow-none sm:shadow-brutal-sm bg-brand-paper-tint"
            />
          ) : (
            <div className="w-14 h-14 sm:w-28 sm:h-28 border sm:border-2 border-brand-dark bg-brand-navy text-brand-bg flex items-center justify-center font-heading font-black text-xl sm:text-4xl shadow-none sm:shadow-brutal-sm">
              {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : '?'}
            </div>
          )}

          {/* Member Identity & Badges */}
          <div className="flex-1 text-center sm:text-left space-y-1 sm:space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2.5">
              <h1 className="text-base sm:text-2xl md:text-3xl font-heading font-extrabold text-brand-navy tracking-tight">
                {profile.full_name}
              </h1>
              {profile.poraplan_id && (
                <span className="font-mono text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 bg-brand-paper-tint border sm:border-2 border-brand-dark shadow-none sm:shadow-brutal-xs text-brand-navy">
                  {profile.poraplan_id}
                </span>
              )}
              <Badge variant={getRoleBadgeVariant(profile.role)}>
                {profile.role.toUpperCase()}
              </Badge>
            </div>

            {(profile.university || profile.department) && (
              <p className="text-xs sm:text-sm font-sans font-medium text-brand-dark/90 flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
                <Building className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-teal" />
                <span>
                  {[profile.department, profile.university].filter(Boolean).join(' • ')}
                </span>
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-4 pt-1 sm:pt-2 text-[10px] sm:text-xs font-mono text-brand-muted">
              {profile.batch && (
                <span className="flex items-center gap-1 sm:gap-1.5">
                  <GraduationCap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-dark" />
                  <span>Batch {profile.batch}</span>
                </span>
              )}
              {profile.current_semester && (
                <span className="flex items-center gap-1 sm:gap-1.5">
                  <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-dark" />
                  <span>Semester: {profile.current_semester}</span>
                </span>
              )}
              {profile.created_at && (
                <span className="flex items-center gap-1 sm:gap-1.5">
                  <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-dark" />
                  <span>Member since {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Details & Privacy Guardrails */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
        {/* Academic Details (2 Columns) */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-6">
          {/* Student Profile Specifics */}
          {profile.role === 'student' && (
            <div className="border sm:border-2 border-brand-dark bg-brand-paper shadow-none sm:shadow-brutal p-2.5 sm:p-6 space-y-2 sm:space-y-4">
              <div className="flex items-center gap-1.5 sm:gap-2 border-b sm:border-b-2 border-brand-dark pb-2 sm:pb-3">
                <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-brand-teal" />
                <h2 className="font-heading font-extrabold text-xs sm:text-base text-brand-navy uppercase tracking-wider">
                  Academic Curriculum & Standing
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 pt-0.5 sm:pt-1">
                <div className="border border-brand-dark/30 p-2 sm:p-3 bg-brand-paper-tint">
                  <span className="block text-[9px] sm:text-[11px] font-mono uppercase font-bold text-brand-muted">
                    Institution
                  </span>
                  <span className="font-sans font-bold text-xs sm:text-sm text-brand-navy">
                    {profile.university || 'Not specified'}
                  </span>
                </div>

                <div className="border border-brand-dark/30 p-2 sm:p-3 bg-brand-paper-tint">
                  <span className="block text-[9px] sm:text-[11px] font-mono uppercase font-bold text-brand-muted">
                    Department / Major
                  </span>
                  <span className="font-sans font-bold text-xs sm:text-sm text-brand-navy">
                    {profile.department || 'Not specified'}
                  </span>
                </div>

                <div className="border border-brand-dark/30 p-2 sm:p-3 bg-brand-paper-tint">
                  <span className="block text-[9px] sm:text-[11px] font-mono uppercase font-bold text-brand-muted">
                    Academic Batch
                  </span>
                  <span className="font-sans font-bold text-sm text-brand-navy">
                    {profile.batch || 'Not specified'}
                  </span>
                </div>

                <div className="border border-brand-dark/30 p-3 bg-brand-paper-tint">
                  <span className="block text-[11px] font-mono uppercase font-bold text-brand-muted">
                    Current Semester
                  </span>
                  <span className="font-sans font-bold text-sm text-brand-navy">
                    {profile.current_semester || 'Not specified'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Mentor Profile Specifics */}
          {profile.role === 'mentor' && (
            <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 space-y-5">
              <div className="flex items-center gap-2 border-b-2 border-brand-dark pb-3">
                <Award className="w-5 h-5 text-brand-gold" />
                <h2 className="font-heading font-extrabold text-base text-brand-navy uppercase tracking-wider">
                  Mentorship Specialization & Domain
                </h2>
              </div>

              {/* Core Expertise Tags */}
              <div>
                <span className="block text-[11px] font-mono uppercase font-bold text-brand-muted mb-2">
                  Core Subject Expertise
                </span>
                {profile.expertise ? (
                  <div className="flex flex-wrap gap-2">
                    {parseTags(profile.expertise).map((item, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 text-xs font-mono font-bold bg-brand-gold text-brand-dark border-2 border-brand-dark shadow-brutal-xs"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-sans text-brand-muted italic">
                    General Academic Mentor
                  </p>
                )}
              </div>

              {/* Mentoring Subjects */}
              <div>
                <span className="block text-[11px] font-mono uppercase font-bold text-brand-muted mb-2">
                  Mentoring Subjects & Topics
                </span>
                {profile.mentoring_subjects ? (
                  <div className="flex flex-wrap gap-2">
                    {parseTags(profile.mentoring_subjects).map((subj, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 text-xs font-mono font-bold bg-brand-teal text-white border-2 border-brand-dark shadow-brutal-xs"
                      >
                        {subj}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-sans text-brand-muted italic">
                    All Enrolled Subjects
                  </p>
                )}
              </div>
            </div>
          )}

          {/* About / Academic Bio */}
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 space-y-3">
            <div className="flex items-center gap-2 border-b-2 border-brand-dark pb-3">
              <BookOpen className="w-5 h-5 text-brand-navy" />
              <h2 className="font-heading font-extrabold text-base text-brand-navy uppercase tracking-wider">
                Academic Biography
              </h2>
            </div>

            {profile.bio ? (
              <p className="font-sans text-sm text-brand-dark/90 leading-relaxed whitespace-pre-line bg-brand-paper p-4 border border-brand-dark/30">
                {profile.bio}
              </p>
            ) : (
              <p className="text-xs font-sans text-brand-muted italic p-2">
                No biography has been added yet.
              </p>
            )}
          </div>
        </div>

        {/* Right Sidebar: Privacy Safeguard & Verification Card */}
        <div className="space-y-6">
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-brand-dark pb-2.5">
              <ShieldCheck className="w-5 h-5 text-brand-teal" />
              <h3 className="font-heading font-bold text-sm text-brand-navy uppercase tracking-wider">
                Academic Privacy Gate
              </h3>
            </div>

            <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
              PoraPlan enforces database-level privacy boundaries. In keeping with our academic focus, personal contact information and sensitive notes are strictly shielded.
            </p>

            <div className="border-2 border-brand-dark bg-brand-paper-tint p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-brand-navy">
                <Lock className="w-3.5 h-3.5 text-brand-teal" />
                <span>Protected Fields</span>
              </div>
              <ul className="text-[11px] font-mono text-brand-muted space-y-1 list-disc list-inside">
                <li>Personal Phone & WhatsApp</li>
                <li>Email Addresses</li>
                <li>Academic Background & Private Notes</li>
                <li>Internal Mentor Notes</li>
                <li>Private Enrollment Data</li>
              </ul>
            </div>

            <div className="pt-2 text-center">
              <p className="text-[10px] font-mono uppercase tracking-wider text-brand-muted">
                PoraPlan Mentorship Ecosystem
              </p>
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div className="border-2 border-brand-dark bg-brand-paper-tint p-4 shadow-brutal-sm space-y-3">
            <span className="block text-[11px] font-mono uppercase font-bold text-brand-navy">
              Collaborative Channels
            </span>
            <div className="space-y-2">
              <Link
                to="/student/doubts"
                className="w-full flex items-center justify-between p-2.5 bg-brand-paper border-2 border-brand-dark text-xs font-mono font-bold text-brand-navy shadow-brutal-xs hover:bg-brand-paper-tint transition-colors"
              >
                <span>Academic Doubts Desk</span>
                <span className="text-brand-teal">&rarr;</span>
              </Link>
              <Link
                to="/student/library"
                className="w-full flex items-center justify-between p-2.5 bg-brand-paper border-2 border-brand-dark text-xs font-mono font-bold text-brand-navy shadow-brutal-xs hover:bg-brand-paper-tint transition-colors"
              >
                <span>Academic Library</span>
                <span className="text-brand-teal">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
