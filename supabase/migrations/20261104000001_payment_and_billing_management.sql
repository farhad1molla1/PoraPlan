-- ==============================================================================
-- PoraPlan Milestone 11.2.2: Payment & Billing Data Foundation (Hardened)
-- Module 11: Payment & Billing Management
--
-- STRICT ARCHITECTURAL CONSTRAINTS:
-- 1. ABSOLUTE NO-AMOUNT POLICY:
--    Zero amount, balance, fee, price, currency, revenue, or financial total columns.
-- 2. DUAL-DATE BILLING CYCLE:
--    Independent enrolled_at (historical) vs billing_start_date (anniversary anchor).
-- 3. INDEPENDENT PAYMENT FLOWS:
--    Student payment records vs. Mentor payment records are strictly segregated.
-- 4. MULTIPLE PAYMENT EVENTS:
--    Parent payment records link to child payment events to track partial/installments.
-- 5. ADMIN-ONLY PRIVATE NOTES:
--    Isolated in a dedicated table inaccessible to students and mentors.
-- 6. IMMUTABLE BILLING DATE AUDIT:
--    Append-only tracking for billing_start_date administrative adjustments.
-- 7. RESTRICTED DELETION INTEGRITY:
--    Payment and audit history protected with ON DELETE RESTRICT.
-- 8. ACTIVE CYCLE UNIQUENESS:
--    One active record per enrollment/cycle and mentor/billing month.
-- ==============================================================================

-- 1. EXTEND PROGRAM ENROLLMENTS WITH BILLING START DATE
ALTER TABLE public.program_enrollments
  ADD COLUMN IF NOT EXISTS billing_start_date DATE;

-- Populate default billing_start_date from existing enrolled_at in Bangladesh local timezone (UTC+6)
UPDATE public.program_enrollments
SET billing_start_date = (enrolled_at AT TIME ZONE 'Asia/Dhaka')::DATE
WHERE billing_start_date IS NULL;

-- Default new enrollments to current Bangladesh local date as a fallback
ALTER TABLE public.program_enrollments
  ALTER COLUMN billing_start_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Dhaka')::DATE);

-- SEC-11.2-002: Dedicated BEFORE INSERT OR UPDATE trigger to guarantee default derivation
CREATE OR REPLACE FUNCTION public.set_default_billing_start_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On INSERT: If billing_start_date was not explicitly specified, derive from enrolled_at in Asia/Dhaka
  IF TG_OP = 'INSERT' THEN
    IF NEW.billing_start_date IS NULL THEN
      NEW.billing_start_date := (NEW.enrolled_at AT TIME ZONE 'Asia/Dhaka')::DATE;
    END IF;
  -- On UPDATE: Do NOT overwrite an existing authorized billing_start_date with NULL
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.billing_start_date IS NULL AND OLD.billing_start_date IS NOT NULL THEN
      NEW.billing_start_date := OLD.billing_start_date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_default_billing_start_date ON public.program_enrollments;
CREATE TRIGGER trg_set_default_billing_start_date
  BEFORE INSERT OR UPDATE ON public.program_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_billing_start_date();

-- Composite index to enforce relational integrity between enrollment and student
CREATE UNIQUE INDEX IF NOT EXISTS idx_program_enrollments_id_student
  ON public.program_enrollments (id, student_id);

CREATE INDEX IF NOT EXISTS idx_program_enrollments_billing_start
  ON public.program_enrollments (billing_start_date);


-- 2. STUDENT PAYMENT RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.student_payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL,
  student_id UUID NOT NULL,
  cycle_start_date DATE NOT NULL,
  cycle_end_date DATE NOT NULL, -- Exclusive end date: [cycle_start_date, cycle_end_date)
  next_due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'waived')),
  payment_method TEXT CHECK (payment_method IN ('bkash', 'nagad', 'upay', 'cash', 'bank')),
  transaction_reference TEXT,
  payment_date TIMESTAMPTZ,
  waived_reason TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- SEC-11.2-004: Enforce relational consistency with ON DELETE RESTRICT
  -- Prevents accidental cascade-deletion of historical student financial records
  CONSTRAINT fk_student_payment_enrollment_student
    FOREIGN KEY (enrollment_id, student_id)
    REFERENCES public.program_enrollments(id, student_id)
    ON DELETE RESTRICT
);

-- SEC-11.2-001: Enforce single active cycle record per enrollment
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_payment_active_cycle
  ON public.student_payment_records (enrollment_id, cycle_start_date)
  WHERE (is_deleted = false);

CREATE INDEX IF NOT EXISTS idx_student_payment_records_student
  ON public.student_payment_records (student_id);

CREATE INDEX IF NOT EXISTS idx_student_payment_records_enrollment
  ON public.student_payment_records (enrollment_id);

CREATE INDEX IF NOT EXISTS idx_student_payment_records_status
  ON public.student_payment_records (status);

CREATE INDEX IF NOT EXISTS idx_student_payment_records_cycle
  ON public.student_payment_records (cycle_start_date, cycle_end_date);

CREATE INDEX IF NOT EXISTS idx_student_payment_records_due
  ON public.student_payment_records (next_due_date);

CREATE INDEX IF NOT EXISTS idx_student_payment_tx_ref
  ON public.student_payment_records (transaction_reference)
  WHERE transaction_reference IS NOT NULL;


-- 3. MENTOR PAYMENT RECORDS TABLE (Independent flow)
CREATE TABLE IF NOT EXISTS public.mentor_payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SEC-11.2-004: ON DELETE RESTRICT preserves mentor payout history
  mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  related_student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  related_enrollment_id UUID REFERENCES public.program_enrollments(id) ON DELETE SET NULL,
  billing_month DATE NOT NULL, -- Normalized to 1st of target month (e.g. 2026-11-01)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  payment_method TEXT CHECK (payment_method IN ('bkash', 'nagad', 'upay', 'cash', 'bank')),
  transaction_reference TEXT,
  payout_date TIMESTAMPTZ,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- SEC-11.2-001: Enforce single active payout record per mentor and billing month
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentor_payment_active_month
  ON public.mentor_payment_records (mentor_id, billing_month)
  WHERE (is_deleted = false);

CREATE INDEX IF NOT EXISTS idx_mentor_payment_records_mentor
  ON public.mentor_payment_records (mentor_id);

CREATE INDEX IF NOT EXISTS idx_mentor_payment_records_month
  ON public.mentor_payment_records (billing_month);

CREATE INDEX IF NOT EXISTS idx_mentor_payment_records_status
  ON public.mentor_payment_records (status);

CREATE INDEX IF NOT EXISTS idx_mentor_payment_tx_ref
  ON public.mentor_payment_records (transaction_reference)
  WHERE transaction_reference IS NOT NULL;


-- 4. MULTIPLE PAYMENT EVENTS TABLE (History tracking without amounts)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type TEXT NOT NULL CHECK (record_type IN ('student', 'mentor')),
  student_payment_id UUID REFERENCES public.student_payment_records(id) ON DELETE CASCADE,
  mentor_payment_id UUID REFERENCES public.mentor_payment_records(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bkash', 'nagad', 'upay', 'cash', 'bank')),
  transaction_reference TEXT,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  note TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Ensure event belongs strictly to either student or mentor record
  CONSTRAINT chk_payment_event_target CHECK (
    (record_type = 'student' AND student_payment_id IS NOT NULL AND mentor_payment_id IS NULL) OR
    (record_type = 'mentor' AND mentor_payment_id IS NOT NULL AND student_payment_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_payment_events_student_record
  ON public.payment_events (student_payment_id)
  WHERE student_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_events_mentor_record
  ON public.payment_events (mentor_payment_id)
  WHERE mentor_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_events_tx_ref
  ON public.payment_events (transaction_reference)
  WHERE transaction_reference IS NOT NULL;


-- 5. ADMIN-ONLY PRIVATE NOTES TABLE
CREATE TABLE IF NOT EXISTS public.payment_admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type TEXT NOT NULL CHECK (record_type IN ('student_payment', 'mentor_payment', 'enrollment')),
  record_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payment_admin_notes_record
  ON public.payment_admin_notes (record_type, record_id);


-- 6. IMMUTABLE BILLING DATE AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.billing_date_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SEC-11.2-004: ON DELETE RESTRICT guarantees audit history cannot be purged
  enrollment_id UUID NOT NULL REFERENCES public.program_enrollments(id) ON DELETE RESTRICT,
  old_billing_start_date DATE NOT NULL,
  new_billing_start_date DATE NOT NULL,
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_billing_date_audit_enrollment
  ON public.billing_date_audit_logs (enrollment_id);


-- 7. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS across all new tables
ALTER TABLE public.student_payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_date_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper condition check for active admin
-- Active admin has role = 'admin' and status = 'active'

-- 7.A Student Payment Records Policies
DROP POLICY IF EXISTS "Students can view own payment records" ON public.student_payment_records;
CREATE POLICY "Students can view own payment records"
  ON public.student_payment_records
  FOR SELECT
  TO authenticated
  USING (
    -- SEC-11.2-003: Student can only view their own NON-DELETED records
    (student_id = auth.uid() AND is_deleted = false) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Only admins can modify student payment records" ON public.student_payment_records;
CREATE POLICY "Only admins can modify student payment records"
  ON public.student_payment_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- 7.B Mentor Payment Records Policies
DROP POLICY IF EXISTS "Mentors can view own payout records" ON public.mentor_payment_records;
CREATE POLICY "Mentors can view own payout records"
  ON public.mentor_payment_records
  FOR SELECT
  TO authenticated
  USING (
    -- SEC-11.2-003: Mentor can only view their own NON-DELETED records
    (mentor_id = auth.uid() AND is_deleted = false) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Only admins can modify mentor payment records" ON public.mentor_payment_records;
CREATE POLICY "Only admins can modify mentor payment records"
  ON public.mentor_payment_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- 7.C Payment Events Policies
DROP POLICY IF EXISTS "Users can view permitted payment events" ON public.payment_events;
CREATE POLICY "Users can view permitted payment events"
  ON public.payment_events
  FOR SELECT
  TO authenticated
  USING (
    -- Admin has access to all events
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    ) OR
    -- SEC-11.2-003: Student can view events under their own non-deleted student payment record
    (record_type = 'student' AND student_payment_id IN (
      SELECT id FROM public.student_payment_records
      WHERE student_id = auth.uid() AND is_deleted = false
    )) OR
    -- SEC-11.2-003: Mentor can view events under their own non-deleted mentor payment record
    (record_type = 'mentor' AND mentor_payment_id IN (
      SELECT id FROM public.mentor_payment_records
      WHERE mentor_id = auth.uid() AND is_deleted = false
    ))
  );

DROP POLICY IF EXISTS "Only admins can insert or update payment events" ON public.payment_events;
CREATE POLICY "Only admins can insert or update payment events"
  ON public.payment_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- 7.D Payment Admin Notes Policies (Strict Admin Isolation)
DROP POLICY IF EXISTS "Admins only access payment admin notes" ON public.payment_admin_notes;
CREATE POLICY "Admins only access payment admin notes"
  ON public.payment_admin_notes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- 7.E Billing Date Audit Logs Policies (Append-only for Admins)
DROP POLICY IF EXISTS "Admins can view billing date audit logs" ON public.billing_date_audit_logs;
CREATE POLICY "Admins can view billing date audit logs"
  ON public.billing_date_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can insert billing date audit logs" ON public.billing_date_audit_logs;
CREATE POLICY "Admins can insert billing date audit logs"
  ON public.billing_date_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Revoke all permissions from anon and PUBLIC across new payment tables
REVOKE ALL ON public.student_payment_records FROM PUBLIC, anon;
REVOKE ALL ON public.mentor_payment_records FROM PUBLIC, anon;
REVOKE ALL ON public.payment_events FROM PUBLIC, anon;
REVOKE ALL ON public.payment_admin_notes FROM PUBLIC, anon;
REVOKE ALL ON public.billing_date_audit_logs FROM PUBLIC, anon;

-- Grant standard DML to authenticated role (governed by RLS policies above)
GRANT SELECT, INSERT, UPDATE ON public.student_payment_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mentor_payment_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_admin_notes TO authenticated;
GRANT SELECT, INSERT ON public.billing_date_audit_logs TO authenticated;
