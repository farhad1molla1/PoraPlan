import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getMentorAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type AnnouncementWithMeta,
} from '../../lib/announcements';
import { getAssignedStudents } from '../../lib/mentorship';
import type {
  Profile,
  AnnouncementPriority,
  AnnouncementScope,
  AnnouncementStatus,
} from '../../types/database';
import { Button } from '../../components/common/Button';
import {
  Megaphone,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  RefreshCw,
  Archive,
  Trash2,
  Edit3,
  Users,
  ShieldCheck,
  Sparkles,
  BookOpen,
  Filter,
} from 'lucide-react';

export const MentorAnnouncementsPage: React.FC = () => {
  const { user, profile, role } = useAuth();
  const userId = profile?.id || user?.id || '';
  const isAdmin = role === 'admin';

  const [announcements, setAnnouncements] = useState<AnnouncementWithMeta[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | AnnouncementStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | AnnouncementPriority>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createContent, setCreateContent] = useState('');
  const [createScope, setCreateScope] = useState<AnnouncementScope>('assigned_students');
  const [createStudentId, setCreateStudentId] = useState('');
  const [createPriority, setCreatePriority] = useState<AnnouncementPriority>('normal');
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Modal
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementWithMeta | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editPriority, setEditPriority] = useState<AnnouncementPriority>('normal');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Acknowledgments Viewer Modal
  const [viewingAcksAnnouncement, setViewingAcksAnnouncement] = useState<AnnouncementWithMeta | null>(null);

  // Delete Confirmation Modal
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<AnnouncementWithMeta | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (!userId) return;
    if (isRefresh) {
      setRefreshing(true);
    }
    setErrorMessage(null);

    try {
      const [annRes, stuRes] = await Promise.all([
        getMentorAnnouncements(userId, role || undefined),
        getAssignedStudents(userId),
      ]);

      if (annRes.error) {
        setErrorMessage(annRes.error.message);
      } else {
        setAnnouncements(annRes.announcements);
      }

      if (stuRes.students) {
        setStudents(stuRes.students);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [annRes, stuRes] = await Promise.all([
          getMentorAnnouncements(userId, role || undefined),
          getAssignedStudents(userId),
        ]);

        if (!isMounted) return;

        if (annRes.error) {
          setErrorMessage(annRes.error.message);
        } else {
          setAnnouncements(annRes.announcements);
        }

        if (stuRes.students) {
          setStudents(stuRes.students);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [userId, role]);

  // Handle Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      setCreateError('Please enter an announcement title.');
      return;
    }
    if (!createContent.trim()) {
      setCreateError('Please enter the announcement notice body.');
      return;
    }
    if (createScope === 'individual' && !createStudentId) {
      setCreateError('Please select a target student for this announcement.');
      return;
    }

    setSubmittingCreate(true);
    setCreateError(null);

    try {
      const { announcement, error } = await createAnnouncement({
        authorId: userId,
        authorRole: role || undefined,
        title: createTitle.trim(),
        content: createContent.trim(),
        targetScope: createScope,
        studentId: createScope === 'individual' ? createStudentId : null,
        priority: createPriority,
        status: 'published',
      });

      if (error) {
        setCreateError(error.message);
      } else if (announcement) {
        setShowCreateModal(false);
        setCreateTitle('');
        setCreateContent('');
        setCreateScope('assigned_students');
        setCreateStudentId('');
        setCreatePriority('normal');
        setSuccessMessage('Announcement published successfully.');
        setTimeout(() => setSuccessMessage(null), 4000);
        await fetchData(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCreateError(msg);
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Handle Edit
  const openEditModal = (ann: AnnouncementWithMeta) => {
    setEditingAnnouncement(ann);
    setEditTitle(ann.title);
    setEditContent(ann.content);
    setEditPriority(ann.priority);
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncement) return;
    if (!editTitle.trim()) {
      setEditError('Title cannot be empty.');
      return;
    }
    if (!editContent.trim()) {
      setEditError('Content cannot be empty.');
      return;
    }

    setSubmittingEdit(true);
    setEditError(null);

    try {
      const { announcement, error } = await updateAnnouncement(
        editingAnnouncement.id,
        userId,
        {
          title: editTitle.trim(),
          content: editContent.trim(),
          priority: editPriority,
        }
      );

      if (error) {
        setEditError(error.message);
      } else if (announcement) {
        setAnnouncements((prev) =>
          prev.map((item) =>
            item.id === editingAnnouncement.id
              ? {
                  ...item,
                  title: editTitle.trim(),
                  content: editContent.trim(),
                  priority: editPriority,
                  updated_at: new Date().toISOString(),
                }
              : item
          )
        );
        setEditingAnnouncement(null);
        setSuccessMessage('Announcement updated successfully.');
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEditError(msg);
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Handle Status Toggle (Archive / Publish)
  const handleToggleStatus = async (ann: AnnouncementWithMeta) => {
    const nextStatus: AnnouncementStatus = ann.status === 'published' ? 'archived' : 'published';

    try {
      const { announcement, error } = await updateAnnouncement(ann.id, userId, {
        status: nextStatus,
      });

      if (error) {
        setErrorMessage(`Failed to update status: ${error.message}`);
      } else if (announcement) {
        setAnnouncements((prev) =>
          prev.map((item) => (item.id === ann.id ? { ...item, status: nextStatus } : item))
        );
        setSuccessMessage(
          nextStatus === 'archived'
            ? 'Announcement archived and hidden from student stream.'
            : 'Announcement republished to active stream.'
        );
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    }
  };

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!deletingAnnouncement) return;
    setSubmittingDelete(true);

    try {
      const { success, error } = await deleteAnnouncement(deletingAnnouncement.id, userId);
      if (error) {
        setErrorMessage(`Failed to delete announcement: ${error.message}`);
      } else if (success) {
        setAnnouncements((prev) => prev.filter((item) => item.id !== deletingAnnouncement.id));
        setDeletingAnnouncement(null);
        setSuccessMessage('Announcement deleted permanently.');
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setSubmittingDelete(false);
    }
  };

  // Metrics
  const totalCount = announcements.length;
  const publishedCount = announcements.filter((a) => a.status === 'published').length;
  const archivedCount = announcements.filter((a) => a.status === 'archived').length;
  const totalAcksCount = announcements.reduce((acc, a) => acc + (a.acknowledgments_count || 0), 0);

  // Filtered List
  const filteredAnnouncements = announcements.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && a.priority !== priorityFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = a.title.toLowerCase().includes(q);
      const matchContent = a.content.toLowerCase().includes(q);
      const matchStudent = (a.student_name || '').toLowerCase().includes(q);
      const matchSubject = (a.subject_name || '').toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchStudent && !matchSubject) return false;
    }

    return true;
  });

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getPriorityBadge = (priority: AnnouncementPriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-red-700 bg-red-100 text-red-900 font-mono text-[10px] font-extrabold uppercase">
            <AlertTriangle className="w-2.5 h-2.5 text-red-700 stroke-[2.5]" />
            Urgent
          </span>
        );
      case 'important':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-amber-600 bg-amber-100 text-amber-900 font-mono text-[10px] font-extrabold uppercase">
            <Clock className="w-2.5 h-2.5 text-amber-700 stroke-[2.5]" />
            Important
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-brand-teal bg-teal-50 text-brand-teal font-mono text-[10px] font-extrabold uppercase">
            Normal
          </span>
        );
    }
  };

  const getScopeBadge = (ann: AnnouncementWithMeta) => {
    switch (ann.target_scope) {
      case 'platform':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-brand-navy bg-brand-navy text-white font-mono text-[10px] font-bold uppercase">
            <ShieldCheck className="w-2.5 h-2.5" />
            Platform Wide
          </span>
        );
      case 'assigned_students':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-blue-700 bg-blue-50 text-blue-900 font-mono text-[10px] font-bold uppercase">
            <Users className="w-2.5 h-2.5" />
            Cohort Roster
          </span>
        );
      case 'individual':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-purple-700 bg-purple-50 text-purple-900 font-mono text-[10px] font-bold uppercase">
            <Sparkles className="w-2.5 h-2.5" />
            Individual: {ann.student_name || ann.student_poraplan_id || 'Student'}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* 1. Header & Actions */}
      <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 border-2 border-brand-dark bg-brand-gold text-brand-dark flex items-center justify-center shadow-brutal-xs">
              <Megaphone className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
              Announcements
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-brand-muted font-sans">
            Post announcements, schedule updates, and guidance for your assigned students.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="border-2 border-brand-dark bg-brand-paper hover:bg-brand-paper-tint"
            title="Refresh announcements list"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setShowCreateModal(true);
              setCreateError(null);
            }}
            className="border-2 border-brand-dark bg-brand-navy text-white hover:bg-brand-teal shadow-brutal-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Publish Notice
          </Button>
        </div>
      </div>

      {/* 2. Success Banner */}
      {successMessage && (
        <div className="border-2 border-green-700 bg-green-50 p-4 shadow-brutal flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-900 font-sans text-xs sm:text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-green-800 hover:text-green-950 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Error Banner */}
      {errorMessage && (
        <div className="border-2 border-red-700 bg-red-50 p-4 shadow-brutal flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-900 font-sans text-xs sm:text-sm font-semibold">
            <AlertTriangle className="w-5 h-5 text-red-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-800 hover:text-red-950 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. Statistics Dashboard Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="border-2 border-brand-dark bg-brand-paper p-4 shadow-brutal">
          <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
            AUTHORED NOTICES
          </span>
          <span className="font-heading font-extrabold text-2xl text-brand-navy">
            {totalCount}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setStatusFilter('published')}
          className={`border-2 border-brand-dark p-4 shadow-brutal text-left transition-transform hover:-translate-y-0.5 ${
            statusFilter === 'published' ? 'ring-2 ring-brand-navy bg-teal-50' : 'bg-brand-paper'
          }`}
        >
          <span className="font-mono text-[10px] uppercase font-bold text-brand-teal block">
            PUBLISHED (ACTIVE)
          </span>
          <span className="font-heading font-extrabold text-2xl text-brand-navy">
            {publishedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('archived')}
          className={`border-2 border-brand-dark p-4 shadow-brutal text-left transition-transform hover:-translate-y-0.5 ${
            statusFilter === 'archived' ? 'ring-2 ring-brand-navy bg-amber-50' : 'bg-brand-paper'
          }`}
        >
          <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
            ARCHIVED
          </span>
          <span className="font-heading font-extrabold text-2xl text-brand-dark">
            {archivedCount}
          </span>
        </button>

        <div className="border-2 border-brand-dark bg-brand-paper p-4 shadow-brutal">
          <span className="font-mono text-[10px] uppercase font-bold text-brand-gold block">
            TOTAL CONFIRMATIONS
          </span>
          <span className="font-heading font-extrabold text-2xl text-brand-navy">
            {totalAcksCount}
          </span>
        </div>
      </div>

      {/* 5. Filter & Search Controls */}
      <div className="border-2 border-brand-dark bg-brand-paper p-4 shadow-brutal space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notices by title, content, or targeted student..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border-2 border-brand-dark bg-brand-bg font-sans focus:outline-none focus:ring-2 focus:ring-brand-teal"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-dark p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 font-mono text-xs font-bold border-2 border-brand-dark shadow-xs transition-colors whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-brand-navy text-white'
                  : 'bg-brand-paper hover:bg-brand-paper-tint text-brand-dark'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('published')}
              className={`px-3 py-1.5 font-mono text-xs font-bold border-2 border-brand-dark shadow-xs transition-colors whitespace-nowrap ${
                statusFilter === 'published'
                  ? 'bg-brand-teal text-white'
                  : 'bg-brand-paper hover:bg-teal-50 text-brand-teal'
              }`}
            >
              Published ({publishedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('archived')}
              className={`px-3 py-1.5 font-mono text-xs font-bold border-2 border-brand-dark shadow-xs transition-colors whitespace-nowrap ${
                statusFilter === 'archived'
                  ? 'bg-brand-dark text-white'
                  : 'bg-brand-paper hover:bg-brand-paper-tint text-brand-muted'
              }`}
            >
              Archived ({archivedCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-brand-dark/15 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-brand-muted" />
            <span className="font-mono text-[11px] font-bold text-brand-muted uppercase">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="px-2 py-1 border border-brand-dark bg-brand-bg font-sans text-xs focus:outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="important">Important</option>
              <option value="normal">Normal</option>
            </select>
          </div>

          {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
              className="font-mono text-[11px] text-brand-teal hover:underline ml-auto"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* 6. Main List or Empty State */}
      {loading ? (
        <div className="border-2 border-brand-dark bg-brand-paper p-12 text-center shadow-brutal space-y-3">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-brand-teal border-t-brand-navy rounded-full" />
          <p className="font-heading font-bold text-brand-navy text-sm">
            Loading Faculty Announcements...
          </p>
          <span className="font-mono text-[11px] text-brand-muted block">
            Querying authorized announcement records and student acknowledgment logs
          </span>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="border-2 border-brand-dark bg-brand-paper p-10 sm:p-14 text-center shadow-brutal space-y-3">
          <div className="w-12 h-12 border-2 border-brand-dark bg-brand-paper-tint mx-auto flex items-center justify-center shadow-brutal-xs">
            <Megaphone className="w-6 h-6 text-brand-muted" />
          </div>
          <h2 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy">
            {totalCount === 0
              ? 'No Announcements Published Yet'
              : 'No Announcements Match Filter Criteria'}
          </h2>
          <p className="font-sans text-xs sm:text-sm text-brand-muted max-w-md mx-auto leading-relaxed">
            {totalCount === 0
              ? 'You have not published any announcements to your student roster. Use "+ Publish Notice" to broadcast consultation schedules, exam reminders, or assignment updates.'
              : 'Try clearing your search query or selecting a different status filter.'}
          </p>
          {totalCount === 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="mt-3"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Publish First Notice
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
              className="mt-3"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((announcement) => {
            const isArchived = announcement.status === 'archived';

            return (
              <article
                key={announcement.id}
                className={`border-2 border-brand-dark p-5 sm:p-6 shadow-brutal transition-all flex flex-col justify-between gap-4 ${
                  isArchived ? 'bg-brand-bg/70 opacity-80' : 'bg-brand-paper'
                }`}
              >
                {/* Announcement Card Top Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-dark/15 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {getPriorityBadge(announcement.priority)}
                    {getScopeBadge(announcement)}
                    {announcement.subject_name && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-brand-dark/30 bg-brand-paper font-mono text-[10px] text-brand-dark font-bold">
                        <BookOpen className="w-2.5 h-2.5 text-brand-teal" />
                        {announcement.subject_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isArchived ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-brand-muted bg-brand-bg border border-brand-dark/40 px-2 py-0.5">
                        <Archive className="w-3 h-3 text-brand-muted" />
                        Archived
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-green-800 bg-green-100 border border-green-700 px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3 text-green-700" />
                        Published
                      </span>
                    )}

                    {/* Acknowledgments Button */}
                    <button
                      type="button"
                      onClick={() => setViewingAcksAnnouncement(announcement)}
                      className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2.5 py-0.5 border border-brand-dark bg-brand-paper hover:bg-brand-paper-tint shadow-xs transition-colors"
                      title="View students who confirmed receipt"
                    >
                      <Users className="w-3 h-3 text-brand-navy" />
                      <span>{announcement.acknowledgments_count || 0} Confirmations</span>
                    </button>
                  </div>
                </div>

                {/* Announcement Content & Title */}
                <div className="space-y-2">
                  <h2 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy">
                    {announcement.title}
                  </h2>
                  <p className="font-sans text-xs sm:text-sm text-brand-dark leading-relaxed whitespace-pre-line">
                    {announcement.content}
                  </p>
                </div>

                {/* Footer Metadata & Actions */}
                <div className="border-t border-brand-dark/15 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-brand-muted">
                    <span>Published {formatDate(announcement.published_at)}</span>
                    {announcement.updated_at && announcement.updated_at !== announcement.published_at && (
                      <>
                        <span>•</span>
                        <span>Edited {formatDate(announcement.updated_at)}</span>
                      </>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(announcement)}
                      className="px-2.5 py-1 text-xs border border-brand-dark"
                      title="Edit announcement title & content"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1 text-brand-dark" />
                      Edit
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(announcement)}
                      className="px-2.5 py-1 text-xs border border-brand-dark"
                      title={isArchived ? 'Republish announcement' : 'Archive announcement'}
                    >
                      <Archive className="w-3.5 h-3.5 mr-1 text-brand-dark" />
                      {isArchived ? 'Republish' : 'Archive'}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingAnnouncement(announcement)}
                      className="px-2 py-1 text-xs text-red-700 hover:text-red-900 hover:bg-red-50 border border-transparent hover:border-red-600"
                      title="Delete announcement permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 7. Create Announcement Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal max-w-xl w-full max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b-2 border-brand-dark flex items-center justify-between bg-brand-paper-tint">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-brand-navy stroke-[2.5]" />
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy">
                  Publish Academic Announcement
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 border-2 border-brand-dark bg-brand-paper hover:bg-brand-paper-tint text-brand-dark shadow-brutal-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4">
              {createError && (
                <div className="p-3 border-2 border-red-700 bg-red-50 text-red-900 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="font-mono text-xs font-bold uppercase text-brand-navy block mb-1">
                  Announcement Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. Physics Lab & Advanced Problem Set 3 Consultation Hours"
                  className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-brand-dark bg-brand-bg font-sans focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  required
                />
              </div>

              {/* Audience Scope */}
              <div>
                <label className="font-mono text-xs font-bold uppercase text-brand-navy block mb-1">
                  Target Audience Scope <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateScope('assigned_students');
                      setCreateStudentId('');
                    }}
                    className={`p-3 border-2 border-brand-dark text-left transition-all ${
                      createScope === 'assigned_students'
                        ? 'bg-blue-50 ring-2 ring-brand-navy shadow-brutal-xs'
                        : 'bg-brand-bg hover:bg-brand-paper-tint'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-heading font-bold text-xs text-brand-navy mb-0.5">
                      <Users className="w-3.5 h-3.5 text-blue-700" />
                      Mentor Cohort
                    </div>
                    <p className="text-[11px] text-brand-muted leading-tight">
                      Dispatched to all students currently assigned to your mentoring roster.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateScope('individual')}
                    className={`p-3 border-2 border-brand-dark text-left transition-all ${
                      createScope === 'individual'
                        ? 'bg-purple-50 ring-2 ring-brand-navy shadow-brutal-xs'
                        : 'bg-brand-bg hover:bg-brand-paper-tint'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-heading font-bold text-xs text-brand-navy mb-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                      Individual Student
                    </div>
                    <p className="text-[11px] text-brand-muted leading-tight">
                      Notice targeted exclusively to one assigned student.
                    </p>
                  </button>
                </div>

                {/* Platform-wide option (Admin only) */}
                {isAdmin ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCreateScope('platform');
                        setCreateStudentId('');
                      }}
                      className={`w-full p-3 border-2 border-brand-dark text-left transition-all ${
                        createScope === 'platform'
                          ? 'bg-brand-navy text-white ring-2 ring-brand-gold shadow-brutal-xs'
                          : 'bg-brand-bg hover:bg-brand-paper-tint text-brand-dark'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-heading font-bold text-xs mb-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-brand-gold" />
                        Platform-Wide Announcement (Administrator Override)
                      </div>
                      <p className={`text-[11px] leading-tight ${createScope === 'platform' ? 'text-brand-bg/80' : 'text-brand-muted'}`}>
                        Broadcast to all students and faculty across PoraPlan.
                      </p>
                    </button>
                  </div>
                ) : (
                  <p className="font-mono text-[10px] text-brand-muted mt-1.5">
                    * Platform-wide broadcasts require Platform Administrator authorization.
                  </p>
                )}
              </div>

              {/* Individual Target Selector (Conditional) */}
              {createScope === 'individual' && (
                <div className="p-3 border-2 border-brand-dark bg-purple-50 space-y-1.5 animate-in fade-in duration-150">
                  <label className="font-mono text-xs font-bold uppercase text-purple-900 block">
                    Select Target Student <span className="text-red-600">*</span>
                  </label>
                  {students.length === 0 ? (
                    <div className="text-xs text-amber-900 font-sans p-2 border border-amber-600 bg-amber-50">
                      No students currently assigned to your mentoring roster. Pair with students first to dispatch individual notices.
                    </div>
                  ) : (
                    <select
                      value={createStudentId}
                      onChange={(e) => setCreateStudentId(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-brand-dark bg-brand-bg font-sans focus:outline-none"
                      required
                    >
                      <option value="">-- Choose Assigned Student --</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.full_name} ({student.poraplan_id || student.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="font-mono text-xs font-bold uppercase text-brand-navy block mb-1">
                  Priority Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['normal', 'important', 'urgent'] as AnnouncementPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCreatePriority(p)}
                      className={`py-2 px-3 border-2 border-brand-dark font-mono text-xs font-bold uppercase text-center transition-all ${
                        createPriority === p
                          ? p === 'urgent'
                            ? 'bg-red-700 text-white shadow-brutal-xs'
                            : p === 'important'
                            ? 'bg-amber-600 text-white shadow-brutal-xs'
                            : 'bg-brand-navy text-white shadow-brutal-xs'
                          : 'bg-brand-bg hover:bg-brand-paper-tint text-brand-dark'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notice Body */}
              <div>
                <label className="font-mono text-xs font-bold uppercase text-brand-navy block mb-1">
                  Announcement Message <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={createContent}
                  onChange={(e) => setCreateContent(e.target.value)}
                  placeholder="Write your announcement or study guidance here..."
                  rows={5}
                  className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-brand-dark bg-brand-bg font-sans focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  required
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t-2 border-brand-dark flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submittingCreate}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submittingCreate || (createScope === 'individual' && !createStudentId)}
                  className="bg-brand-navy text-white hover:bg-brand-teal border-2 border-brand-dark shadow-xs"
                >
                  {submittingCreate ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Publish Announcement
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Edit Announcement Modal */}
      {editingAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal max-w-xl w-full max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 sm:p-5 border-b-2 border-brand-dark flex items-center justify-between bg-brand-paper-tint">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-brand-navy stroke-[2.5]" />
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy">
                  Edit Announcement Notice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAnnouncement(null)}
                className="p-1 border-2 border-brand-dark bg-brand-paper hover:bg-brand-paper-tint text-brand-dark shadow-brutal-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4">
              {editError && (
                <div className="p-3 border-2 border-red-700 bg-red-50 text-red-900 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="font-mono text-xs font-bold uppercase text-brand-navy block mb-1">
                  Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-brand-dark bg-brand-bg font-sans focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  required
                />
              </div>

              <div>
                <label className="font-mono text-xs font-bold uppercase text-brand-navy block mb-1">
                  Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['normal', 'important', 'urgent'] as AnnouncementPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditPriority(p)}
                      className={`py-2 px-3 border-2 border-brand-dark font-mono text-xs font-bold uppercase text-center transition-all ${
                        editPriority === p
                          ? 'bg-brand-navy text-white shadow-brutal-xs'
                          : 'bg-brand-bg hover:bg-brand-paper-tint text-brand-dark'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-mono text-xs font-bold uppercase text-brand-navy block mb-1">
                  Content Body <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 text-xs sm:text-sm border-2 border-brand-dark bg-brand-bg font-sans focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  required
                />
              </div>

              <div className="pt-3 border-t-2 border-brand-dark flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingAnnouncement(null)}
                  disabled={submittingEdit}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submittingEdit}
                  className="bg-brand-navy text-white hover:bg-brand-teal border-2 border-brand-dark shadow-xs"
                >
                  {submittingEdit ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Acknowledgments View Modal */}
      {viewingAcksAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal max-w-lg w-full max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 sm:p-5 border-b-2 border-brand-dark flex items-center justify-between bg-brand-paper-tint">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-navy stroke-[2.5]" />
                <div>
                  <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy">
                    Student Confirmations
                  </h3>
                  <span className="font-mono text-[10px] text-brand-muted block truncate max-w-xs">
                    {viewingAcksAnnouncement.title}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingAcksAnnouncement(null)}
                className="p-1 border-2 border-brand-dark bg-brand-paper hover:bg-brand-paper-tint text-brand-dark shadow-brutal-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between font-mono text-xs border-b border-brand-dark/15 pb-2">
                <span className="text-brand-muted uppercase font-bold">Total Confirmed</span>
                <span className="font-bold text-brand-navy">
                  {viewingAcksAnnouncement.acknowledgments_count || 0} Students
                </span>
              </div>

              {!viewingAcksAnnouncement.acknowledgments ||
              viewingAcksAnnouncement.acknowledgments.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-brand-dark/20 bg-brand-bg space-y-1">
                  <Clock className="w-6 h-6 text-brand-muted mx-auto" />
                  <p className="font-heading font-bold text-xs text-brand-navy">
                    No Confirmations Recorded Yet
                  </p>
                  <span className="font-mono text-[11px] text-brand-muted block">
                    Students will appear here once they acknowledge the notice.
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {viewingAcksAnnouncement.acknowledgments.map((ack) => (
                    <div
                      key={ack.id}
                      className="p-3 border-2 border-brand-dark/20 bg-brand-bg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-brand-navy text-white font-mono font-bold text-xs flex items-center justify-center border border-brand-dark">
                          {(ack.student_name || 'S').substring(0, 1)}
                        </div>
                        <div>
                          <span className="font-heading font-bold text-brand-navy block">
                            {ack.student_name}
                          </span>
                          <span className="font-mono text-[10px] text-brand-teal font-bold block">
                            {ack.student_poraplan_id}
                          </span>
                        </div>
                      </div>
                      <div className="text-right font-mono text-[11px] text-brand-muted">
                        <div className="flex items-center gap-1 text-green-700 font-bold justify-end">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Confirmed
                        </div>
                        <span className="text-[10px]">{formatDate(ack.acknowledged_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 sm:p-4 border-t-2 border-brand-dark bg-brand-paper-tint flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingAcksAnnouncement(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Delete Confirmation Modal */}
      {deletingAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3 text-red-700">
              <div className="w-10 h-10 border-2 border-brand-dark bg-red-100 flex items-center justify-center shadow-brutal-xs">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy">
                  Delete Announcement?
                </h3>
                <span className="font-mono text-xs text-brand-muted block">
                  Action cannot be undone
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-brand-dark leading-relaxed font-sans">
              Are you sure you want to permanently delete{' '}
              <strong className="text-brand-navy">"{deletingAnnouncement.title}"</strong>? All student
              acknowledgment records associated with this announcement will also be removed.
            </p>

            <div className="pt-3 border-t-2 border-brand-dark/20 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingAnnouncement(null)}
                disabled={submittingDelete}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleDeleteConfirm}
                disabled={submittingDelete}
                className="bg-red-700 text-white hover:bg-red-800 border-2 border-brand-dark shadow-xs"
              >
                {submittingDelete ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Permanently Delete'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
