import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAdminUsers } from '../../lib/profiles';
import { getEnrollments } from '../../lib/applications';
import { getEffectiveMentor, getEffectiveStudentsForMentor } from '../../lib/mentorAssignments';
import { useAuth } from '../../hooks/useAuth';
import type {
  Profile,
  UserRole,
  AccountStatus,
  ProgramEnrollmentWithMeta,
} from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Users,
  Search,
  Filter,
  Shield,
  GraduationCap,
  BookOpen,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  Key,
  Info,
  RefreshCw,
  Building,
  Award,
  ExternalLink,
} from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const { resetPassword } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');

  // Drawer / Selection
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [userEnrollments, setUserEnrollments] = useState<ProgramEnrollmentWithMeta[]>([]);
  const [assignedMentor, setAssignedMentor] = useState<Profile | null>(null);
  const [assignedStudents, setAssignedStudents] = useState<Array<{ student: Profile; programName?: string; cohortName?: string }>>([]);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminUsers();
      if (res.error) {
        setError(res.error.message);
      } else {
        setUsers(res.users);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve user directory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Load details when a user is selected
  useEffect(() => {
    if (!selectedUser) {
      setUserEnrollments([]);
      setAssignedMentor(null);
      setAssignedStudents([]);
      return;
    }

    let isMounted = true;
    async function fetchDetails() {
      setDrawerLoading(true);
      try {
        if (selectedUser?.role === 'student') {
          const [enrRes, mentorRes] = await Promise.all([
            getEnrollments({ studentId: selectedUser.id }),
            getEffectiveMentor(selectedUser.id),
          ]);
          if (!isMounted) return;
          setUserEnrollments(enrRes.enrollments || []);
          setAssignedMentor(mentorRes.resolution?.mentor || null);
        } else if (selectedUser?.role === 'mentor') {
          const menteesRes = await getEffectiveStudentsForMentor(selectedUser.id);
          if (!isMounted) return;
          setAssignedStudents(menteesRes.students || []);
        }
      } catch {
        // Non-fatal for auxiliary drawer inspection
      } finally {
        if (isMounted) setDrawerLoading(false);
      }
    }

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [selectedUser]);

  // Escape key and body scroll lock for User Dossier Drawer
  useEffect(() => {
    if (!selectedUser) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedUser(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedUser]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      // Status filter
      if (statusFilter !== 'all' && (u.status || 'active') !== statusFilter) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = u.full_name.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesId = u.poraplan_id ? u.poraplan_id.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesEmail && !matchesId) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const students = users.filter((u) => u.role === 'student').length;
    const mentors = users.filter((u) => u.role === 'mentor').length;
    const admins = users.filter((u) => u.role === 'admin').length;
    return { total, students, mentors, admins };
  }, [users]);

  // Handle password recovery dispatch
  const handleTriggerPasswordReset = async () => {
    if (!selectedUser || !selectedUser.email) return;
    setIsSendingReset(true);
    setActionNotice(null);
    try {
      const { error } = await resetPassword(selectedUser.email);
      if (error) {
        setActionNotice({
          type: 'error',
          message: `Password reset dispatch failed: ${error.message}`,
        });
      } else {
        setActionNotice({
          type: 'success',
          message: `Official password recovery email dispatched to ${selectedUser.email}.`,
        });
      }
    } catch (err: unknown) {
      setActionNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to send password recovery.',
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const getRoleBadgeVariant = (role: UserRole): 'navy' | 'teal' | 'gold' => {
    switch (role) {
      case 'student':
        return 'navy';
      case 'mentor':
        return 'teal';
      case 'admin':
        return 'gold';
    }
  };

  const getStatusBadgeVariant = (status?: AccountStatus): 'teal' | 'gold' | 'danger' => {
    switch (status) {
      case 'active':
        return 'teal';
      case 'not_activated':
        return 'gold';
      case 'suspended':
        return 'danger';
      default:
        return 'teal';
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-default pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-forest-900/10 dark:bg-forest-100/10 text-forest-800 dark:text-forest-200">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-text-primary">User Directory</h1>
              <p className="text-sm text-text-secondary mt-0.5">
                Centralized registry of students, academic mentors, and administrative personnel.
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadUsers}
          disabled={loading}
          className="flex items-center gap-2 self-stretch sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Directory
        </Button>
      </div>

      {/* Global Action Banner */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-fade-in ${
            actionNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stat Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border-default bg-surface-card shadow-sm">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Total Members</p>
          <p className="text-2xl font-bold font-serif text-text-primary mt-1">{stats.total}</p>
        </div>
        <div className="p-4 rounded-xl border border-border-default bg-surface-card shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Scholars</p>
            <GraduationCap className="w-4 h-4 text-forest-700" />
          </div>
          <p className="text-2xl font-bold font-serif text-forest-900 dark:text-forest-100 mt-1">{stats.students}</p>
        </div>
        <div className="p-4 rounded-xl border border-border-default bg-surface-card shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Mentors</p>
            <BookOpen className="w-4 h-4 text-teal-700" />
          </div>
          <p className="text-2xl font-bold font-serif text-teal-900 dark:text-teal-100 mt-1">{stats.mentors}</p>
        </div>
        <div className="p-4 rounded-xl border border-border-default bg-surface-card shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Admins</p>
            <Shield className="w-4 h-4 text-amber-700" />
          </div>
          <p className="text-2xl font-bold font-serif text-amber-900 dark:text-amber-100 mt-1">{stats.admins}</p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-xl border border-border-default bg-surface-card shadow-sm flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search by name, email, or PoraPlan ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-surface-base border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-600 focus:border-transparent text-text-primary"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
          {/* Role Filter */}
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <Filter className="w-4 h-4 text-text-muted" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="py-2 px-3 text-sm bg-surface-base border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-600 text-text-primary w-full sm:w-auto"
            >
              <option value="all">All Roles</option>
              <option value="student">Students</option>
              <option value="mentor">Mentors</option>
              <option value="admin">Administrators</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="py-2 px-3 text-sm bg-surface-base border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-600 text-text-primary flex-1 sm:flex-none w-full sm:w-auto"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="not_activated">Not Activated</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      {loading ? (
        <div className="p-12 text-center rounded-xl border border-border-default bg-surface-card">
          <RefreshCw className="w-8 h-8 text-forest-700 animate-spin mx-auto mb-3" />
          <p className="text-text-secondary text-sm">Loading member directory...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-800 dark:text-rose-300">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-600" />
          <p className="font-semibold text-base">Error Loading Directory</p>
          <p className="text-sm mt-1">{error}</p>
          <Button variant="outline" size="sm" onClick={loadUsers} className="mt-4">
            Try Again
          </Button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-border-default bg-surface-card">
          <Users className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-medium text-text-primary">No members match your criteria</h3>
          <p className="text-sm text-text-secondary mt-1 max-w-sm mx-auto">
            Try clearing filters or searching with a different name, email, or PoraPlan ID.
          </p>
          {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
                setStatusFilter('all');
              }}
              className="mt-4"
            >
              Clear All Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border-default bg-surface-card shadow-sm overflow-hidden">
          {/* Mobile & Tablet Responsive Cards (< lg: 1024px) */}
          <div className="lg:hidden p-3 sm:p-4 space-y-3 bg-surface-base/30">
            {filteredUsers.map((u) => {
              const initial = u.full_name ? u.full_name.charAt(0).toUpperCase() : '?';
              const isSelected = selectedUser?.id === u.id;

              return (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`p-4 rounded-xl border border-border-default bg-surface-card shadow-xs hover:border-forest-600 transition-all cursor-pointer space-y-3 ${
                    isSelected ? 'ring-2 ring-forest-600 bg-forest-900/5 dark:bg-forest-100/5' : ''
                  }`}
                >
                  {/* Card Header: Avatar/Initials + Name + ID + Role & Status Badges */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={u.full_name}
                          className="w-10 h-10 rounded-full object-cover border border-border-default shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-forest-900/10 dark:bg-forest-100/10 text-forest-800 dark:text-forest-200 font-semibold flex items-center justify-center shrink-0 text-sm">
                          {initial}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 leading-tight">
                          <p className="font-semibold text-text-primary text-sm truncate">{u.full_name}</p>
                          {u.poraplan_id && (
                            <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-surface-base border border-border-default text-text-primary shrink-0">
                              {u.poraplan_id}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <Badge variant={getRoleBadgeVariant(u.role)} size="sm">
                            {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                          </Badge>
                          <Badge variant={getStatusBadgeVariant(u.status)} size="sm">
                            {u.status === 'not_activated'
                              ? 'Not Activated'
                              : u.status === 'suspended'
                              ? 'Suspended'
                              : 'Active'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Secondary Details */}
                  <div className="p-2.5 rounded-lg bg-surface-base border border-border-default/70 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-muted text-[11px] flex items-center gap-1 shrink-0">
                        <Mail className="w-3.5 h-3.5 text-text-muted" /> Email
                      </span>
                      <span className="text-text-primary font-medium truncate max-w-[200px] sm:max-w-[260px]" title={u.email}>
                        {u.email}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border-default/40">
                      <span className="text-text-muted text-[11px] flex items-center gap-1 shrink-0">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
                      </span>
                      <span className="text-text-secondary font-mono">
                        {u.whatsapp_number || '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border-default/40">
                      <span className="text-text-muted text-[11px] flex items-center gap-1 shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-text-muted" /> Registered
                      </span>
                      <span className="text-text-secondary font-mono">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Card Action CTA */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedUser(u)}
                      className="w-full min-h-[44px] flex items-center justify-center gap-1 text-xs font-semibold text-forest-700 hover:text-forest-900 dark:text-forest-300"
                    >
                      View Details & Profile
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (>= lg: 1024px) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-base/50 text-text-secondary text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4">Member</th>
                  <th className="py-3.5 px-4">ID</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Contact</th>
                  <th className="py-3.5 px-4 hidden lg:table-cell">Registered</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {filteredUsers.map((u) => {
                  const initial = u.full_name ? u.full_name.charAt(0).toUpperCase() : '?';
                  const isSelected = selectedUser?.id === u.id;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-surface-base/80 transition-colors cursor-pointer ${
                        isSelected ? 'bg-forest-900/5 dark:bg-forest-100/5' : ''
                      }`}
                      onClick={() => setSelectedUser(u)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.full_name}
                              className="w-9 h-9 rounded-full object-cover border border-border-default flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-forest-900/10 dark:bg-forest-100/10 text-forest-800 dark:text-forest-200 font-semibold flex items-center justify-center flex-shrink-0 text-sm">
                              {initial}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-text-primary truncate">{u.full_name}</p>
                            <p className="text-xs text-text-secondary truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {u.poraplan_id ? (
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-base border border-border-default text-text-primary">
                            {u.poraplan_id}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge variant={getRoleBadgeVariant(u.role)}>
                          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge variant={getStatusBadgeVariant(u.status)}>
                          {u.status === 'not_activated'
                            ? 'Not Activated'
                            : u.status === 'suspended'
                            ? 'Suspended'
                            : 'Active'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 hidden md:table-cell text-xs text-text-secondary whitespace-nowrap">
                        {u.whatsapp_number ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            {u.whatsapp_number}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 hidden lg:table-cell text-xs text-text-muted whitespace-nowrap">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(u);
                          }}
                          className="text-xs font-medium text-forest-700 hover:text-forest-900 dark:text-forest-300"
                        >
                          View Details
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="py-3 px-4 bg-surface-base/30 border-t border-border-default flex justify-between items-center text-xs text-text-secondary">
            <span>Showing {filteredUsers.length} of {users.length} members</span>
          </div>
        </div>
      )}

      {/* User Detail Drawer / Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="User dossier"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="w-full max-w-xl bg-surface-card border-l border-border-default shadow-2xl h-full flex flex-col overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-border-default flex items-start justify-between bg-surface-base/30 sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-4">
                {selectedUser.avatar_url ? (
                  <img
                    src={selectedUser.avatar_url}
                    alt={selectedUser.full_name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-forest-600/30"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-forest-900/10 dark:bg-forest-100/10 text-forest-800 dark:text-forest-200 font-bold text-xl flex items-center justify-center">
                    {selectedUser.full_name ? selectedUser.full_name.charAt(0).toUpperCase() : '?'}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold font-serif text-text-primary">{selectedUser.full_name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {selectedUser.poraplan_id && (
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-base border border-border-default text-text-primary">
                        {selectedUser.poraplan_id}
                      </span>
                    )}
                    <Badge variant={getRoleBadgeVariant(selectedUser.role)}>
                      {selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                    </Badge>
                    <Badge variant={getStatusBadgeVariant(selectedUser.status)}>
                      {selectedUser.status === 'not_activated'
                        ? 'Not Activated'
                        : selectedUser.status === 'suspended'
                        ? 'Suspended'
                        : 'Active'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/profile/${selectedUser.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-default bg-surface-base hover:bg-surface-card text-xs font-medium text-text-primary transition-colors"
                  title="Open Public Profile in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
                  <span>Public Profile</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="min-w-[44px] min-h-[44px] p-2 -mr-1 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-base transition-colors"
                  aria-label="Close user dossier"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Account & Contact Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Account & Contact Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg border border-border-default bg-surface-base/50">
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> Primary Auth Email
                    </span>
                    <p className="font-medium text-text-primary mt-0.5 truncate">{selectedUser.email}</p>
                  </div>

                  <div className="p-3 rounded-lg border border-border-default bg-surface-base/50">
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> Linked Email
                    </span>
                    <p className="font-medium text-text-primary mt-0.5 truncate">
                      {selectedUser.linked_email || 'Not connected'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border-default bg-surface-base/50">
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> WhatsApp / Phone
                    </span>
                    <p className="font-medium text-text-primary mt-0.5">
                      {selectedUser.whatsapp_number || 'Not provided'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border-default bg-surface-base/50">
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Member Since
                    </span>
                    <p className="font-medium text-text-primary mt-0.5">
                      {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Academic Profile Background */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Academic Background</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg border border-border-default bg-surface-base/50">
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" /> Institution
                    </span>
                    <p className="font-medium text-text-primary mt-0.5">
                      {selectedUser.university || 'Not specified'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border-default bg-surface-base/50">
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" /> Department & Batch
                    </span>
                    <p className="font-medium text-text-primary mt-0.5">
                      {selectedUser.department ? `${selectedUser.department}${selectedUser.batch ? ` (${selectedUser.batch})` : ''}` : 'Not specified'}
                    </p>
                  </div>
                </div>

                {selectedUser.bio && (
                  <div className="p-3.5 rounded-lg border border-border-default bg-surface-base/30 text-sm">
                    <span className="text-xs text-text-muted block font-semibold mb-1">Biography</span>
                    <p className="text-text-secondary leading-relaxed">{selectedUser.bio}</p>
                  </div>
                )}

                {selectedUser.expertise && (
                  <div className="p-3.5 rounded-lg border border-border-default bg-surface-base/30 text-sm">
                    <span className="text-xs text-text-muted block font-semibold mb-1">Expertise & Subjects</span>
                    <p className="text-text-secondary">{selectedUser.expertise}</p>
                  </div>
                )}
              </div>

              {/* Dynamic Role-Based Associations */}
              {drawerLoading ? (
                <div className="p-6 text-center rounded-lg border border-border-default bg-surface-base/30">
                  <RefreshCw className="w-5 h-5 text-forest-700 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-text-muted">Loading academic relationships...</p>
                </div>
              ) : selectedUser.role === 'student' ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Active Enrollments & Mentorship</h3>
                  
                  {/* Assigned Mentor Card */}
                  <div className="p-3.5 rounded-lg border border-border-default bg-surface-base/50">
                    <span className="text-xs text-text-muted block font-semibold mb-1">Dedicated Academic Mentor</span>
                    {assignedMentor ? (
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-teal-900/10 text-teal-800 dark:text-teal-200 font-bold text-xs flex items-center justify-center">
                            {assignedMentor.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary">{assignedMentor.full_name}</p>
                            <p className="text-xs text-text-secondary">{assignedMentor.email}</p>
                          </div>
                        </div>
                        {assignedMentor.poraplan_id && (
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-card border border-border-default">
                            {assignedMentor.poraplan_id}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted mt-1 italic">No individual mentor override assigned.</p>
                    )}
                  </div>

                  {/* Enrollments List */}
                  <div className="space-y-2">
                    <span className="text-xs text-text-muted block font-semibold">Enrolled Programs ({userEnrollments.length})</span>
                    {userEnrollments.length === 0 ? (
                      <p className="text-xs text-text-muted italic p-3 rounded-lg border border-border-default bg-surface-base/20">
                        No program enrollments recorded for this scholar.
                      </p>
                    ) : (
                      userEnrollments.map((enr) => (
                        <div
                          key={enr.id}
                          className="p-3 rounded-lg border border-border-default bg-surface-card flex items-center justify-between text-sm"
                        >
                          <div>
                            <p className="font-medium text-text-primary">{enr.program?.name || 'Program'}</p>
                            <p className="text-xs text-text-secondary mt-0.5">
                              Cohort: {enr.cohort?.name || 'No Cohort'} ({enr.cohort?.code || 'N/A'})
                            </p>
                          </div>
                          <Badge variant={enr.status === 'active' ? 'teal' : 'paper'}>
                            {enr.status.toUpperCase()}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : selectedUser.role === 'mentor' ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Assigned Scholars ({assignedStudents.length})
                  </h3>
                  {assignedStudents.length === 0 ? (
                    <p className="text-xs text-text-muted italic p-3 rounded-lg border border-border-default bg-surface-base/20">
                      No scholars currently assigned to this mentor.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {assignedStudents.map((rel, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border border-border-default bg-surface-card flex items-center justify-between text-sm"
                        >
                          <div>
                            <p className="font-medium text-text-primary">{rel.student.full_name}</p>
                            <p className="text-xs text-text-secondary">
                              {rel.programName ? `${rel.programName} • ` : ''}{rel.cohortName || 'General'}
                            </p>
                          </div>
                          {rel.student.poraplan_id && (
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-base border border-border-default">
                              {rel.student.poraplan_id}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Administrative Security Operations */}
              <div className="space-y-3 pt-4 border-t border-border-default">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-forest-700" />
                  Account Security Actions
                </h3>

                {/* Password Recovery Action */}
                <div className="p-4 rounded-xl border border-border-default bg-surface-base/40 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-forest-700" />
                      Send Password Recovery Link
                    </h4>
                    <p className="text-xs text-text-secondary mt-1">
                      Dispatches an official Supabase Auth recovery link to the user&apos;s registered email address (<strong>{selectedUser.email}</strong>).
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTriggerPasswordReset}
                    disabled={isSendingReset}
                    className="flex items-center gap-2"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {isSendingReset ? 'Dispatching Recovery Email...' : 'Send Recovery Email'}
                  </Button>
                </div>

                {/* Account Suspension Notice (Deferred as instructed by Milestone 9 specifications) */}
                <div className="p-4 rounded-xl border border-border-default bg-surface-base/40 flex items-start gap-3">
                  <Info className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-text-secondary space-y-1">
                    <p className="font-semibold text-text-primary">Server-Side Account Suspension</p>
                    <p>
                      In compliance with strict platform auth safety, active token invalidation and credential revocation require an authorized Supabase Edge Function with service-role permissions. Client-only toggles are deferred to prevent false security guarantees.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-border-default bg-surface-base/30 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
                Close Panel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
