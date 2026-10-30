import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { updateProfile, uploadAvatar } from '../../lib/profiles';
import { Badge, type BadgeVariant } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Mail,
  Phone,
  GraduationCap,
  BookOpen,
  ShieldCheck,
  Camera,
  CheckCircle2,
  AlertCircle,
  Save,
  X,
  Edit3,
  Info,
  Loader2,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, profile, role, poraplanId, refreshProfile, connectEmail } = useAuth();
  const userId = user?.id || '';

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Email connection banner state
  const [emailToLink, setEmailToLink] = useState('');
  const [isLinkingEmail, setIsLinkingEmail] = useState(false);
  const [emailLinkMessage, setEmailLinkMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form state initialized directly from profile
  const [formData, setFormData] = useState(() => ({
    fullName: profile?.full_name || '',
    whatsappNumber: profile?.whatsapp_number || '',
    university: profile?.university || '',
    department: profile?.department || '',
    batch: profile?.batch || '',
    currentSemester: profile?.current_semester || '',
    academicBackground: profile?.academic_background || '',
    expertise: profile?.expertise || '',
    mentoringSubjects: profile?.mentoring_subjects || '',
    bio: profile?.bio || '',
  }));

  const handleStartEditing = () => {
    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        whatsappNumber: profile.whatsapp_number || '',
        university: profile.university || '',
        department: profile.department || '',
        batch: profile.batch || '',
        currentSemester: profile.current_semester || '',
        academicBackground: profile.academic_background || '',
        expertise: profile.expertise || '',
        mentoringSubjects: profile.mentoring_subjects || '',
        bio: profile.bio || '',
      });
    }
    setIsEditing(true);
    setErrorMessage(null);
  };

  // Clear notifications after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const isStudent = role === 'student';
  const isMentor = role === 'mentor';
  const isAdmin = role === 'admin';

  const roleLabel = isStudent ? 'Student' : isMentor ? 'Mentor' : isAdmin ? 'Administrator' : 'Scholar';
  const roleBadgeVariant: BadgeVariant = isStudent ? 'teal' : isMentor ? 'gold' : 'navy';

  const userInitials = (profile?.full_name || user?.email || 'P')
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    if (!formData.fullName.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { profile: updated, error } = await updateProfile(userId, {
      full_name: formData.fullName.trim(),
      whatsapp_number: formData.whatsappNumber.trim() || null,
      university: formData.university.trim() || null,
      department: formData.department.trim() || null,
      batch: formData.batch.trim() || null,
      current_semester: formData.currentSemester.trim() || null,
      academic_background: formData.academicBackground.trim() || null,
      expertise: formData.expertise.trim() || null,
      mentoring_subjects: formData.mentoringSubjects.trim() || null,
      bio: formData.bio.trim() || null,
    });

    setIsSaving(false);

    if (error || !updated) {
      setErrorMessage(error?.message || 'Failed to update profile. Please try again.');
    } else {
      await refreshProfile();
      setSuccessMessage('Profile information saved successfully.');
      setIsEditing(false);
    }
  };

  const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !userId) return;

    const file = files[0];
    setIsUploadingAvatar(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { avatarUrl, error } = await uploadAvatar(userId, file);
    setIsUploadingAvatar(false);

    if (error || !avatarUrl) {
      setErrorMessage(error?.message || 'Failed to upload avatar image.');
    } else {
      await refreshProfile();
      setSuccessMessage('Profile photo updated successfully.');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLinkPersonalEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailToLink.trim()) return;

    setIsLinkingEmail(true);
    setEmailLinkMessage(null);
    setErrorMessage(null);

    const { error } = await connectEmail(emailToLink.trim());
    setIsLinkingEmail(false);

    if (error) {
      setErrorMessage(error.message || 'Failed to link personal email.');
    } else {
      setEmailLinkMessage('Personal email successfully connected to your PoraPlan account.');
      setEmailToLink('');
      await refreshProfile();
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b-2 border-brand-dark pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs uppercase tracking-wider text-brand-muted">
              Account Management
            </span>
            <span className="text-brand-muted">•</span>
            <span className="font-mono text-xs uppercase tracking-wider text-brand-teal font-bold">
              Identity Dossier
            </span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy tracking-tight">
            My Profile
          </h1>
          <p className="font-sans text-xs sm:text-sm text-brand-muted mt-0.5">
            Manage your personal academic records, study coordination details, and PoraPlan identity.
          </p>
        </div>

        {/* Action Toggle */}
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartEditing}
              leftIcon={<Edit3 className="w-4 h-4" />}
            >
              Edit Profile
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing(false);
                setErrorMessage(null);
              }}
              leftIcon={<X className="w-4 h-4" />}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="p-3.5 border-2 border-brand-dark bg-emerald-50 text-emerald-950 flex items-center gap-3 shadow-brutal-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 stroke-[2.5]" />
          <span className="font-sans text-xs sm:text-sm font-semibold">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 border-2 border-brand-dark bg-red-50 text-red-950 flex items-center gap-3 shadow-brutal-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 stroke-[2.5]" />
          <span className="font-sans text-xs sm:text-sm font-semibold">{errorMessage}</span>
        </div>
      )}

      {/* Main Dossier Card (Identity & Core Information) */}
      <div className="p-5 sm:p-7 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 border-b-2 border-brand-dark pb-6">
          {/* Avatar with Upload Control */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 border-3 border-brand-dark bg-brand-navy text-white flex items-center justify-center font-heading font-extrabold text-3xl shadow-brutal-sm overflow-hidden">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || 'Avatar'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <span>{userInitials}</span>
              )}
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarFileSelected}
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              aria-label="Upload profile photo"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute -bottom-2 -right-2 p-2 bg-brand-gold text-brand-dark border-2 border-brand-dark shadow-brutal-xs hover:bg-[#e89a1c] transition-all cursor-pointer disabled:opacity-50"
              title="Change profile photo"
              aria-label="Change profile photo"
            >
              {isUploadingAvatar ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand-dark" />
              ) : (
                <Camera className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          </div>

          {/* Identity Meta */}
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={roleBadgeVariant} size="sm">
                {roleLabel}
              </Badge>
              <Badge variant="paper" size="sm" className="font-mono">
                ID: {poraplanId || profile?.poraplan_id || 'PENDING'}
              </Badge>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-brand-teal px-2 py-0.5 border-2 border-brand-dark bg-brand-paper-tint shadow-brutal-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse" />
                {profile?.status === 'not_activated' ? 'Activating' : 'Active Member'}
              </span>
            </div>

            <h2 className="font-heading font-black text-xl sm:text-2xl text-brand-navy truncate">
              {profile?.full_name || user?.user_metadata?.full_name || 'PoraPlan Member'}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-brand-muted">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 stroke-[2.2]" />
                {profile?.email || user?.email || '-'}
              </span>
              {profile?.whatsapp_number && (
                <span className="flex items-center gap-1.5 text-brand-dark font-medium">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 stroke-[2.2]" />
                  {profile.whatsapp_number}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View / Edit Mode Form */}
        {!isEditing ? (
          <div className="space-y-6">
            {/* Section: Academic & Professional Coordinates */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="w-4 h-4 text-brand-gold stroke-[2.5]" />
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy uppercase tracking-wider">
                  {isStudent ? 'Academic Enrolment' : isMentor ? 'Mentorship Credentials' : 'Administrative Details'}
                </h3>
              </div>

              {isStudent && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-1 shadow-brutal-xs">
                    <span className="font-mono text-[10px] text-brand-muted uppercase block">
                      University / College
                    </span>
                    <span className="font-sans font-bold text-sm text-brand-dark">
                      {profile?.university || <span className="text-brand-muted font-normal italic">Not specified</span>}
                    </span>
                  </div>

                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-1 shadow-brutal-xs">
                    <span className="font-mono text-[10px] text-brand-muted uppercase block">
                      Department / Major
                    </span>
                    <span className="font-sans font-bold text-sm text-brand-dark">
                      {profile?.department || <span className="text-brand-muted font-normal italic">Not specified</span>}
                    </span>
                  </div>

                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-1 shadow-brutal-xs">
                    <span className="font-mono text-[10px] text-brand-muted uppercase block">
                      Academic Batch
                    </span>
                    <span className="font-mono font-bold text-sm text-brand-dark">
                      {profile?.batch || <span className="text-brand-muted font-normal italic">Not specified</span>}
                    </span>
                  </div>

                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-1 shadow-brutal-xs">
                    <span className="font-mono text-[10px] text-brand-muted uppercase block">
                      Current Semester
                    </span>
                    <span className="font-mono font-bold text-sm text-brand-teal">
                      {profile?.current_semester || <span className="text-brand-muted font-normal italic">Not specified</span>}
                    </span>
                  </div>
                </div>
              )}

              {isMentor && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-1 shadow-brutal-xs">
                    <span className="font-mono text-[10px] text-brand-muted uppercase block">
                      Academic Background & Degrees
                    </span>
                    <span className="font-sans font-bold text-sm text-brand-dark">
                      {profile?.academic_background || <span className="text-brand-muted font-normal italic">Not specified</span>}
                    </span>
                  </div>

                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-1 shadow-brutal-xs">
                    <span className="font-mono text-[10px] text-brand-muted uppercase block">
                      Institution / Department
                    </span>
                    <span className="font-sans font-bold text-sm text-brand-dark">
                      {[profile?.university, profile?.department].filter(Boolean).join(' • ') || (
                        <span className="text-brand-muted font-normal italic">Not specified</span>
                      )}
                    </span>
                  </div>

                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-1 shadow-brutal-xs">
                    <span className="font-mono text-[10px] text-brand-muted uppercase block">
                      Core Expertise Domains
                    </span>
                    <span className="font-sans font-bold text-sm text-brand-dark">
                      {profile?.expertise || <span className="text-brand-muted font-normal italic">Not specified</span>}
                    </span>
                  </div>

                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-1 shadow-brutal-xs">
                    <span className="font-mono text-[10px] text-brand-muted uppercase block">
                      Mentoring Subjects / Courses
                    </span>
                    <span className="font-sans font-bold text-sm text-brand-teal">
                      {profile?.mentoring_subjects || <span className="text-brand-muted font-normal italic">Not specified</span>}
                    </span>
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-1 shadow-brutal-xs">
                  <span className="font-mono text-[10px] text-brand-muted uppercase block">
                    Administrative Scope
                  </span>
                  <span className="font-sans font-bold text-sm text-brand-dark">
                    System Administration, Member Pre-registration, Role Governance
                  </span>
                </div>
              )}
            </div>

            {/* Section: Academic Biography / Study Philosophy */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-brand-gold stroke-[2.5]" />
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy uppercase tracking-wider">
                  {isStudent ? 'Study Goals & Academic Focus' : isMentor ? 'Mentorship Philosophy' : 'Administrator Bio'}
                </h3>
              </div>
              <div className="p-4 border-2 border-brand-dark bg-brand-paper-tint text-xs sm:text-sm text-brand-dark font-sans leading-relaxed shadow-brutal-xs">
                {profile?.bio || (
                  <span className="text-brand-muted italic">
                    {isStudent
                      ? 'No study goals provided yet. Click "Edit Profile" to share what you are studying and preparing for.'
                      : 'No bio provided yet. Click "Edit Profile" to describe your mentorship approach.'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Edit Mode Form */
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="p-3.5 border-2 border-amber-600 bg-amber-50 text-amber-950 flex items-center gap-2 font-mono text-xs">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Editing profile fields. Permanent system IDs and roles cannot be altered.</span>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="fullName" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  placeholder="e.g. Fahim Rahman"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="whatsappNumber" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                  WhatsApp Number (Operational)
                </label>
                <input
                  id="whatsappNumber"
                  name="whatsappNumber"
                  type="text"
                  value={formData.whatsappNumber}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  placeholder="e.g. +880 1712-345678"
                />
                <span className="font-mono text-[10px] text-brand-muted block">
                  Used by your mentor and PoraPlan team for urgent study check-ins.
                </span>
              </div>
            </div>

            {/* Role-Specific Fields */}
            {isStudent && (
              <div className="space-y-4 border-t-2 border-brand-dark pt-4">
                <h4 className="font-heading font-extrabold text-sm text-brand-navy uppercase tracking-wider">
                  Academic Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="university" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                      University / Institution
                    </label>
                    <input
                      id="university"
                      name="university"
                      type="text"
                      value={formData.university}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      placeholder="e.g. Dhaka University"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="department" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                      Department / Major
                    </label>
                    <input
                      id="department"
                      name="department"
                      type="text"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      placeholder="e.g. Computer Science & Engineering"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="batch" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                      Academic Batch / Graduation Year
                    </label>
                    <input
                      id="batch"
                      name="batch"
                      type="text"
                      value={formData.batch}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      placeholder="e.g. 2023 or Batch 58"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="currentSemester" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                      Current Semester / Term
                    </label>
                    <input
                      id="currentSemester"
                      name="currentSemester"
                      type="text"
                      value={formData.currentSemester}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      placeholder="e.g. 4th Semester"
                    />
                  </div>
                </div>
              </div>
            )}

            {isMentor && (
              <div className="space-y-4 border-t-2 border-brand-dark pt-4">
                <h4 className="font-heading font-extrabold text-sm text-brand-navy uppercase tracking-wider">
                  Mentor Credentials & Subjects
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="academicBackground" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                      Academic Background / Degrees
                    </label>
                    <input
                      id="academicBackground"
                      name="academicBackground"
                      type="text"
                      value={formData.academicBackground}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      placeholder="e.g. Ph.D. in Computer Science"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="university" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                      Affiliated Institution / University
                    </label>
                    <input
                      id="university"
                      name="university"
                      type="text"
                      value={formData.university}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      placeholder="e.g. University of Dhaka"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="expertise" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                      Core Subject Expertise
                    </label>
                    <input
                      id="expertise"
                      name="expertise"
                      type="text"
                      value={formData.expertise}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      placeholder="e.g. Algorithms, Data Structures, Discrete Math"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="mentoringSubjects" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                      Mentoring Subjects / Courses
                    </label>
                    <input
                      id="mentoringSubjects"
                      name="mentoringSubjects"
                      type="text"
                      value={formData.mentoringSubjects}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      placeholder="e.g. CSE-201, CSE-205, General Study Organization"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bio Field */}
            <div className="space-y-1.5 border-t-2 border-brand-dark pt-4">
              <label htmlFor="bio" className="font-mono text-xs uppercase font-bold text-brand-dark block">
                {isStudent ? 'Academic Goals & Study Focus' : isMentor ? 'Mentorship Bio & Philosophy' : 'Administrator Bio'}
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={3}
                value={formData.bio}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border-2 border-brand-dark bg-white font-sans text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal leading-relaxed"
                placeholder={
                  isStudent
                    ? 'Outline your current academic goals, target courses, and study challenges...'
                    : 'Brief summary of your academic journey and approach to mentoring students...'
                }
              />
            </div>

            {/* Form Action Buttons */}
            <div className="flex items-center justify-end gap-3 border-t-2 border-brand-dark pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setErrorMessage(null);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSaving}
                leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Connectivity & Authentication Card */}
      <div className="p-5 sm:p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
        <div className="flex items-center gap-2 border-b-2 border-brand-dark pb-3">
          <Mail className="w-5 h-5 text-brand-teal stroke-[2.5]" />
          <h3 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy">
            Sign-in & Associated Email
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Primary System Email */}
          <div className="p-4 border-2 border-brand-dark bg-brand-paper-tint space-y-1.5 shadow-brutal-xs">
            <span className="font-mono text-[10px] text-brand-muted uppercase block">
              PoraPlan Internal Login Email
            </span>
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-xs sm:text-sm text-brand-dark break-all">
                {profile?.email || user?.email || '-'}
              </span>
              <Badge variant="navy" size="sm">SYSTEM</Badge>
            </div>
            <span className="font-sans text-[11px] text-brand-muted block mt-1">
              Used for system identity and direct PoraPlan ID login.
            </span>
          </div>

          {/* Linked Google/Personal Email */}
          <div className="p-4 border-2 border-brand-dark bg-brand-paper-tint space-y-2 shadow-brutal-xs">
            <span className="font-mono text-[10px] text-brand-muted uppercase block">
              Personal / Google Linked Email
            </span>

            {profile?.linked_email ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-sans font-bold text-xs sm:text-sm text-brand-dark break-all">
                    {profile.linked_email}
                  </span>
                  <Badge variant="teal" size="sm">LINKED</Badge>
                </div>
                <span className="font-sans text-[11px] text-brand-muted block">
                  You can sign in directly with Google using this account.
                </span>
              </div>
            ) : (
              <form onSubmit={handleLinkPersonalEmail} className="space-y-2">
                <span className="font-sans text-xs text-brand-muted block">
                  Connect your Google or personal email to enable Google One-Tap Sign In.
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    required
                    value={emailToLink}
                    onChange={(e) => setEmailToLink(e.target.value)}
                    placeholder="your.email@gmail.com"
                    className="flex-1 px-3 py-1.5 text-xs border-2 border-brand-dark bg-white font-sans focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isLinkingEmail}
                  >
                    {isLinkingEmail ? 'Connecting...' : 'Connect'}
                  </Button>
                </div>
                {emailLinkMessage && (
                  <p className="font-sans text-[11px] font-bold text-emerald-800">{emailLinkMessage}</p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Security & Platform Governance Notice */}
      <div className="p-4 border-2 border-brand-dark bg-brand-bg text-brand-dark flex items-start gap-3 shadow-brutal-xs">
        <ShieldCheck className="w-5 h-5 text-brand-navy shrink-0 mt-0.5 stroke-[2.2]" />
        <div className="space-y-1 font-sans text-xs">
          <span className="font-heading font-extrabold text-brand-navy block uppercase tracking-wider text-[11px]">
            Platform Governance Notice
          </span>
          <p className="text-brand-muted leading-relaxed">
            Your PoraPlan ID (<span className="font-mono font-bold text-brand-dark">{poraplanId || profile?.poraplan_id || 'PP001'}</span>) 
            and account role (<span className="font-bold text-brand-dark">{roleLabel}</span>) are cryptographically secured 
            by database row-level security and trigger constraints. If you require role adjustments or cohort transfer, 
            please contact your academic mentor or PoraPlan administration.
          </p>
        </div>
      </div>
    </div>
  );
};
