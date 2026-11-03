import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getMyStudentPaymentRecords,
  getAdminStudentPaymentRecords,
  getPaymentEvents,
} from '../../lib/payments';
import { formatCalendarDate } from '../../lib/billingCycles';
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
  Info,
} from 'lucide-react';

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

export const StudentBillingPage: React.FC = () => {
  const { user, profile, role } = useAuth();
  const [searchParams] = useSearchParams();
  const paramStudentId = searchParams.get('studentId');
  const isAdmin = role === 'admin';
  const targetStudentId = isAdmin && paramStudentId ? paramStudentId : (profile?.id || user?.id || '');

  const [records, setRecords] = useState<StudentPaymentRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | StudentPaymentStatus>('all');

  const fetchRecords = useCallback(async () => {
    if (!targetStudentId) return;
    setLoading(true);
    setError(null);

    try {
      if (isAdmin && paramStudentId) {
        const res = await getAdminStudentPaymentRecords({ studentId: paramStudentId });
        if (res.error) throw res.error;
        setRecords(res.records);
        if (res.records.length > 0 && !selectedRecordId) {
          setSelectedRecordId(res.records[0].id);
        }
      } else {
        const res = await getMyStudentPaymentRecords();
        if (res.error) throw res.error;
        setRecords(res.records);
        if (res.records.length > 0 && !selectedRecordId) {
          setSelectedRecordId(res.records[0].id);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load payment and billing records.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, paramStudentId, targetStudentId, selectedRecordId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Load child payment events whenever selectedRecordId changes
  useEffect(() => {
    if (!selectedRecordId) {
      setEvents([]);
      return;
    }

    let isMounted = true;
    setEventsLoading(true);

    getPaymentEvents('student', selectedRecordId)
      .then((res) => {
        if (!isMounted) return;
        if (res.error) {
          // Non-fatal for the main view; show empty event list
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
  }, [selectedRecordId]);

  const filteredRecords = useMemo(() => {
    if (statusFilter === 'all') return records;
    return records.filter((r) => r.status === statusFilter);
  }, [records, statusFilter]);

  // Active or latest billing cycle record (first record, as records are sorted by cycle_start_date descending)
  const activeRecord = records.length > 0 ? records[0] : null;
  const selectedRecord = records.find((r) => r.id === selectedRecordId) || activeRecord;

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
              Billing & Payments
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-sans text-brand-paper/80">
            Monitor your enrollment billing cycles, payment records, and renewal status.
          </p>
          {isAdmin && paramStudentId && (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 bg-brand-paper/10 border border-brand-paper/30 text-xs font-mono text-brand-gold">
              <Info className="w-3.5 h-3.5" />
              Viewing student record ID: {paramStudentId}
            </div>
          )}
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
      <div className="p-4 bg-brand-paper border-2 border-brand-dark shadow-brutal-sm flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-brand-teal shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm font-sans text-brand-dark leading-relaxed">
          <strong className="font-heading font-bold text-brand-navy">Academic Access Guarantee: </strong>
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
          {/* Current / Active Billing Cycle Card */}
          {activeRecord && (
            <section
              aria-label="Current Billing Cycle"
              className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-brand-dark/15">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-mono uppercase font-bold text-brand-muted tracking-wider">
                    Current Billing Cycle
                  </span>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-heading font-extrabold text-brand-navy">
                      {formatCalendarDate(activeRecord.cycle_start_date)} – {formatCalendarDate(activeRecord.cycle_end_date)}
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-brand-muted hidden sm:inline">Status:</span>
                  {getStatusBadge(activeRecord.status)}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                <div className="p-3 bg-brand-bg border border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted uppercase">
                    <Calendar className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Next Due Date</span>
                  </div>
                  <div className="mt-1 font-heading font-bold text-sm sm:text-base text-brand-navy">
                    {formatCalendarDate(activeRecord.next_due_date)}
                  </div>
                </div>

                <div className="p-3 bg-brand-bg border border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Payment Date</span>
                  </div>
                  <div className="mt-1 font-heading font-bold text-sm sm:text-base text-brand-navy">
                    {activeRecord.payment_date ? formatCalendarDate(activeRecord.payment_date) : 'Pending'}
                  </div>
                </div>

                <div className="p-3 bg-brand-bg border border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted uppercase">
                    <CreditCard className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Payment Method</span>
                  </div>
                  <div className="mt-1 font-heading font-bold text-sm sm:text-base text-brand-navy">
                    {formatPaymentMethod(activeRecord.payment_method)}
                  </div>
                </div>

                <div className="p-3 bg-brand-bg border border-brand-dark/20 shadow-brutal-xs">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-brand-muted uppercase">
                    <Hash className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Transaction Ref</span>
                  </div>
                  <div className="mt-1 font-mono text-xs sm:text-sm text-brand-navy truncate" title={activeRecord.transaction_reference || 'Not applicable'}>
                    {activeRecord.transaction_reference || 'Not applicable'}
                  </div>
                </div>
              </div>

              {activeRecord.status === 'waived' && activeRecord.waived_reason && (
                <div className="mt-4 p-3 bg-brand-paper-tint border border-brand-dark/30 text-xs font-sans text-brand-dark flex items-start gap-2">
                  <Info className="w-4 h-4 text-brand-muted shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Waiver Note: </strong>
                    {activeRecord.waived_reason}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Records & Event Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Payment History List (7 cols on lg) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm sm:text-base font-heading font-extrabold text-brand-navy uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-teal" />
                  Payment Records History ({filteredRecords.length})
                </h3>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1 border-2 border-brand-dark bg-brand-paper p-0.5 shadow-brutal-xs">
                  {(['all', 'paid', 'pending', 'partial', 'overdue', 'waived'] as const).map((st) => (
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
                  No payment records match the selected filter.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRecords.map((r) => {
                    const isSelected = selectedRecord?.id === r.id;
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
                              <span>
                                {formatCalendarDate(r.cycle_start_date)} – {formatCalendarDate(r.cycle_end_date)}
                              </span>
                              {isSelected && (
                                <span className="inline-block w-2 h-2 rounded-full bg-brand-teal" />
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-brand-muted">
                              <span>Due: {formatCalendarDate(r.next_due_date)}</span>
                              <span>Method: {formatPaymentMethod(r.payment_method)}</span>
                              {r.payment_date && <span>Paid: {formatCalendarDate(r.payment_date)}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {getStatusBadge(r.status)}
                            <ChevronRight className={`w-4 h-4 text-brand-muted transition-transform ${isSelected ? 'translate-x-1' : ''}`} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Record Detail & Child Events (5 cols on lg) */}
            <div className="lg:col-span-5 space-y-4">
              <h3 className="text-sm sm:text-base font-heading font-extrabold text-brand-navy uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-teal" />
                Cycle Inspection & Events
              </h3>

              {selectedRecord ? (
                <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal p-5 space-y-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono uppercase font-bold text-brand-muted">
                        Cycle Period
                      </span>
                      {getStatusBadge(selectedRecord.status)}
                    </div>
                    <div className="mt-1 font-heading font-extrabold text-sm sm:text-base text-brand-navy">
                      {formatCalendarDate(selectedRecord.cycle_start_date)} – {formatCalendarDate(selectedRecord.cycle_end_date)}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-b border-brand-dark/15 py-3 text-xs font-sans">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-brand-muted font-mono uppercase text-[11px]">Renewal Due Date</span>
                      <span className="font-heading font-bold text-brand-dark">{formatCalendarDate(selectedRecord.next_due_date)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-brand-muted font-mono uppercase text-[11px]">Payment Date</span>
                      <span className="font-heading font-bold text-brand-dark">
                        {selectedRecord.payment_date ? formatCalendarDate(selectedRecord.payment_date) : 'Pending'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-brand-muted font-mono uppercase text-[11px]">Payment Method</span>
                      <span className="font-heading font-bold text-brand-dark">{formatPaymentMethod(selectedRecord.payment_method)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-brand-muted font-mono uppercase text-[11px]">Transaction Reference</span>
                      <span className="font-mono text-brand-navy font-bold">
                        {selectedRecord.transaction_reference || 'Not applicable'}
                      </span>
                    </div>
                    {selectedRecord.created_at && (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-brand-muted font-mono uppercase text-[11px]">Recorded On</span>
                        <span className="font-mono text-brand-muted text-[11px]">
                          {formatLocalDate(new Date(selectedRecord.created_at))}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Child Payment Events Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase font-bold text-brand-muted tracking-wider flex items-center justify-between">
                      <span>Payment Events & Installments</span>
                      {eventsLoading && <RefreshCw className="w-3 h-3 animate-spin text-brand-teal" />}
                    </h4>

                    {eventsLoading ? (
                      <div className="p-4 bg-brand-bg border border-brand-dark/20 text-center text-xs text-brand-muted animate-pulse">
                        Loading payment events...
                      </div>
                    ) : events.length === 0 ? (
                      <div className="p-4 bg-brand-bg border border-brand-dark/20 text-xs font-sans text-brand-muted text-center">
                        No installment events recorded for this billing cycle.
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
                                {formatCalendarDate(evt.payment_date)}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-brand-dark flex items-center justify-between">
                              <span className="text-brand-muted">Ref:</span>
                              <span className="font-bold">{evt.transaction_reference || 'Not applicable'}</span>
                            </div>
                            {evt.note && (
                              <div className="text-[11px] font-sans text-brand-muted border-t border-brand-dark/10 pt-1 mt-1">
                                {evt.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs text-center text-xs font-sans text-brand-muted">
                  Select a payment record to inspect its billing cycle and child events.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
