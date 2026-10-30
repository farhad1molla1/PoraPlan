import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getMentorResources,
  createResource,
  updateResource,
  deleteResource,
  type ResourceWithMeta,
} from '../../lib/resources';
import { getAssignedStudents } from '../../lib/mentorship';
import { getStudentSubjects } from '../../lib/subjects';
import { getStudentStudyPlans } from '../../lib/studyPlans';
import type {
  Profile,
  Subject,
  StudyPlan,
  ResourceType,
  ResourceStatus,
} from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  BookOpen,
  Plus,
  Search,
  ExternalLink,
  FileCode,
  Loader2,
  RefreshCw,
  AlertCircle,
  X,
  Trash2,
  Edit3,
  Eye,
  CheckCircle2,
} from 'lucide-react';

export const MentorResourcesPage: React.FC = () => {
  const { user, profile } = useAuth();
  const mentorId = profile?.id || user?.id || '';

  const [resources, setResources] = useState<ResourceWithMeta[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | ResourceType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeResource, setActiveResource] = useState<ResourceWithMeta | null>(null);
  const [editingResource, setEditingResource] = useState<ResourceWithMeta | null>(null);

  // Create Form State
  const [targetStudentId, setTargetStudentId] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourceType, setResourceType] = useState<ResourceType>('link');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceFileName, setResourceFileName] = useState('');
  const [resourceFileSize, setResourceFileSize] = useState<number | undefined>(undefined);
  const [resourceContent, setResourceContent] = useState('');
  const [targetSubjectId, setTargetSubjectId] = useState('');
  const [targetPlanId, setTargetPlanId] = useState('');

  // Target Student Dropdowns
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [availablePlans, setAvailablePlans] = useState<StudyPlan[]>([]);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Form State
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editStatus, setEditStatus] = useState<ResourceStatus>('active');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!mentorId) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [resRes, stuRes] = await Promise.all([
          getMentorResources(mentorId),
          getAssignedStudents(mentorId),
        ]);

        if (!isMounted) return;

        if (resRes.error) {
          setErrorMessage(resRes.error.message);
        } else {
          setResources(resRes.resources);
        }

        if (stuRes.students) {
          setStudents(stuRes.students);
          if (stuRes.students.length > 0) {
            setTargetStudentId((prev) => prev || stuRes.students[0].id);
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [mentorId]);

  // When target student changes in create modal, load their subjects & plans
  useEffect(() => {
    let isMounted = true;
    if (!targetStudentId) return;

    Promise.all([
      getStudentSubjects(targetStudentId),
      getStudentStudyPlans(targetStudentId),
    ]).then(([subjs, plans]) => {
      if (!isMounted) return;
      setAvailableSubjects(subjs.subjects || []);
      setAvailablePlans(plans.plans || []);
    });

    return () => {
      isMounted = false;
    };
  }, [targetStudentId]);

  const handleRefresh = async () => {
    if (!mentorId) return;
    setRefreshing(true);
    setErrorMessage(null);
    const { resources: list, error } = await getMentorResources(mentorId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setResources(list);
    }
    setRefreshing(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceTitle.trim()) {
      setCreateError('Resource title is required.');
      return;
    }
    if (!targetStudentId) {
      setCreateError('Please select a student from your roster.');
      return;
    }
    if (resourceType === 'link') {
      const cleanUrl = resourceUrl.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        setCreateError('Resource URL must start with http:// or https://');
        return;
      }
    }

    setSubmittingCreate(true);
    setCreateError(null);

    const { resource: created, error } = await createResource({
      studentId: targetStudentId,
      mentorId,
      subjectId: targetSubjectId || undefined,
      planId: targetPlanId || undefined,
      title: resourceTitle.trim(),
      description: resourceDescription.trim() || undefined,
      resourceType,
      url: resourceType === 'link' ? resourceUrl.trim() : undefined,
      fileName: resourceType === 'file' ? resourceFileName.trim() : undefined,
      fileSize: resourceType === 'file' ? resourceFileSize : undefined,
      content: resourceType === 'note' ? resourceContent.trim() : undefined,
      status: 'active',
    });

    setSubmittingCreate(false);

    if (error) {
      setCreateError(error.message);
    } else if (created) {
      setShowCreateModal(false);
      // Reset form
      setResourceTitle('');
      setResourceDescription('');
      setResourceUrl('');
      setResourceFileName('');
      setResourceFileSize(undefined);
      setResourceContent('');
      handleRefresh();
    }
  };

  const handleOpenEdit = (res: ResourceWithMeta) => {
    setEditingResource(res);
    setEditTitle(res.title);
    setEditDescription(res.description || '');
    setEditUrl(res.url || '');
    setEditContent(res.content || '');
    setEditStatus(res.status);
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResource) return;
    if (!editTitle.trim()) {
      setEditError('Resource title cannot be empty.');
      return;
    }

    setSubmittingEdit(true);
    setEditError(null);

    const { error } = await updateResource(editingResource.id, mentorId, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      url: editingResource.resource_type === 'link' ? editUrl.trim() : null,
      content: editingResource.resource_type === 'note' ? editContent.trim() : null,
      status: editStatus,
    });

    setSubmittingEdit(false);

    if (error) {
      setEditError(error.message);
    } else {
      setEditingResource(null);
      handleRefresh();
    }
  };

  const handleDelete = async (res: ResourceWithMeta) => {
    if (!window.confirm(`Are you sure you want to remove "${res.title}" from student resources?`)) {
      return;
    }

    const { error } = await deleteResource(res.id, mentorId);
    if (error) {
      alert(`Error deleting resource: ${error.message}`);
    } else {
      handleRefresh();
    }
  };

  const filteredResources = resources.filter((res) => {
    if (selectedStudentId !== 'all' && res.student_id !== selectedStudentId) {
      return false;
    }
    if (selectedType !== 'all' && res.resource_type !== selectedType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = res.title.toLowerCase().includes(q);
      const matchDesc = res.description ? res.description.toLowerCase().includes(q) : false;
      const matchStudent = res.student_name ? res.student_name.toLowerCase().includes(q) : false;
      const matchSubj = res.subject_name ? res.subject_name.toLowerCase().includes(q) : false;
      if (!matchTitle && !matchDesc && !matchStudent && !matchSubj) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-12">
      {/* ========================================================================= */}
      {/* 1. PAGE HEADER                                                            */}
      {/* ========================================================================= */}
      <section className="p-4 sm:p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs uppercase font-bold text-brand-muted bg-brand-bg px-2 py-0.5 border border-brand-dark">
              CURRICULUM REPOSITORY
            </span>
            <Badge variant="gold" size="sm">
              MENTOR LIBRARY
            </Badge>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy tracking-tight">
            Study Resources
          </h1>
          <p className="font-sans text-xs sm:text-sm text-brand-muted mt-1 max-w-2xl">
            Curate study materials, reference notes, and lecture links for your assigned students.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add New Resource
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            leftIcon={
              refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand-navy" />
              ) : (
                <RefreshCw className="w-4 h-4 text-brand-navy" />
              )
            }
          >
            {refreshing ? 'Updating...' : 'Refresh'}
          </Button>
        </div>
      </section>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 border-2 border-red-600 bg-red-50 text-red-900 shadow-brutal flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-heading font-bold text-sm">Failed to Load Resources</h4>
            <p className="font-mono text-xs mt-1 text-red-800">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. FILTER TOOLBAR                                                         */}
      {/* ========================================================================= */}
      <section className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
            <input
              type="text"
              placeholder="Search resource title, student, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
            />
          </div>

          {/* Student Filter */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-brand-muted shrink-0">Student:</span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
            >
              <option value="all">All Assigned Students ({students.length})</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}{s.poraplan_id ? ` (${s.poraplan_id})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'link', 'note', 'file'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-2.5 py-1 text-xs font-mono font-bold border border-brand-dark shadow-brutal-xs transition-transform ${
                  selectedType === type
                    ? 'bg-brand-navy text-white -translate-y-0.5'
                    : 'bg-brand-paper text-brand-dark hover:bg-brand-bg'
                }`}
              >
                {type === 'all'
                  ? 'All Formats'
                  : type === 'link'
                  ? 'Links / Web'
                  : type === 'note'
                  ? 'Formulas & Notes'
                  : 'Files'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. MENTOR RESOURCES LIST                                                  */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal mb-3" />
          <p className="font-heading font-extrabold text-base text-brand-navy">
            LOADING RESOURCES REPOSITORY
          </p>
        </div>
      ) : resources.length === 0 ? (
        <div className="p-8 sm:p-12 border-2 border-dashed border-brand-dark bg-brand-paper text-center shadow-brutal-sm">
          <div className="w-12 h-12 mx-auto mb-4 bg-brand-paper-tint border-2 border-brand-dark flex items-center justify-center shadow-brutal-xs">
            <BookOpen className="w-6 h-6 text-brand-gold" />
          </div>
          <h3 className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy">
            No Resources Curated Yet
          </h3>
          <p className="font-sans text-xs sm:text-sm text-brand-muted mt-2 max-w-lg mx-auto">
            You haven’t added any study materials or notes yet. Click "Add New Resource" to attach lecture notes, formula cheatsheets, or reference links for your assigned students.
          </p>
          <div className="mt-5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add First Resource
            </Button>
          </div>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="p-8 border-2 border-brand-dark bg-brand-paper text-center shadow-brutal-xs">
          <p className="font-heading font-bold text-sm text-brand-navy">
            No resources match your current filter.
          </p>
          <button
            onClick={() => {
              setSelectedStudentId('all');
              setSelectedType('all');
              setSearchQuery('');
            }}
            className="mt-2 text-xs font-mono text-brand-teal underline font-bold"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map((res) => (
            <div
              key={res.id}
              className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between"
            >
              <div>
                {/* Scholar & Format Badges */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-brand-teal bg-brand-bg px-1.5 py-0.5 border border-brand-dark">
                      {res.student_poraplan_id || 'STUDENT'}
                    </span>
                    <Badge
                      variant={
                        res.resource_type === 'note'
                          ? 'gold'
                          : res.resource_type === 'link'
                          ? 'teal'
                          : 'navy'
                      }
                      size="sm"
                    >
                      {res.resource_type.toUpperCase()}
                    </Badge>
                  </div>
                  {res.status === 'archived' && (
                    <Badge variant="muted" size="sm">
                      ARCHIVED
                    </Badge>
                  )}
                </div>

                <div className="text-xs font-mono text-brand-muted mb-1">
                  Student: <span className="font-bold text-brand-dark">{res.student_name}</span>
                </div>

                <h3 className="font-heading font-extrabold text-base text-brand-navy leading-snug">
                  {res.title}
                </h3>
                {res.description && (
                  <p className="font-sans text-xs text-brand-muted mt-1.5 line-clamp-2">
                    {res.description}
                  </p>
                )}

                {/* Subject & Plan metadata */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                  {res.subject_name && (
                    <span className="text-brand-navy font-semibold">
                      Area: {res.subject_name}
                    </span>
                  )}
                  {res.plan_title && (
                    <span className="text-brand-teal font-semibold truncate max-w-[150px]">
                      · {res.plan_title}
                    </span>
                  )}
                </div>

                {/* Content snippet preview for notes */}
                {res.resource_type === 'note' && res.content && (
                  <div className="mt-3 p-2 border border-brand-dark bg-brand-paper-tint font-mono text-[11px] text-brand-dark line-clamp-2 whitespace-pre-line shadow-brutal-xs">
                    {res.content}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-brand-dark/20 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveResource(res)}
                    className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-bg shadow-brutal-xs text-brand-dark"
                    title="View Resource"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(res)}
                    className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-bg shadow-brutal-xs text-brand-dark"
                    title="Edit Resource"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(res)}
                    className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-red-50 text-red-600 shadow-brutal-xs"
                    title="Delete Resource"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {res.url && (
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 border border-brand-dark bg-brand-paper text-brand-navy hover:bg-brand-bg font-mono text-xs font-bold shadow-brutal-xs inline-flex items-center gap-1"
                  >
                    <span>Visit</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CREATE RESOURCE MODAL                                                  */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-brand-dark/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-xl max-h-[90vh] bg-brand-paper border-2 border-brand-dark shadow-brutal flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-brand-teal">
                  ACADEMIC CURATION
                </span>
                <h3 className="font-heading font-extrabold text-xl text-brand-navy">
                  Add Learning Resource
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-bg shadow-brutal-xs"
              >
                <X className="w-5 h-5 text-brand-dark" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCreateSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {createError && (
                <div className="p-3 border-2 border-red-600 bg-red-50 text-red-900 font-mono text-xs shadow-brutal-xs">
                  {createError}
                </div>
              )}

              {/* Target Student */}
              <div>
                <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                  Target Student <span className="text-red-600">*</span>
                </label>
                <select
                  value={targetStudentId}
                  onChange={(e) => setTargetStudentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  required
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}{s.poraplan_id ? ` (${s.poraplan_id})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Association */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                    Study Area
                  </label>
                  <select
                    value={targetSubjectId}
                    onChange={(e) => setTargetSubjectId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  >
                    <option value="">General / None</option>
                    {availableSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                    Study Plan Roadmap
                  </label>
                  <select
                    value={targetPlanId}
                    onChange={(e) => setTargetPlanId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  >
                    <option value="">None / General</option>
                    {availablePlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                  Resource Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Halliday Ch. 4 Mechanics Formula Cheatsheet"
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  required
                />
              </div>

              {/* Format / Type */}
              <div>
                <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                  Resource Format
                </label>
                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  {(['link', 'note', 'file'] as const).map((type) => (
                    <label
                      key={type}
                      className={`p-2 border-2 border-brand-dark cursor-pointer text-center font-bold shadow-brutal-xs ${
                        resourceType === type
                          ? 'bg-brand-navy text-white'
                          : 'bg-brand-paper text-brand-dark hover:bg-brand-bg'
                      }`}
                    >
                      <input
                        type="radio"
                        name="resourceType"
                        value={type}
                        checked={resourceType === type}
                        onChange={() => setResourceType(type)}
                        className="sr-only"
                      />
                      {type === 'link'
                        ? 'External Link'
                        : type === 'note'
                        ? 'Formulas / Note'
                        : 'Document / File'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Dynamic Type Inputs */}
              {resourceType === 'link' && (
                <div>
                  <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                    URL Address <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/materials/cheatsheet.pdf"
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                    required
                  />
                  <span className="font-mono text-[10px] text-brand-muted mt-0.5 block">
                    Must start with http:// or https://
                  </span>
                </div>
              )}

              {resourceType === 'note' && (
                <div>
                  <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                    Formula & Notes Body <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Write key equations, derivations, or concept bullet points..."
                    value={resourceContent}
                    onChange={(e) => setResourceContent(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal leading-relaxed"
                    required
                  />
                </div>
              )}

              {resourceType === 'file' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                      File Name / Reference Document
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Giancoli_Chapter_04_Exercises.pdf"
                      value={resourceFileName}
                      onChange={(e) => setResourceFileName(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                      Cloud Storage / Document Download URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://storage.googleapis.com/... or Google Drive link"
                      value={resourceUrl}
                      onChange={(e) => setResourceUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                    />
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                  Description & Guidance
                </label>
                <textarea
                  rows={2}
                  placeholder="Provide instructions or syllabus context for the student..."
                  value={resourceDescription}
                  onChange={(e) => setResourceDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-sans border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t-2 border-brand-dark flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submittingCreate}
                  leftIcon={
                    submittingCreate ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {submittingCreate ? 'Saving...' : 'Publish Resource'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. EDIT RESOURCE MODAL                                                    */}
      {/* ========================================================================= */}
      {editingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-brand-dark/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg max-h-[90vh] bg-brand-paper border-2 border-brand-dark shadow-brutal flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-brand-teal">
                  EDIT RESOURCE
                </span>
                <h3 className="font-heading font-extrabold text-xl text-brand-navy">
                  {editingResource.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingResource(null)}
                className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-bg shadow-brutal-xs"
              >
                <X className="w-5 h-5 text-brand-dark" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {editError && (
                <div className="p-3 border-2 border-red-600 bg-red-50 text-red-900 font-mono text-xs shadow-brutal-xs">
                  {editError}
                </div>
              )}

              <div>
                <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  required
                />
              </div>

              {editingResource.resource_type === 'link' && (
                <div>
                  <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                    URL Address
                  </label>
                  <input
                    type="url"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  />
                </div>
              )}

              {editingResource.resource_type === 'note' && (
                <div>
                  <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                    Notes & Formulas Body
                  </label>
                  <textarea
                    rows={6}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal leading-relaxed"
                  />
                </div>
              )}

              <div>
                <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-sans border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase font-bold text-brand-navy mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as ResourceStatus)}
                  className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                >
                  <option value="active">Active (Visible to Student)</option>
                  <option value="archived">Archived (Hidden)</option>
                </select>
              </div>

              <div className="pt-3 border-t-2 border-brand-dark flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingResource(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submittingEdit}
                >
                  {submittingEdit ? 'Saving...' : 'Update Resource'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. VIEW DETAIL MODAL                                                      */}
      {/* ========================================================================= */}
      {activeResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-brand-dark/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-xl max-h-[90vh] bg-brand-paper border-2 border-brand-dark shadow-brutal flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="teal" size="sm">
                    {activeResource.resource_type.toUpperCase()}
                  </Badge>
                  <span className="font-mono text-xs font-bold text-brand-teal">
                    Student: {activeResource.student_name} ({activeResource.student_poraplan_id})
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-xl text-brand-navy">
                  {activeResource.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveResource(null)}
                className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-bg shadow-brutal-xs"
              >
                <X className="w-5 h-5 text-brand-dark" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {activeResource.description && (
                <div>
                  <h4 className="font-mono text-xs uppercase font-bold text-brand-muted mb-1">
                    Description
                  </h4>
                  <p className="font-sans text-xs sm:text-sm text-brand-dark leading-relaxed">
                    {activeResource.description}
                  </p>
                </div>
              )}

              {activeResource.resource_type === 'note' && activeResource.content && (
                <div>
                  <h4 className="font-mono text-xs uppercase font-bold text-brand-muted mb-1 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-brand-teal" />
                    Formula Cheatsheet Content
                  </h4>
                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint font-mono text-xs text-brand-dark whitespace-pre-wrap shadow-brutal-xs leading-relaxed">
                    {activeResource.content}
                  </div>
                </div>
              )}

              {activeResource.url && (
                <div className="p-3 border border-brand-dark bg-brand-bg flex items-center justify-between gap-2 shadow-brutal-xs">
                  <div className="truncate font-mono text-xs text-brand-navy">
                    <span className="font-bold block text-brand-muted text-[10px]">URL:</span>
                    <span className="truncate">{activeResource.url}</span>
                  </div>
                  <a
                    href={activeResource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 border border-brand-dark bg-brand-teal text-white font-mono text-xs font-bold shadow-brutal-xs inline-flex items-center gap-1"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="p-3 sm:p-4 border-t-2 border-brand-dark bg-brand-bg flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveResource(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
