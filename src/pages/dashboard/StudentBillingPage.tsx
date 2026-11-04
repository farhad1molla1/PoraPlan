import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getMyStudentPaymentRecords,
  getPaymentEvents,
} from '../../lib/payments';
import {
  formatCalendarDate,
  diffInDays,
  toBangladeshDateStr,
} from '../../lib/billingCycles';
import { formatLocalDate } from '../../lib/library';
import type {
  StudentPaymentRecord,
  PaymentEvent,
  StudentPaymentStatus,
} from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  CreditCard,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Check,
  Calendar,
  Hash,
  FileText,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Info,
  Copy,
  CheckCheck,
  X,
  Search,
  Eye,
} from 'lucide-react';

// ==============================================================================
// HELPER FORMATTERS
// ==============================================================================

function formatPaymentMethod(method?: string | null): string {
  if (!method) return 'Not recorded';
  switch (method.toLowerCase()) {
    case 'bkash':
      return 'bKash';
    case 'nagad':
      return 'Nagad';
    case 'upay':
      return 'Upay';
    case 'cash':
      return 'Cash';
    case 'bank':
      return 'Bank Transfer';
    default:
      return method.charAt(0).toUpperCase() + method.slice(1);
  }
}

function getStatusBadge(status: StudentPaymentStatus) {
  switch (status) {
    case 'paid':
      return (
        <Badge variant="teal" size="sm" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Paid
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="gold" size="sm" className="gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </Badge>
      );
    case 'partial':
      return (
        <Badge variant="paper" size="sm" className="gap-1">
          <Layers className="w-3 h-3" />
          Partial
        </Badge>
      );
    case 'overdue':
      return (
        <Badge variant="danger" size="sm" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          Overdue
        </Badge>
      );
    case 'waived':
      return (
        <Badge variant="muted" size="sm" className="gap-1">
          <Check className="w-3 h-3" />
          Waived
        </Badge>
      );
    default:
      return <Badge variant="paper" size="sm">{status}</Badge>;
  }
}

function getStatusDescription(status: StudentPaymentStatus): string {
  switch (status) {
    case 'paid':
      return 'Cycle Settled — You are fully covered for this learning period.';
    case 'pending':
      return 'Payment Recorded — Administration is processing your renewal.';
    case 'partial':
      return 'Partial Payment Recorded — Additional installment scheduled.';
    case 'overdue':
      return 'Renewal Due — Please contact administration. Academic access remains active.';
    case 'waived':
      return 'Administrative Waiver Active — Approved institutional exemption.';
    default:
      return 'Status recorded by administration.';
  }
}

// ==============================================================================
// RECORD DETAILS SLIDE-OVER DRAWER
// ==============================================================================

interface StudentBillingDrawerProps {
  record: StudentPaymentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onCopyReference: (text: string, id: string) => void;
  copiedId: string | null;
}

const StudentBillingDrawer: React.FC<StudentBillingDrawerProps> = ({
  record,
  isOpen,
  onClose,
  onCopyReference,
  copiedId,
}) => {
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    if (!record || !isOpen) {
      setEvents([]);
      return;
    }

    let isMounted = true;
    setEventsLoading(true);

    getPaymentEvents('student', record.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.error) {
          setEvents([]);
        } else {
          setEvents(res.events);
        }
        setEventsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setEvents([]);
        setEventsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [record, isOpen]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !record) return null;

  const todayBD = toBangladeshDateStr();
  const daysUntilDue = diffInDays(todayBD, record.next_due_date);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-brand-dark/45 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-xl w-full bg-brand-paper border-l-2 border-brand-dark shadow-2xl z-50 overflow-y-auto flex flex-col justify-between">
        {/* Drawer Header */}
        <div className="p-5 border-b-2 border-brand-dark bg-brand-navy text-brand-paper sticky top-0 z-10 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-brand-paper/75 font-bold">
              Billing Record Details
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-heading font-extrabold text-brand-paper">
                {formatCalendarDate(record.cycle_start_date)} – {formatCalendarDate(record.cycle_end_date)}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(record.status)}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-brand-paper text-brand-dark border border-brand-dark hover:bg-brand-paper-tint transition-colors"
              title="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Status Explanation Card */}
          <div className="p-4 bg-brand-bg border-2 border-brand-dark shadow-brutal-xs flex items-start gap-3">
            <Info className="w-5 h-5 text-brand-teal shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm font-sans text-brand-dark">
              <div className="font-heading font-bold uppercase text-[11px] text-brand-navy">
                Status Overview
              </div>
              <p className="mt-0.5 leading-relaxed">
                {getStatusDescription(record.status)}
              </p>
            </div>
          </div>

          {/* Section 1: Cycle Schedule */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase font-bold text-brand-muted tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-teal" />
              Cycle Schedule & Timing
            </h3>
            <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-mono uppercase text-brand-muted block">Cycle Start Date</span>
                  <span className="font-heading font-bold text-brand-dark text-sm">
                    {formatCalendarDate(record.cycle_start_date)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-brand-muted block">Cycle End Date</span>
                  <span className="font-heading font-bold text-brand-dark text-sm">
                    {formatCalendarDate(record.cycle_end_date)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-brand-dark/15 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-mono uppercase text-brand-muted block">Renewal Due Date</span>
                  <span className="font-heading font-bold text-brand-navy text-sm">
                    {formatCalendarDate(record.next_due_date)}
                  </span>
                </div>
                <div>
                  {record.status === 'paid' ? (
                    <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-teal-100 text-teal-800 border border-teal-600">
                      Settled
                    </span>
                  ) : daysUntilDue > 0 ? (
                    <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-600">
                      In {daysUntilDue} days
                    </span>
                  ) : daysUntilDue === 0 ? (
                    <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-600">
                      Due Today
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-600">
                      Past Due
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Transaction Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase font-bold text-brand-muted tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-brand-teal" />
              Payment & Transaction Information
            </h3>
            <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs space-y-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-brand-muted font-mono uppercase text-[11px]">Payment Method</span>
                <span className="font-heading font-bold text-brand-dark text-sm">
                  {formatPaymentMethod(record.payment_method)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-brand-dark/10">
                <span className="text-brand-muted font-mono uppercase text-[11px]">Payment Date</span>
                <span className="font-heading font-bold text-brand-dark text-sm">
                  {record.payment_date ? formatCalendarDate(record.payment_date) : 'Pending Recording'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-brand-dark/10">
                <span className="text-brand-muted font-mono uppercase text-[11px]">Transaction Reference</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-brand-navy font-bold text-xs">
                    {record.transaction_reference || 'Not recorded'}
                  </span>
                  {record.transaction_reference && (
                    <button
                      type="button"
                      onClick={() => onCopyReference(record.transaction_reference || '', `drawer-${record.id}`)}
                      className="p-1 hover:bg-brand-paper-tint text-brand-muted hover:text-brand-dark border border-brand-dark/30 transition-colors"
                      title="Copy transaction reference"
                    >
                      {copiedId === `drawer-${record.id}` ? (
                        <CheckCheck className="w-3 h-3 text-brand-teal" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {record.status === 'waived' && record.waived_reason && (
                <div className="p-3 bg-brand-paper-tint border border-brand-dark/30 mt-2 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-brand-muted block font-bold">Waiver Reason</span>
                  <p className="font-sans text-brand-dark leading-relaxed">
                    {record.waived_reason}
                  </p>
                </div>
              )}

              {record.created_at && (
                <div className="flex justify-between items-center py-1 border-t border-brand-dark/10 text-brand-muted text-[11px]">
                  <span>System Entry Date</span>
                  <span className="font-mono">{formatLocalDate(new Date(record.created_at))}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Child Payment Events Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase font-bold text-brand-muted tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brand-teal" />
                Payment Activity Timeline ({events.length})
              </h3>
              {eventsLoading && <RefreshCw className="w-3 h-3 animate-spin text-brand-teal" />}
            </div>

            {eventsLoading ? (
              <div className="p-4 bg-brand-bg border border-brand-dark/20 text-center text-xs text-brand-muted animate-pulse">
                Loading payment activity...
              </div>
            ) : events.length === 0 ? (
              <div className="p-4 bg-brand-bg border-2 border-brand-dark/25 shadow-brutal-xs text-xs font-sans text-brand-muted text-center">
                No installment events recorded for this billing cycle.
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 bg-brand-bg border-2 border-brand-dark shadow-brutal-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-heading font-bold text-brand-navy">
                        {formatPaymentMethod(evt.payment_method)}
                      </span>
                      <span className="font-mono text-[11px] text-brand-muted">
                        {formatCalendarDate(evt.payment_date)}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-brand-dark flex items-center justify-between">
                      <span className="text-brand-muted">Reference:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-bold">{evt.transaction_reference || 'Not recorded'}</span>
                        {evt.transaction_reference && (
                          <button
                            type="button"
                            onClick={() => onCopyReference(evt.transaction_reference || '', `evt-${evt.id}`)}
                            className="p-0.5 hover:bg-brand-paper-tint text-brand-muted hover:text-brand-dark"
                            title="Copy reference"
                          >
                            {copiedId === `evt-${evt.id}` ? (
                              <CheckCheck className="w-2.5 h-2.5 text-brand-teal" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Support & Assistance Notice */}
          <div className="p-4 bg-emerald-50 border-2 border-brand-dark shadow-brutal-xs flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-xs font-sans text-emerald-950 leading-relaxed">
              <strong className="font-heading font-bold text-emerald-900 block">Support Coordination: </strong>
              If you have made a payment that is not yet reflected or need assistance with billing adjustments, please coordinate directly with PoraPlan Administration.
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t-2 border-brand-dark bg-brand-paper flex items-center justify-end sticky bottom-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Inspection
          </Button>
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// MAIN COMPONENT
// ==============================================================================

export const StudentBillingPage: React.FC = () => {
  const { user, profile } = useAuth();
  const studentId = profile?.id || user?.id || '';

  const [records, setRecords] = useState<StudentPaymentRecord[]>([]);
  const [selectedRecordForDrawer, setSelectedRecordForDrawer] = useState<StudentPaymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | StudentPaymentStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const fetchRecords = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await getMyStudentPaymentRecords();
      if (res.error) throw res.error;
      setRecords(res.records);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load payment and billing records.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Active / current cycle record (most recent cycle_start_date)
  const activeRecord = useMemo(() => {
    if (records.length === 0) return null;
    return records[0];
  }, [records]);

  // Today in Asia/Dhaka
  const todayBD = toBangladeshDateStr();

  // Days until due for active record
  const activeDaysUntilDue = useMemo(() => {
    if (!activeRecord) return 0;
    return diffInDays(todayBD, activeRecord.next_due_date);
  }, [activeRecord, todayBD]);

  // Filter & Search records
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchMethod = formatPaymentMethod(r.payment_method).toLowerCase().includes(q);
          const matchRef = (r.transaction_reference || '').toLowerCase().includes(q);
          const matchDates = r.cycle_start_date.includes(q) || r.cycle_end_date.includes(q) || r.next_due_date.includes(q);
          if (!matchMethod && !matchRef && !matchDates) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const compare = a.cycle_start_date.localeCompare(b.cycle_start_date);
        return sortOrder === 'desc' ? -compare : compare;
      });
  }, [records, statusFilter, searchQuery, sortOrder]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="bg-brand-navy text-brand-paper p-5 sm:p-6 border-2 border-brand-dark shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-brand-gold text-brand-dark border-2 border-brand-dark shadow-brutal-xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-heading font-extrabold tracking-tight text-brand-paper uppercase">
              Billing & Payments
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-sans text-brand-paper/85">
            Monitor your enrollment billing cycles, payment records, and renewal status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRecords}
            disabled={loading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            className="bg-brand-paper text-brand-dark"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Academic Access Guarantee Banner */}
      <div className="p-4 bg-emerald-50 border-2 border-brand-dark shadow-brutal-sm flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm font-sans text-emerald-950 leading-relaxed">
          <strong className="font-heading font-bold text-emerald-900">Academic Access Guarantee: </strong>
          Your study plans, daily tasks, practice assignments, library resources, and mentor communications remain fully active and accessible regardless of billing cycle status.
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border-2 border-brand-dark shadow-brutal-sm flex items-start gap-3 text-red-900">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm font-sans">
            <p className="font-bold">Error loading billing records</p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRecords} className="shrink-0">
            Try Again
          </Button>
        </div>
      )}

      {/* Skeleton Loading State */}
      {loading && records.length === 0 && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-28 bg-brand-paper/60 border-2 border-brand-dark shadow-brutal-xs p-4" />
            ))}
          </div>
          <div className="h-44 bg-brand-paper/60 border-2 border-brand-dark shadow-brutal p-6" />
          <div className="h-64 bg-brand-paper/60 border-2 border-brand-dark shadow-brutal p-6" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && records.length === 0 && (
        <div className="p-10 text-center bg-brand-paper border-2 border-brand-dark shadow-brutal space-y-3">
          <div className="w-12 h-12 mx-auto bg-brand-paper-tint border-2 border-brand-dark shadow-brutal-xs flex items-center justify-center text-brand-muted">
            <CreditCard className="w-6 h-6" />
          </div>
          <h2 className="text-base sm:text-lg font-heading font-extrabold text-brand-navy uppercase">
            No Billing Records Found
          </h2>
          <p className="text-xs sm:text-sm font-sans text-brand-muted max-w-md mx-auto">
            Your academic enrollment records are initializing, or no billing cycles have been generated by administration yet.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRecords}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Check for Updates
          </Button>
        </div>
      )}

      {/* Main Content when records exist */}
      {records.length > 0 && (
        <div className="space-y-6">
          {/* SECTION A: Billing Overview KPI Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Current Status */}
            <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-brand-muted uppercase">
                <span>Current Status</span>
                <Clock className="w-4 h-4 text-brand-teal" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                {activeRecord ? getStatusBadge(activeRecord.status) : <span className="text-sm font-bold">None</span>}
              </div>
              <p className="mt-2 text-[11px] font-sans text-brand-muted line-clamp-1">
                {activeRecord ? getStatusDescription(activeRecord.status) : 'No active cycle recorded'}
              </p>
            </div>

            {/* KPI 2: Current Billing Cycle */}
            <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-brand-muted uppercase">
                <span>Billing Period</span>
                <Calendar className="w-4 h-4 text-brand-teal" />
              </div>
              <div className="mt-2 text-sm sm:text-base font-heading font-extrabold text-brand-navy truncate">
                {activeRecord
                  ? `${formatCalendarDate(activeRecord.cycle_start_date)} – ${formatCalendarDate(activeRecord.cycle_end_date)}`
                  : 'Not scheduled'}
              </div>
              <p className="mt-2 text-[11px] font-mono text-brand-muted">
                Anchored to enrollment anniversary
              </p>
            </div>

            {/* KPI 3: Next Due Date */}
            <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-brand-muted uppercase">
                <span>Next Renewal Due</span>
                <CheckCircle2 className="w-4 h-4 text-brand-teal" />
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="text-sm sm:text-base font-heading font-extrabold text-brand-navy">
                  {activeRecord ? formatCalendarDate(activeRecord.next_due_date) : 'Pending'}
                </span>
                {activeRecord && (
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border ${
                    activeRecord.status === 'paid'
                      ? 'bg-teal-50 text-teal-800 border-teal-300'
                      : activeDaysUntilDue > 0
                      ? 'bg-blue-50 text-blue-800 border-blue-300'
                      : activeDaysUntilDue === 0
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}>
                    {activeRecord.status === 'paid' ? 'Settled' : activeDaysUntilDue === 0 ? 'Today' : activeDaysUntilDue > 0 ? `${activeDaysUntilDue}d` : 'Overdue'}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[11px] font-sans text-brand-muted">
                {activeDaysUntilDue >= 0 ? 'Upcoming renewal window' : 'Cycle concluded scheduled term'}
              </p>
            </div>

            {/* KPI 4: Recorded Method & Date */}
            <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-brand-muted uppercase">
                <span>Payment Method</span>
                <CreditCard className="w-4 h-4 text-brand-teal" />
              </div>
              <div className="mt-2 text-sm sm:text-base font-heading font-extrabold text-brand-navy truncate">
                {activeRecord ? formatPaymentMethod(activeRecord.payment_method) : 'Not recorded'}
              </div>
              <p className="mt-2 text-[11px] font-mono text-brand-muted truncate">
                {activeRecord?.payment_date ? `Paid: ${formatCalendarDate(activeRecord.payment_date)}` : 'Payment date pending'}
              </p>
            </div>
          </div>

          {/* SECTION B: Overdue Polite Reassurance Callout */}
          {activeRecord && activeRecord.status === 'overdue' && (
            <div className="p-4 sm:p-5 bg-amber-50 border-2 border-brand-dark shadow-brutal-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs sm:text-sm font-sans text-amber-950">
                <div className="font-heading font-extrabold uppercase tracking-wide text-amber-900 text-sm">
                  Renewal Coordination Notice
                </div>
                <p className="leading-relaxed">
                  Your billing cycle has concluded its scheduled period. Please contact PoraPlan Administration to record your upcoming renewal details.
                </p>
                <p className="text-[11px] text-amber-800 font-medium">
                  Important: Under our Academic Access Guarantee, your classes, assignments, mentors, and learning resources remain 100% active and unrestricted.
                </p>
              </div>
            </div>
          )}

          {/* SECTION C: Active Billing Record Card */}
          {activeRecord && (
            <section
              aria-label="Active Billing Record"
              className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-brand-dark/15">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase font-bold text-brand-muted tracking-wider">
                      Active Billing Record
                    </span>
                    <span className="inline-block w-2 h-2 rounded-full bg-brand-teal" />
                  </div>
                  <h2 className="text-base sm:text-lg font-heading font-extrabold text-brand-navy">
                    {formatCalendarDate(activeRecord.cycle_start_date)} – {formatCalendarDate(activeRecord.cycle_end_date)}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(activeRecord.status)}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRecordForDrawer(activeRecord)}
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                    className="text-xs"
                  >
                    View Details
                  </Button>
                </div>
              </div>

              {/* Grid Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                <div className="p-3 bg-brand-bg border-2 border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted uppercase">
                    <Calendar className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Renewal Due Date</span>
                  </div>
                  <div className="mt-1 font-heading font-bold text-sm sm:text-base text-brand-navy">
                    {formatCalendarDate(activeRecord.next_due_date)}
                  </div>
                </div>

                <div className="p-3 bg-brand-bg border-2 border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted uppercase">
                    <CreditCard className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Payment Method</span>
                  </div>
                  <div className="mt-1 font-heading font-bold text-sm sm:text-base text-brand-navy">
                    {formatPaymentMethod(activeRecord.payment_method)}
                  </div>
                </div>

                <div className="p-3 bg-brand-bg border-2 border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Payment Date</span>
                  </div>
                  <div className="mt-1 font-heading font-bold text-sm sm:text-base text-brand-navy">
                    {activeRecord.payment_date ? formatCalendarDate(activeRecord.payment_date) : 'Pending Recording'}
                  </div>
                </div>

                <div className="p-3 bg-brand-bg border-2 border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center justify-between text-xs font-mono text-brand-muted uppercase">
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-brand-teal" />
                      <span>Transaction Ref</span>
                    </div>
                    {activeRecord.transaction_reference && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(activeRecord.transaction_reference || '', 'active-ref')}
                        className="hover:text-brand-dark"
                        title="Copy reference"
                      >
                        {copiedId === 'active-ref' ? (
                          <CheckCheck className="w-3 h-3 text-brand-teal" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-xs sm:text-sm text-brand-navy truncate" title={activeRecord.transaction_reference || 'Not recorded'}>
                    {activeRecord.transaction_reference || 'Not recorded'}
                  </div>
                </div>
              </div>

              {activeRecord.status === 'waived' && activeRecord.waived_reason && (
                <div className="mt-4 p-3 bg-brand-paper-tint border-2 border-brand-dark/30 text-xs font-sans text-brand-dark flex items-start gap-2 shadow-brutal-xs">
                  <Info className="w-4 h-4 text-brand-muted shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Waiver Reason: </strong>
                    {activeRecord.waived_reason}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SECTION D: Historical Records Ledger */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-heading font-extrabold text-brand-navy uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-teal" />
                  Payment Records History ({filteredRecords.length})
                </h3>
                <p className="text-xs font-sans text-brand-muted mt-0.5">
                  Complete historical record of all your enrolled learning cycles.
                </p>
              </div>

              {/* Search & Sort Controls */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-brand-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8 pr-3 py-1 text-xs border-2 border-brand-dark bg-brand-paper shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-gold w-44 sm:w-56"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-dark"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="px-2.5 py-1 text-xs font-heading font-bold uppercase border-2 border-brand-dark bg-brand-paper shadow-brutal-xs hover:bg-brand-paper-tint transition-colors flex items-center gap-1"
                  title="Toggle sort order"
                >
                  <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs">
              {(['all', 'paid', 'pending', 'partial', 'overdue', 'waived'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 font-heading text-xs font-bold uppercase transition-all ${
                    statusFilter === st
                      ? 'bg-brand-navy text-brand-paper border-2 border-brand-dark shadow-brutal-xs'
                      : 'text-brand-dark hover:bg-brand-bg border border-transparent'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Records List / Table */}
            {filteredRecords.length === 0 ? (
              <div className="p-8 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs text-center space-y-2">
                <FileText className="w-8 h-8 text-brand-muted mx-auto" />
                <p className="text-xs sm:text-sm font-sans text-brand-muted">
                  No payment records match your search or filter criteria.
                </p>
                {(statusFilter !== 'all' || searchQuery) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStatusFilter('all');
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal-sm overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-brand-navy text-brand-paper border-b-2 border-brand-dark font-heading uppercase text-[11px]">
                    <tr>
                      <th className="p-3">Billing Cycle Period</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Renewal Due Date</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Payment Date</th>
                      <th className="p-3">Transaction Reference</th>
                      <th className="p-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/15">
                    {paginatedRecords.map((r) => {
                      const isOverdue = r.status === 'overdue';
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedRecordForDrawer(r)}
                          className={`hover:bg-brand-paper-tint/70 transition-colors cursor-pointer ${
                            isOverdue ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          <td className="p-3 font-heading font-bold text-brand-navy text-xs">
                            <div className="flex items-center gap-1.5">
                              <span>
                                {formatCalendarDate(r.cycle_start_date)} – {formatCalendarDate(r.cycle_end_date)}
                              </span>
                              {activeRecord?.id === r.id && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-teal" title="Active cycle" />
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            {getStatusBadge(r.status)}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-brand-dark">
                            {formatCalendarDate(r.next_due_date)}
                          </td>
                          <td className="p-3 font-medium">
                            {formatPaymentMethod(r.payment_method)}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-brand-muted">
                            {r.payment_date ? formatCalendarDate(r.payment_date) : 'Pending'}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-brand-dark" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5 max-w-[140px]">
                              <span className="truncate">{r.transaction_reference || '—'}</span>
                              {r.transaction_reference && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(r.transaction_reference || '', `row-${r.id}`)}
                                  className="text-brand-muted hover:text-brand-dark shrink-0"
                                  title="Copy reference"
                                >
                                  {copiedId === `row-${r.id}` ? (
                                    <CheckCheck className="w-3 h-3 text-brand-teal" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2.5 py-1 text-[11px]"
                              onClick={() => setSelectedRecordForDrawer(r)}
                              leftIcon={<Eye className="w-3 h-3" />}
                            >
                              Details
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-3 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs flex items-center justify-between text-xs font-mono">
                <span className="text-brand-muted">
                  Page {currentPage} of {totalPages} ({filteredRecords.length} total records)
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 text-[11px]"
                    leftIcon={<ChevronLeft className="w-3 h-3" />}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2 py-1 text-[11px]"
                    rightIcon={<ChevronRight className="w-3 h-3" />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide-over Inspection Drawer */}
      <StudentBillingDrawer
        record={selectedRecordForDrawer}
        isOpen={Boolean(selectedRecordForDrawer)}
        onClose={() => setSelectedRecordForDrawer(null)}
        onCopyReference={copyToClipboard}
        copiedId={copiedId}
      />
    </div>
  );
};
