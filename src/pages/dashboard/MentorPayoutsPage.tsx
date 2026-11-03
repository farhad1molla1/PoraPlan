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
  User,
  GraduationCap,
} from 'lucide-react';

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

export const MentorPayoutsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const mentorId = profile?.id || user?.id || '';

  const [records, setRecords] = useState<MentorPaymentRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedMeta, setSelectedMeta] = useState<MentorPaymentRecordWithMeta | null>(null);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | MentorPaymentStatus>('all');

  const fetchRecords = useCallback(async () => {
    if (!mentorId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await getMyMentorPaymentRecords();
      if (res.error) throw res.error;
      setRecords(res.records);
      if (res.records.length > 0 && !selectedRecordId) {
        setSelectedRecordId(res.records[0].id);
      }
    } catch {
      setError("Couldn't load your payout information. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [mentorId, selectedRecordId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Load selected record metadata and payment events
  useEffect(() => {
    if (!selectedRecordId) {
      setSelectedMeta(null);
      setEvents([]);
      return;
    }

    let isMounted = true;
    setDetailsLoading(true);

    Promise.all([
      getMyMentorPaymentRecordById(selectedRecordId, { withMeta: true }),
      getPaymentEvents('mentor', selectedRecordId),
    ])
      .then(([metaRes, eventsRes]) => {
        if (!isMounted) return;
        if (metaRes.error) {
          setSelectedMeta(null);
        } else {
          setSelectedMeta(metaRes.record as MentorPaymentRecordWithMeta);
        }

        if (eventsRes.error) {
          setEvents([]);
        } else {
          setEvents(eventsRes.events);
        }
        setDetailsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setSelectedMeta(null);
        setEvents([]);
        setDetailsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRecordId]);

  const filteredRecords = useMemo(() => {
    if (statusFilter === 'all') return records;
    return records.filter((r) => r.status === statusFilter);
  }, [records, statusFilter]);

  // Latest payout record (first record, as records are sorted by billing_month descending)
  const latestRecord = records.length > 0 ? records[0] : null;
  const activeInspectionRecord = selectedMeta || latestRecord;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="bg-brand-navy text-brand-paper p-5 sm:p-6 border-2 border-brand-dark shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-brand-gold text-brand-dark border-2 border-brand-dark shadow-brutal-xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-heading font-extrabold tracking-tight text-brand-paper">
              Payout History
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-sans text-brand-paper/80">
            View your payout status and payment history.
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

      {/* Mentorship Access Guarantee Banner */}
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
          <div className="h-44 bg-brand-paper/60 border-2 border-brand-dark shadow-brutal-sm p-6" />
          <div className="h-64 bg-brand-paper/60 border-2 border-brand-dark shadow-brutal-sm p-6" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && records.length === 0 && (
        <div className="p-10 text-center bg-brand-paper border-2 border-brand-dark shadow-brutal-sm space-y-3">
          <div className="w-12 h-12 mx-auto bg-brand-paper-tint border-2 border-brand-dark shadow-brutal-xs flex items-center justify-center text-brand-muted">
            <CreditCard className="w-6 h-6" />
          </div>
          <h2 className="text-base sm:text-lg font-heading font-extrabold text-brand-navy">
            No payout records yet
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
          {/* Latest / Current Payout Overview Card */}
          {latestRecord && (
            <section
              aria-label="Latest Payout Overview"
              className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-brand-dark/15">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-mono uppercase font-bold text-brand-muted tracking-wider">
                    Latest Payout Period
                  </span>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-heading font-extrabold text-brand-navy">
                      {formatBillingMonth(latestRecord.billing_month)}
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-brand-muted hidden sm:inline">Status:</span>
                  {getStatusBadge(latestRecord.status)}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                <div className="p-3 bg-brand-bg border border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted uppercase">
                    <Calendar className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Payout Date</span>
                  </div>
                  <div className="mt-1 font-heading font-bold text-sm sm:text-base text-brand-navy">
                    {latestRecord.payout_date
                      ? formatCalendarDate(latestRecord.payout_date.split('T')[0])
                      : 'Pending'}
                  </div>
                </div>

                <div className="p-3 bg-brand-bg border border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted uppercase">
                    <CreditCard className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Payment Method</span>
                  </div>
                  <div className="mt-1 font-heading font-bold text-sm sm:text-base text-brand-navy">
                    {formatPaymentMethod(latestRecord.payment_method)}
                  </div>
                </div>

                <div className="p-3 bg-brand-bg border border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted uppercase">
                    <Hash className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Transaction Ref</span>
                  </div>
                  <div
                    className="mt-1 font-mono text-xs sm:text-sm text-brand-navy truncate"
                    title={latestRecord.transaction_reference || 'Not applicable'}
                  >
                    {latestRecord.transaction_reference || 'Not applicable'}
                  </div>
                </div>

                <div className="p-3 bg-brand-bg border border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted uppercase">
                    <GraduationCap className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Mentorship Scope</span>
                  </div>
                  <div className="mt-1 font-sans text-xs sm:text-sm text-brand-navy truncate">
                    {latestRecord.related_student_id ? 'Assigned Scholar' : 'Cohort Mentorship'}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Records & Event Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Payout History List (7 cols on lg) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm sm:text-base font-heading font-extrabold text-brand-navy uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-teal" />
                  Payout Records History ({filteredRecords.length})
                </h3>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1 border-2 border-brand-dark bg-brand-paper p-0.5 shadow-brutal-xs">
                  {(['all', 'paid', 'pending', 'partial'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-2 py-0.5 font-heading text-[11px] font-bold uppercase transition-colors ${
                        statusFilter === st
                          ? 'bg-brand-navy text-brand-paper border border-brand-dark'
                          : 'text-brand-dark hover:bg-brand-bg'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="p-6 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs text-center text-xs font-sans text-brand-muted">
                  No payout records match the selected filter.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRecords.map((r) => {
                    const isSelected = (activeInspectionRecord?.id || latestRecord?.id) === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRecordId(r.id)}
                        className={`p-4 border-2 border-brand-dark cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-brand-paper-tint shadow-brutal translate-x-0.5'
                            : 'bg-brand-paper shadow-brutal-xs hover:bg-brand-paper-tint hover:shadow-brutal-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="text-xs sm:text-sm font-heading font-bold text-brand-navy flex items-center gap-1.5">
                              <span>{formatBillingMonth(r.billing_month)}</span>
                              {isSelected && (
                                <span className="inline-block w-2 h-2 rounded-full bg-brand-teal" />
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-brand-muted">
                              <span>Method: {formatPaymentMethod(r.payment_method)}</span>
                              {r.payout_date ? (
                                <span>Paid: {formatCalendarDate(r.payout_date.split('T')[0])}</span>
                              ) : (
                                <span>Status: Pending</span>
                              )}
                              {r.transaction_reference && (
                                <span>Ref: {r.transaction_reference}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {getStatusBadge(r.status)}
                            <ChevronRight
                              className={`w-4 h-4 text-brand-muted transition-transform ${
                                isSelected ? 'translate-x-1' : ''
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Record Detail & Activity Timeline (5 cols on lg) */}
            <div className="lg:col-span-5 space-y-4">
              <h3 className="text-sm sm:text-base font-heading font-extrabold text-brand-navy uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-teal" />
                Payout Inspection & Activity
              </h3>

              {activeInspectionRecord ? (
                <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 space-y-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono uppercase font-bold text-brand-muted">
                        Billing Month
                      </span>
                      {getStatusBadge(activeInspectionRecord.status)}
                    </div>
                    <div className="mt-1 font-heading font-extrabold text-sm sm:text-base text-brand-navy">
                      {formatBillingMonth(activeInspectionRecord.billing_month)}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-b border-brand-dark/15 py-3 text-xs font-sans">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-brand-muted font-mono uppercase text-[11px]">Payout Date</span>
                      <span className="font-heading font-bold text-brand-dark">
                        {activeInspectionRecord.payout_date
                          ? formatCalendarDate(activeInspectionRecord.payout_date.split('T')[0])
                          : 'Pending'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <span className="text-brand-muted font-mono uppercase text-[11px]">Payment Method</span>
                      <span className="font-heading font-bold text-brand-dark">
                        {formatPaymentMethod(activeInspectionRecord.payment_method)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <span className="text-brand-muted font-mono uppercase text-[11px]">Transaction Reference</span>
                      <span className="font-mono text-brand-navy font-bold">
                        {activeInspectionRecord.transaction_reference || 'Not applicable'}
                      </span>
                    </div>

                    {/* Related Scholar Context if available */}
                    {selectedMeta?.related_student && (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-brand-muted font-mono uppercase text-[11px]">Related Scholar</span>
                        <span className="font-sans font-bold text-brand-dark flex items-center gap-1">
                          <User className="w-3 h-3 text-brand-teal" />
                          {selectedMeta.related_student.full_name || 'Scholar'}
                          {selectedMeta.related_student.poraplan_id
                            ? ` (${selectedMeta.related_student.poraplan_id})`
                            : ''}
                        </span>
                      </div>
                    )}

                    {activeInspectionRecord.created_at && (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-brand-muted font-mono uppercase text-[11px]">Recorded On</span>
                        <span className="font-mono text-brand-muted text-[11px]">
                          {formatLocalDate(new Date(activeInspectionRecord.created_at))}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Payment Activity Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase font-bold text-brand-muted tracking-wider flex items-center justify-between">
                      <span>Payout Activity Events</span>
                      {detailsLoading && <RefreshCw className="w-3 h-3 animate-spin text-brand-teal" />}
                    </h4>

                    {detailsLoading ? (
                      <div className="p-4 bg-brand-bg border border-brand-dark/20 text-center text-xs text-brand-muted animate-pulse">
                        Loading payout activity...
                      </div>
                    ) : events.length === 0 ? (
                      <div className="p-4 bg-brand-bg border border-brand-dark/20 text-xs font-sans text-brand-muted text-center">
                        No payout activity recorded yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {events.map((evt) => (
                          <div
                            key={evt.id}
                            className="p-3 bg-brand-bg border border-brand-dark/25 shadow-brutal-xs space-y-1.5"
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
                              <span className="text-brand-muted">Ref:</span>
                              <span className="font-bold">
                                {evt.transaction_reference || 'Not applicable'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs text-center text-xs font-sans text-brand-muted">
                  Select a payout record to inspect its period and activity.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
