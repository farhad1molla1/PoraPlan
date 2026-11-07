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
  X,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';

// ==============================================================================
// HELPERS
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

// ==============================================================================
// RECORD DETAILS DRAWER
// ==============================================================================

interface MentorPayoutDrawerProps {
  record: MentorPaymentRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

const MentorPayoutDrawer: React.FC<MentorPayoutDrawerProps> = ({
  record,
  isOpen,
  onClose,
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
      <div
        className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-lg w-full bg-brand-paper border-l-2 border-brand-dark shadow-2xl z-50 overflow-y-auto flex flex-col justify-between">
        {/* Header */}
        <div className="p-4 border-b-2 border-brand-dark bg-brand-paper flex items-center justify-between gap-3 sticky top-0 z-10">
          <div>
            <span className="text-[10px] font-mono uppercase text-brand-muted font-bold block">
              Payout Record
            </span>
            <div className="font-heading font-extrabold text-brand-navy text-sm sm:text-base">
              {formatBillingMonth(displayRecord.billing_month)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(displayRecord.status)}
            <button
              type="button"
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] p-2 flex items-center justify-center text-brand-dark hover:text-brand-navy border border-brand-dark bg-brand-paper hover:bg-brand-paper-tint shadow-brutal-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              aria-label="Close payout details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 flex-1 text-xs">
          {/* Month & Scope */}
          <div className="p-3 bg-brand-bg border border-brand-dark/20 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-brand-muted font-mono uppercase text-[11px]">Billing Month</span>
              <span className="font-heading font-bold text-brand-dark">
                {formatBillingMonth(displayRecord.billing_month)}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-brand-dark/10 pt-2">
              <span className="text-brand-muted font-mono uppercase text-[11px]">Mentorship Scope</span>
              <span className="font-medium text-brand-dark">
                {displayRecord.related_student_id ? 'Assigned Scholar' : 'Platform Mentorship Pool'}
              </span>
            </div>
            {metaRecord?.related_student && (
              <div className="flex justify-between items-center border-t border-brand-dark/10 pt-2">
                <span className="text-brand-muted font-mono uppercase text-[11px]">Scholar</span>
                <span className="font-heading font-bold text-brand-navy flex items-center gap-1">
                  <User className="w-3 h-3 text-brand-teal" />
                  {metaRecord.related_student.full_name || 'Scholar'}
                </span>
              </div>
            )}
          </div>

          {/* Disbursement Details */}
          <div className="p-3 bg-brand-bg border border-brand-dark/20 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-brand-muted font-mono uppercase text-[11px]">Payout Method</span>
              <span className="font-heading font-bold text-brand-dark">
                {formatPaymentMethod(displayRecord.payment_method)}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-brand-dark/10 pt-2">
              <span className="text-brand-muted font-mono uppercase text-[11px]">Payout Date</span>
              <span className="font-heading font-bold text-brand-dark">
                {displayRecord.payout_date ? formatCalendarDate(displayRecord.payout_date.split('T')[0]) : 'Pending'}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-brand-dark/10 pt-2">
              <span className="text-brand-muted font-mono uppercase text-[11px]">Transaction Reference</span>
              <span className="font-mono text-brand-navy font-bold">
                {displayRecord.transaction_reference || 'Not recorded'}
              </span>
            </div>
            {displayRecord.created_at && (
              <div className="flex justify-between items-center border-t border-brand-dark/10 pt-2 text-brand-muted text-[11px]">
                <span>Recorded On</span>
                <span className="font-mono">{formatLocalDate(new Date(displayRecord.created_at))}</span>
              </div>
            )}
          </div>

          {/* Payout Activity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold text-brand-muted">
                Activity ({events.length})
              </span>
              {loading && <RefreshCw className="w-3 h-3 animate-spin text-brand-teal" />}
            </div>

            {loading ? (
              <div className="p-3 bg-brand-bg border border-brand-dark/20 text-center text-brand-muted">
                Loading activity...
              </div>
            ) : events.length === 0 ? (
              <div className="p-3 bg-brand-bg border border-brand-dark/20 text-brand-muted text-center">
                No events recorded for this payout.
              </div>
            ) : (
              <div className="space-y-1.5">
                {events.map((evt) => (
                  <div key={evt.id} className="p-2.5 bg-brand-bg border border-brand-dark/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-bold text-brand-navy">
                        {formatPaymentMethod(evt.payment_method)}
                      </span>
                      <span className="font-mono text-[11px] text-brand-muted">
                        {formatCalendarDate(evt.payment_date.split('T')[0])}
                      </span>
                    </div>
                    {evt.transaction_reference && (
                      <div className="text-[11px] font-mono text-brand-muted flex items-center justify-between">
                        <span>Ref:</span>
                        <span className="text-brand-dark font-bold">{evt.transaction_reference}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t-2 border-brand-dark bg-brand-paper flex justify-end sticky bottom-0 z-10">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
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
  const [selectedRecord, setSelectedRecord] = useState<MentorPaymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | MentorPaymentStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const fetchRecords = useCallback(async () => {
    if (!mentorId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await getMyMentorPaymentRecords();
      if (res.error) throw res.error;
      setRecords(res.records);
    } catch {
      setError("Couldn't load your payout records. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [mentorId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Latest payout record
  const latestRecord = useMemo(() => {
    if (records.length === 0) return null;
    return records[0];
  }, [records]);

  // Filtered list
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchMonth = formatBillingMonth(r.billing_month).toLowerCase().includes(q) || r.billing_month.includes(q);
        const matchMethod = formatPaymentMethod(r.payment_method).toLowerCase().includes(q);
        const matchRef = (r.transaction_reference || '').toLowerCase().includes(q);
        if (!matchMonth && !matchMethod && !matchRef) return false;
      }
      return true;
    });
  }, [records, statusFilter, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-brand-dark">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-brand-navy">
            My Payouts
          </h1>
          <p className="text-xs font-sans text-brand-muted mt-0.5">
            View your payout status and disbursement history.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchRecords}
          disabled={loading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-300 text-red-900 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRecords} className="text-xs px-2 py-0.5">
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && records.length === 0 && (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 bg-brand-paper border border-brand-dark/20" />
          <div className="h-48 bg-brand-paper border border-brand-dark/20" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && records.length === 0 && (
        <div className="p-8 text-center bg-brand-paper border border-brand-dark/20 space-y-2">
          <CreditCard className="w-8 h-8 text-brand-muted mx-auto" />
          <div className="font-heading font-bold text-brand-navy text-sm">No Payout Records Yet</div>
          <p className="text-xs text-brand-muted max-w-sm mx-auto">
            Your payout records will appear here once recorded by administration.
          </p>
        </div>
      )}

      {/* Main Content */}
      {records.length > 0 && (
        <div className="space-y-5">
          {/* Latest Payout Summary */}
          {latestRecord && (
            <div className="p-3.5 sm:p-5 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-brand-dark/10">
                <span className="text-[11px] font-mono uppercase font-bold text-brand-muted">
                  Latest Payout
                </span>
                {getStatusBadge(latestRecord.status)}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-mono uppercase text-brand-muted block">Billing Month</span>
                  <span className="font-heading font-bold text-brand-dark">
                    {formatBillingMonth(latestRecord.billing_month)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-brand-muted block">Payout Date</span>
                  <span className="font-heading font-bold text-brand-navy">
                    {latestRecord.payout_date ? formatCalendarDate(latestRecord.payout_date.split('T')[0]) : 'Pending'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-brand-muted block">Payout Method</span>
                  <span className="font-heading font-bold text-brand-dark">
                    {formatPaymentMethod(latestRecord.payment_method)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-brand-muted block">Mentorship Scope</span>
                  <span className="font-heading font-bold text-brand-dark">
                    {latestRecord.related_student_id ? 'Assigned Scholar' : 'Platform Pool'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payout History Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-heading font-bold text-brand-navy text-sm">
                Payout History
              </div>

              {/* Search & Filter */}
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
                    className="pl-8 pr-2 py-2 sm:py-1 text-base sm:text-xs min-h-[44px] sm:min-h-0 border border-brand-dark/30 bg-brand-paper focus:outline-none w-full sm:w-44"
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
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1">
              {(['all', 'paid', 'pending', 'partial'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-0.5 text-xs font-heading font-bold uppercase transition-colors ${
                    statusFilter === st
                      ? 'bg-brand-navy text-brand-paper'
                      : 'bg-brand-paper text-brand-dark border border-brand-dark/20 hover:bg-brand-paper-tint'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Table & Responsive Cards */}
            {filteredRecords.length === 0 ? (
              <div className="p-6 bg-brand-paper border border-brand-dark/20 text-center text-xs text-brand-muted">
                No payout records found.
              </div>
            ) : (
              <>
                {/* Mobile Responsive Cards (< md: 768px) */}
                <div className="md:hidden space-y-3">
                  {paginatedRecords.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRecord(r)}
                      className="p-3.5 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs space-y-2.5 cursor-pointer"
                    >
                      {/* Card Header: Billing Month + Payout Status Badge */}
                      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-brand-dark/15">
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono uppercase text-brand-muted font-bold block">
                            Billing Month
                          </span>
                          <span className="font-heading font-extrabold text-sm text-brand-navy leading-snug">
                            {formatBillingMonth(r.billing_month)}
                          </span>
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(r.status)}
                        </div>
                      </div>

                      {/* Card Details Grid */}
                      <div className="grid grid-cols-2 gap-2.5 text-xs bg-brand-bg p-2.5 border border-brand-dark/20">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-brand-muted block">
                            Scope
                          </span>
                          <span className="font-sans font-bold text-brand-dark text-[11px] block mt-0.5 truncate">
                            {r.related_student_id ? 'Assigned Scholar' : 'Platform Pool'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-brand-muted block">
                            Method
                          </span>
                          <span className="font-sans font-bold text-brand-dark text-[11px] block mt-0.5 truncate">
                            {formatPaymentMethod(r.payment_method)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-brand-muted block">
                            Payout Date
                          </span>
                          <span className="font-mono text-[11px] text-brand-dark block mt-0.5">
                            {r.payout_date ? formatCalendarDate(r.payout_date.split('T')[0]) : 'Pending'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono uppercase text-brand-muted block">
                            Reference
                          </span>
                          <span
                            className="font-mono text-[11px] text-brand-dark font-medium block mt-0.5 truncate"
                            title={r.transaction_reference || ''}
                          >
                            {r.transaction_reference || '—'}
                          </span>
                        </div>
                      </div>

                      {/* Card Action Button */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full min-h-[44px] flex items-center justify-center gap-1.5 text-xs font-bold"
                          onClick={() => setSelectedRecord(r)}
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View Statement & Activity
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (>= md: 768px) */}
                <div className="hidden md:block border border-brand-dark/30 bg-brand-paper overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-brand-bg border-b border-brand-dark/20 font-heading uppercase text-[11px] text-brand-muted">
                      <tr>
                        <th className="p-2.5">Billing Month</th>
                        <th className="p-2.5">Payout Status</th>
                        <th className="p-2.5">Scope</th>
                        <th className="p-2.5">Method</th>
                        <th className="p-2.5">Payout Date</th>
                        <th className="p-2.5">Reference</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-dark/10">
                      {paginatedRecords.map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedRecord(r)}
                          className="hover:bg-brand-paper-tint/60 transition-colors cursor-pointer"
                        >
                          <td className="p-2.5 font-heading font-bold text-brand-navy">
                            {formatBillingMonth(r.billing_month)}
                          </td>
                          <td className="p-2.5">
                            {getStatusBadge(r.status)}
                          </td>
                          <td className="p-2.5 font-medium text-brand-dark">
                            {r.related_student_id ? 'Assigned Scholar' : 'Platform Pool'}
                          </td>
                          <td className="p-2.5">
                            {formatPaymentMethod(r.payment_method)}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-brand-muted">
                            {r.payout_date ? formatCalendarDate(r.payout_date.split('T')[0]) : 'Pending'}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-brand-dark max-w-[130px] truncate" title={r.transaction_reference || ''}>
                            {r.transaction_reference || '—'}
                          </td>
                          <td className="p-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2 py-0.5 text-[11px]"
                              onClick={() => setSelectedRecord(r)}
                              leftIcon={<Eye className="w-3 h-3" />}
                            >
                              Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs font-mono pt-1 text-brand-muted">
                <span>Page {currentPage} of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2 py-0.5 text-[11px]"
                    leftIcon={<ChevronLeft className="w-3 h-3" />}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2 py-0.5 text-[11px]"
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

      {/* Details Drawer */}
      <MentorPayoutDrawer
        record={selectedRecord}
        isOpen={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
};
