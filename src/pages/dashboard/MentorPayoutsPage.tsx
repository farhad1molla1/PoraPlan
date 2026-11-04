import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getMyMentorPaymentRecords,
  getMyMentorPaymentRecordById,
  getPaymentEvents,
} from '../../lib/payments';
import { formatCalendarDate } from '../../lib/billingCycles';
import { formatLocalDate } from '../../lib/library';
import type {
  MentorPaymentRecord,
  MentorPaymentRecordWithMeta,
  PaymentEvent,
  MentorPaymentStatus,
} from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  CreditCard,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Calendar,
  Hash,
  FileText,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  User,
  GraduationCap,
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

function formatBillingMonth(monthStr: string): string {
  if (!monthStr) return 'Not recorded';
  const parts = monthStr.split('-');
  if (parts.length >= 2) {
    const year = parts[0];
    const monthNum = parseInt(parts[1], 10);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    if (monthNum >= 1 && monthNum <= 12) {
      return `${monthNames[monthNum - 1]} ${year}`;
    }
  }
  return monthStr;
}

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

function getStatusBadge(status: MentorPaymentStatus) {
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
    default:
      return <Badge variant="paper" size="sm">{status}</Badge>;
  }
}

function getStatusDescription(status: MentorPaymentStatus): string {
  switch (status) {
    case 'paid':
      return 'Disbursed — Payout has been completed and transferred for this period.';
    case 'pending':
      return 'In Review — Scheduled for disbursement processing by administration.';
    case 'partial':
      return 'Partial Disbursement — An installment has been processed for this cycle.';
    default:
      return 'Status recorded by administration.';
  }
}

// ==============================================================================
// RECORD DETAILS SLIDE-OVER DRAWER
// ==============================================================================

interface MentorPayoutDrawerProps {
  record: MentorPaymentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onCopyReference: (text: string, id: string) => void;
  copiedId: string | null;
}

const MentorPayoutDrawer: React.FC<MentorPayoutDrawerProps> = ({
  record,
  isOpen,
  onClose,
  onCopyReference,
  copiedId,
}) => {
  const [metaRecord, setMetaRecord] = useState<MentorPaymentRecordWithMeta | null>(null);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!record || !isOpen) {
      setMetaRecord(null);
      setEvents([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    Promise.all([
      getMyMentorPaymentRecordById(record.id, { withMeta: true }),
      getPaymentEvents('mentor', record.id),
    ])
      .then(([metaRes, eventsRes]) => {
        if (!isMounted) return;
        if (metaRes.error) {
          setMetaRecord(null);
        } else {
          setMetaRecord(metaRes.record as MentorPaymentRecordWithMeta);
        }

        if (eventsRes.error) {
          setEvents([]);
        } else {
          setEvents(eventsRes.events);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setMetaRecord(null);
        setEvents([]);
        setLoading(false);
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

  const displayRecord = metaRecord || record;

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
              Payout Record Details
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-heading font-extrabold text-brand-paper">
                {formatBillingMonth(displayRecord.billing_month)}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(displayRecord.status)}
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
          {/* Status Overview Card */}
          <div className="p-4 bg-brand-bg border-2 border-brand-dark shadow-brutal-xs flex items-start gap-3">
            <Info className="w-5 h-5 text-brand-teal shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm font-sans text-brand-dark">
              <div className="font-heading font-bold uppercase text-[11px] text-brand-navy">
                Payout Status
              </div>
              <p className="mt-0.5 leading-relaxed">
                {getStatusDescription(displayRecord.status)}
              </p>
            </div>
          </div>

          {/* Section 1: Mentorship Context */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase font-bold text-brand-muted tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-brand-teal" />
              Mentorship Scope & Allocation
            </h3>
            <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs space-y-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-brand-muted font-mono uppercase text-[11px]">Scope Type</span>
                <span className="font-heading font-bold text-brand-dark">
                  {displayRecord.related_student_id ? 'Assigned Dedicated Scholar' : 'Cohort Mentorship Pool'}
                </span>
              </div>

              {metaRecord?.related_student && (
                <div className="flex justify-between items-center py-1 border-t border-brand-dark/10">
                  <span className="text-brand-muted font-mono uppercase text-[11px]">Scholar Name</span>
                  <span className="font-heading font-bold text-brand-navy flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-brand-teal" />
                    {metaRecord.related_student.full_name || 'Scholar'}
                    {metaRecord.related_student.poraplan_id && (
                      <span className="text-brand-muted font-mono text-[11px]">
                        ({metaRecord.related_student.poraplan_id})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Payout & Transaction Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase font-bold text-brand-muted tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-brand-teal" />
              Disbursement & Transaction Details
            </h3>
            <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs space-y-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-brand-muted font-mono uppercase text-[11px]">Disbursement Method</span>
                <span className="font-heading font-bold text-brand-dark text-sm">
                  {formatPaymentMethod(displayRecord.payment_method)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-brand-dark/10">
                <span className="text-brand-muted font-mono uppercase text-[11px]">Payout Date</span>
                <span className="font-heading font-bold text-brand-dark text-sm">
                  {displayRecord.payout_date
                    ? formatCalendarDate(displayRecord.payout_date.split('T')[0])
                    : 'Pending Disbursement'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-brand-dark/10">
                <span className="text-brand-muted font-mono uppercase text-[11px]">Transaction Reference</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-brand-navy font-bold text-xs">
                    {displayRecord.transaction_reference || 'Not recorded'}
                  </span>
                  {displayRecord.transaction_reference && (
                    <button
                      type="button"
                      onClick={() => onCopyReference(displayRecord.transaction_reference || '', `drawer-${displayRecord.id}`)}
                      className="p-1 hover:bg-brand-paper-tint text-brand-muted hover:text-brand-dark border border-brand-dark/30 transition-colors"
                      title="Copy transaction reference"
                    >
                      {copiedId === `drawer-${displayRecord.id}` ? (
                        <CheckCheck className="w-3 h-3 text-brand-teal" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {displayRecord.created_at && (
                <div className="flex justify-between items-center py-1 border-t border-brand-dark/10 text-brand-muted text-[11px]">
                  <span>System Entry Date</span>
                  <span className="font-mono">{formatLocalDate(new Date(displayRecord.created_at))}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Child Payout Activity Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase font-bold text-brand-muted tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brand-teal" />
                Disbursement Activity Timeline ({events.length})
              </h3>
              {loading && <RefreshCw className="w-3 h-3 animate-spin text-brand-teal" />}
            </div>

            {loading ? (
              <div className="p-4 bg-brand-bg border border-brand-dark/20 text-center text-xs text-brand-muted animate-pulse">
                Loading payout activity...
              </div>
            ) : events.length === 0 ? (
              <div className="p-4 bg-brand-bg border-2 border-brand-dark/25 shadow-brutal-xs text-xs font-sans text-brand-muted text-center">
                No installment events recorded for this payout cycle.
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
                        {formatCalendarDate(evt.payment_date.split('T')[0])}
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

          {/* Section 4: Support & Administration Note */}
          <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-brand-teal shrink-0 mt-0.5" />
            <div className="text-xs font-sans text-brand-dark leading-relaxed">
              <strong className="font-heading font-bold text-brand-navy block">Administrative Inquiries: </strong>
              For questions concerning payout schedules, payment method changes, or transaction inquiries, contact the PoraPlan Administration desk.
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

export const MentorPayoutsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const mentorId = profile?.id || user?.id || '';

  const [records, setRecords] = useState<MentorPaymentRecord[]>([]);
  const [selectedRecordForDrawer, setSelectedRecordForDrawer] = useState<MentorPaymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | MentorPaymentStatus>('all');
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
    if (!mentorId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await getMyMentorPaymentRecords();
      if (res.error) throw res.error;
      setRecords(res.records);
    } catch {
      setError("Couldn't load your payout information. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [mentorId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Latest payout record (most recent billing_month)
  const latestRecord = useMemo(() => {
    if (records.length === 0) return null;
    return records[0];
  }, [records]);

  // Filter & Search records
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchMonth = formatBillingMonth(r.billing_month).toLowerCase().includes(q) || r.billing_month.includes(q);
          const matchMethod = formatPaymentMethod(r.payment_method).toLowerCase().includes(q);
          const matchRef = (r.transaction_reference || '').toLowerCase().includes(q);
          if (!matchMonth && !matchMethod && !matchRef) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const compare = a.billing_month.localeCompare(b.billing_month);
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
              Payout History
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-sans text-brand-paper/85">
            Monitor your payout status, disbursement schedules, and payment history.
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

      {/* Mentorship Continuity Guarantee Banner */}
      <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-brand-teal shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm font-sans text-brand-dark leading-relaxed">
          <strong className="font-heading font-bold text-brand-navy">Mentorship Continuity Guarantee: </strong>
          Your mentor workspace, assigned scholar workspaces, study plans, assignment reviews, evaluations, and discussion channels remain fully active and accessible regardless of payout processing status.
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border-2 border-brand-dark shadow-brutal-sm flex items-start gap-3 text-red-900">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm font-sans">
            <p className="font-bold">Error loading payout records</p>
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
            No Payout Records Yet
          </h2>
          <p className="text-xs sm:text-sm font-sans text-brand-muted max-w-md mx-auto">
            Your payout information will appear here once it is recorded by the PoraPlan team.
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
          {/* SECTION A: Payout Overview KPI Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Latest Status */}
            <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-brand-muted uppercase">
                <span>Latest Status</span>
                <Clock className="w-4 h-4 text-brand-teal" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                {latestRecord ? getStatusBadge(latestRecord.status) : <span className="text-sm font-bold">None</span>}
              </div>
              <p className="mt-2 text-[11px] font-sans text-brand-muted line-clamp-1">
                {latestRecord ? getStatusDescription(latestRecord.status) : 'No recorded payouts'}
              </p>
            </div>

            {/* KPI 2: Active Billing Month */}
            <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-brand-muted uppercase">
                <span>Recent Month</span>
                <Calendar className="w-4 h-4 text-brand-teal" />
              </div>
              <div className="mt-2 text-sm sm:text-base font-heading font-extrabold text-brand-navy truncate">
                {latestRecord ? formatBillingMonth(latestRecord.billing_month) : 'None'}
              </div>
              <p className="mt-2 text-[11px] font-mono text-brand-muted">
                Monthly mentorship cycle
              </p>
            </div>

            {/* KPI 3: Latest Payout Date */}
            <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-brand-muted uppercase">
                <span>Disbursement Date</span>
                <CheckCircle2 className="w-4 h-4 text-brand-teal" />
              </div>
              <div className="mt-2 text-sm sm:text-base font-heading font-extrabold text-brand-navy">
                {latestRecord?.payout_date
                  ? formatCalendarDate(latestRecord.payout_date.split('T')[0])
                  : 'Pending'}
              </div>
              <p className="mt-2 text-[11px] font-sans text-brand-muted">
                {latestRecord?.payout_date ? 'Transfer verified' : 'Awaiting admin transfer'}
              </p>
            </div>

            {/* KPI 4: Method & Scope */}
            <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-brand-muted uppercase">
                <span>Method & Scope</span>
                <CreditCard className="w-4 h-4 text-brand-teal" />
              </div>
              <div className="mt-2 text-sm sm:text-base font-heading font-extrabold text-brand-navy truncate">
                {latestRecord ? formatPaymentMethod(latestRecord.payment_method) : 'Not recorded'}
              </div>
              <p className="mt-2 text-[11px] font-sans text-brand-muted truncate">
                {latestRecord?.related_student_id ? 'Assigned Dedicated Scholar' : 'Cohort Mentorship Pool'}
              </p>
            </div>
          </div>

          {/* SECTION B: Latest Payout Record Card */}
          {latestRecord && (
            <section
              aria-label="Latest Payout Record"
              className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-brand-dark/15">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase font-bold text-brand-muted tracking-wider">
                      Latest Payout Record
                    </span>
                    <span className="inline-block w-2 h-2 rounded-full bg-brand-teal" />
                  </div>
                  <h2 className="text-base sm:text-lg font-heading font-extrabold text-brand-navy">
                    {formatBillingMonth(latestRecord.billing_month)}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(latestRecord.status)}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRecordForDrawer(latestRecord)}
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
                    <span>Payout Date</span>
                  </div>
                  <div className="mt-1 font-heading font-bold text-sm sm:text-base text-brand-navy">
                    {latestRecord.payout_date
                      ? formatCalendarDate(latestRecord.payout_date.split('T')[0])
                      : 'Pending Disbursement'}
                  </div>
                </div>

                <div className="p-3 bg-brand-bg border-2 border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted uppercase">
                    <CreditCard className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Payment Method</span>
                  </div>
                  <div className="mt-1 font-heading font-bold text-sm sm:text-base text-brand-navy">
                    {formatPaymentMethod(latestRecord.payment_method)}
                  </div>
                </div>

                <div className="p-3 bg-brand-bg border-2 border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center justify-between text-xs font-mono text-brand-muted uppercase">
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-brand-teal" />
                      <span>Transaction Ref</span>
                    </div>
                    {latestRecord.transaction_reference && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(latestRecord.transaction_reference || '', 'latest-ref')}
                        className="hover:text-brand-dark"
                        title="Copy reference"
                      >
                        {copiedId === 'latest-ref' ? (
                          <CheckCheck className="w-3 h-3 text-brand-teal" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-xs sm:text-sm text-brand-navy truncate" title={latestRecord.transaction_reference || 'Not recorded'}>
                    {latestRecord.transaction_reference || 'Not recorded'}
                  </div>
                </div>

                <div className="p-3 bg-brand-bg border-2 border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted uppercase">
                    <GraduationCap className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Mentorship Scope</span>
                  </div>
                  <div className="mt-1 font-sans text-xs sm:text-sm text-brand-navy font-bold truncate">
                    {latestRecord.related_student_id ? 'Assigned Dedicated Scholar' : 'Cohort Mentorship Pool'}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION C: Historical Payouts Ledger */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-heading font-extrabold text-brand-navy uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-teal" />
                  Payout Records History ({filteredRecords.length})
                </h3>
                <p className="text-xs font-sans text-brand-muted mt-0.5">
                  Complete historical record of all your mentorship payout disbursements.
                </p>
              </div>

              {/* Search & Sort Controls */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-brand-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search payouts..."
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
              {(['all', 'paid', 'pending', 'partial'] as const).map((st) => (
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
                  No payout records match your search or filter criteria.
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
                      <th className="p-3">Billing Month</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Mentorship Scope</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Payout Date</th>
                      <th className="p-3">Transaction Reference</th>
                      <th className="p-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-dark/15">
                    {paginatedRecords.map((r) => {
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedRecordForDrawer(r)}
                          className="hover:bg-brand-paper-tint/70 transition-colors cursor-pointer"
                        >
                          <td className="p-3 font-heading font-bold text-brand-navy text-xs">
                            <div className="flex items-center gap-1.5">
                              <span>{formatBillingMonth(r.billing_month)}</span>
                              {latestRecord?.id === r.id && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-teal" title="Latest month" />
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            {getStatusBadge(r.status)}
                          </td>
                          <td className="p-3 font-medium text-brand-dark">
                            {r.related_student_id ? 'Assigned Scholar' : 'Platform Pool'}
                          </td>
                          <td className="p-3 font-medium">
                            {formatPaymentMethod(r.payment_method)}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-brand-muted">
                            {r.payout_date ? formatCalendarDate(r.payout_date.split('T')[0]) : 'Pending'}
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
      <MentorPayoutDrawer
        record={selectedRecordForDrawer}
        isOpen={Boolean(selectedRecordForDrawer)}
        onClose={() => setSelectedRecordForDrawer(null)}
        onCopyReference={copyToClipboard}
        copiedId={copiedId}
      />
    </div>
  );
};
