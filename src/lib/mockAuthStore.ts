import type {
  Profile,
  UserRole,
  AccountStatus,
  ProfileUpdate,
  Subject,
  StudyPlan,
  StudyPlanItem,
  StudyPlanItemStatus,
} from '../types/database';
import { sha256 } from './crypto';

export interface MockAccountRecord {
  id: string;
  poraplanId: string;
  fullName: string;
  authEmail: string;
  linkedEmail?: string;
  passwordHash: string;
  role: UserRole;
  status: AccountStatus;
  avatarUrl?: string;
}

/**
 * Standard test account password hash (SHA-256 for 'password').
 * Avoids storing plaintext passwords in frontend/source code.
 */
const DEFAULT_TEST_PASSWORD_HASH = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';

/**
 * In-memory pre-registered authorized accounts for local development and testing.
 * Represents students, mentors, and administrators configured by PoraPlan.
 */
const initialAccounts: MockAccountRecord[] = [
  {
    id: 'mock-student-pp001',
    poraplanId: 'PP001',
    fullName: 'Fahim Rahman',
    authEmail: 'student.pp001@poraplan.internal',
    linkedEmail: 'student.fahim@gmail.com',
    passwordHash: DEFAULT_TEST_PASSWORD_HASH,
    role: 'student',
    status: 'active',
  },
  {
    id: 'mock-student-pp002',
    poraplanId: 'PP002',
    fullName: 'Nusrat Jahan',
    authEmail: 'student.pp002@poraplan.internal',
    linkedEmail: undefined,
    passwordHash: DEFAULT_TEST_PASSWORD_HASH,
    role: 'student',
    status: 'not_activated',
  },
  {
    id: 'mock-student-pp003',
    poraplanId: 'PP003',
    fullName: 'Tanvir Ahmed',
    authEmail: 'student.pp003@poraplan.internal',
    linkedEmail: 'tanvir.study@gmail.com',
    passwordHash: DEFAULT_TEST_PASSWORD_HASH,
    role: 'student',
    status: 'active',
  },
  {
    id: 'mock-mentor-ppm001',
    poraplanId: 'PPM001',
    fullName: 'Dr. Rafiqul Islam',
    authEmail: 'mentor.ppm001@poraplan.internal',
    linkedEmail: 'mentor.rafiq@gmail.com',
    passwordHash: DEFAULT_TEST_PASSWORD_HASH,
    role: 'mentor',
    status: 'active',
  },
  {
    id: 'mock-mentor-ppm002',
    poraplanId: 'PPM002',
    fullName: 'Dr. Farhana Yasmin',
    authEmail: 'mentor.ppm002@poraplan.internal',
    linkedEmail: undefined,
    passwordHash: DEFAULT_TEST_PASSWORD_HASH,
    role: 'mentor',
    status: 'not_activated',
  },
  {
    id: 'mock-admin-ppa001',
    poraplanId: 'PPA001',
    fullName: 'PoraPlan System Admin',
    authEmail: 'admin.ppa001@poraplan.internal',
    linkedEmail: 'admin@poraplan.internal',
    passwordHash: DEFAULT_TEST_PASSWORD_HASH,
    role: 'admin',
    status: 'active',
  },
];

// Persistent state across component re-renders during local dev session
let mockStore: MockAccountRecord[] = [...initialAccounts];

/**
 * Resolve PoraPlan ID to account details.
 * Fails if the ID is not pre-registered.
 */
export function resolveMockPoraPlanId(poraplanId: string): {
  authEmail: string;
  status: AccountStatus;
  role: UserRole;
  poraplanId: string;
} | null {
  const cleanId = poraplanId.trim().toUpperCase();
  const account = mockStore.find((acc) => acc.poraplanId.toUpperCase() === cleanId);
  if (!account) {
    return null;
  }
  return {
    authEmail: account.authEmail,
    status: account.status,
    role: account.role,
    poraplanId: account.poraplanId,
  };
}

/**
 * Authenticate credentials against pre-registered mock accounts.
 * Activates 'not_activated' accounts on successful first login.
 */
export function authenticateMockPoraPlanId(
  poraplanId: string,
  password: string
): { account: MockAccountRecord | null; error: Error | null } {
  const cleanId = poraplanId.trim().toUpperCase();
  const accountIndex = mockStore.findIndex((acc) => acc.poraplanId.toUpperCase() === cleanId);

  if (accountIndex === -1) {
    return {
      account: null,
      error: new Error('This PoraPlan ID is not recognized. Please check your ID or contact your mentor.'),
    };
  }

  const account = mockStore[accountIndex];

  if (account.status === 'suspended') {
    return {
      account: null,
      error: new Error('This account is currently suspended. Please contact your mentor or administrator.'),
    };
  }

  const inputHash = sha256(password);
  if (account.passwordHash !== inputHash) {
    return {
      account: null,
      error: new Error('Your PoraPlan ID or password is incorrect.'),
    };
  }

  // Automatic activation on first successful login
  if (account.status === 'not_activated') {
    mockStore[accountIndex] = {
      ...account,
      status: 'active',
    };
  }

  return { account: mockStore[accountIndex], error: null };
}

/**
 * Get account by unique mock ID (for session recovery on refresh).
 */
export function getMockAccountById(id: string): MockAccountRecord | null {
  return mockStore.find((acc) => acc.id === id) || null;
}

/**
 * Check if a Google email is linked to an existing pre-registered PoraPlan member.
 */
export function checkMockGoogleLinked(email: string): {
  isLinked: boolean;
  poraplanId?: string;
  role?: UserRole;
  status?: AccountStatus;
  account?: MockAccountRecord;
} {
  const cleanEmail = email.trim().toLowerCase();
  const account = mockStore.find(
    (acc) =>
      acc.linkedEmail?.toLowerCase() === cleanEmail ||
      acc.authEmail.toLowerCase() === cleanEmail
  );

  if (!account) {
    return { isLinked: false };
  }

  return {
    isLinked: true,
    poraplanId: account.poraplanId,
    role: account.role,
    status: account.status,
    account,
  };
}

/**
 * Connect a personal email address to an activated PoraPlan account.
 */
export function connectMockPersonalEmail(
  userId: string,
  email: string
): { success: boolean; error: Error | null } {
  const cleanEmail = email.trim().toLowerCase();
  const index = mockStore.findIndex((acc) => acc.id === userId);

  if (index === -1) {
    return { success: false, error: new Error('Account not found.') };
  }

  mockStore[index] = {
    ...mockStore[index],
    linkedEmail: cleanEmail,
    status: 'active',
  };

  return { success: true, error: null };
}

/**
 * Reset password for a verified email in mock store.
 */
export function resetMockPassword(
  email: string,
  newPassword: string
): { success: boolean; error: Error | null } {
  const cleanEmail = email.trim().toLowerCase();
  const index = mockStore.findIndex(
    (acc) =>
      acc.linkedEmail?.toLowerCase() === cleanEmail ||
      acc.authEmail.toLowerCase() === cleanEmail
  );

  if (index === -1) {
    return { success: false, error: new Error('No account found associated with this email.') };
  }

  mockStore[index] = {
    ...mockStore[index],
    passwordHash: sha256(newPassword),
  };

  return { success: true, error: null };
}

/**
 * Retrieve Profile structure for a user ID.
 */
export function getMockProfile(userId: string): Profile | null {
  const account = mockStore.find((acc) => acc.id === userId);
  if (!account) return null;

  return {
    id: account.id,
    poraplan_id: account.poraplanId,
    full_name: account.fullName,
    email: account.authEmail,
    linked_email: account.linkedEmail || null,
    role: account.role,
    status: account.status,
    avatar_url: account.avatarUrl || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Update mock profile with strict role protection.
 */
export function updateMockProfile(
  userId: string,
  updates: ProfileUpdate
): { profile: Profile | null; error: Error | null } {
  const index = mockStore.findIndex((acc) => acc.id === userId);
  if (index === -1) {
    return { profile: null, error: new Error('Account not found.') };
  }

  // Explicit security: never allow role or ID change from profile update
  const current = mockStore[index];
  mockStore[index] = {
    ...current,
    fullName: updates.full_name !== undefined ? updates.full_name : current.fullName,
    avatarUrl: updates.avatar_url !== undefined ? (updates.avatar_url ?? undefined) : current.avatarUrl,
    linkedEmail: updates.linked_email !== undefined ? (updates.linked_email ?? undefined) : current.linkedEmail,
  };

  return { profile: getMockProfile(userId), error: null };
}

/**
 * Admin helper to provision / pre-register a new member.
 */
export function adminRegisterMockMember(
  poraplanId: string,
  fullName: string,
  email: string,
  role: UserRole,
  initialPassword = 'password'
): { success: boolean; message: string } {
  const cleanId = poraplanId.trim().toUpperCase();
  if (!cleanId) {
    return { success: false, message: 'Please provide a valid PoraPlan ID.' };
  }

  if (mockStore.some((acc) => acc.poraplanId.toUpperCase() === cleanId)) {
    return { success: false, message: `PoraPlan ID ${cleanId} already exists.` };
  }

  const newRecord: MockAccountRecord = {
    id: `mock-${role}-${cleanId.toLowerCase()}`,
    poraplanId: cleanId,
    fullName: fullName.trim() || 'New Member',
    authEmail: email.trim().toLowerCase() || `${cleanId.toLowerCase()}@poraplan.internal`,
    linkedEmail: undefined,
    passwordHash: sha256(initialPassword),
    role,
    status: 'not_activated',
  };

  mockStore.push(newRecord);
  return { success: true, message: `Member ${cleanId} (${role}) successfully pre-registered.` };
}

/**
 * Mock mentorship pairings: Dr. Rafiqul Islam (PPM001) is paired with Fahim Rahman (PP001).
 */
export function getMockAssignedStudents(mentorId: string): Profile[] {
  const mentor = mockStore.find((acc) => acc.id === mentorId);
  if (mentor?.poraplanId === 'PPM001') {
    const student = getMockProfile('mock-student-pp001');
    return student ? [student] : [];
  }
  return [];
}

export function getMockAssignedMentors(studentId: string): Profile[] {
  const student = mockStore.find((acc) => acc.id === studentId);
  if (student?.poraplanId === 'PP001') {
    const mentor = getMockProfile('mock-mentor-ppm001');
    return mentor ? [mentor] : [];
  }
  return [];
}

/**
 * In-memory mock subjects store.
 */
let mockSubjects: Subject[] = [
  {
    id: 'mock-sub-phy-101',
    student_id: 'mock-student-pp001',
    created_by: 'mock-mentor-ppm001',
    name: 'Physics',
    code: 'PHY-101',
    description: 'Classical mechanics, Newtonian dynamics, and thermodynamics.',
    status: 'active',
    created_at: new Date('2026-10-01T10:00:00Z').toISOString(),
    updated_at: new Date('2026-10-01T10:00:00Z').toISOString(),
  },
  {
    id: 'mock-sub-math-102',
    student_id: 'mock-student-pp001',
    created_by: 'mock-mentor-ppm001',
    name: 'Higher Mathematics',
    code: 'MATH-102',
    description: 'Calculus, coordinate geometry, and vector algebra.',
    status: 'active',
    created_at: new Date('2026-10-01T11:00:00Z').toISOString(),
    updated_at: new Date('2026-10-01T11:00:00Z').toISOString(),
  },
];

export function getMockStudentSubjects(studentId: string): Subject[] {
  return mockSubjects
    .filter((s) => s.student_id === studentId)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export function getMockSubjectById(subjectId: string): Subject | null {
  return mockSubjects.find((s) => s.id === subjectId) || null;
}

export function createMockSubject(params: {
  studentId: string;
  name: string;
  code?: string;
  description?: string;
  createdBy?: string;
}): { subject: Subject | null; error: Error | null } {
  const cleanName = params.name.trim();
  if (!cleanName) {
    return { subject: null, error: new Error('Subject name is required.') };
  }

  // Prevent duplicate subject name for the same student
  const exists = mockSubjects.some(
    (s) => s.student_id === params.studentId && s.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (exists) {
    return { subject: null, error: new Error(`A study area named "${cleanName}" already exists for this student.`) };
  }

  const newSubject: Subject = {
    id: `mock-sub-${Date.now()}`,
    student_id: params.studentId,
    created_by: params.createdBy || null,
    name: cleanName,
    code: params.code?.trim().toUpperCase() || null,
    description: params.description?.trim() || null,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mockSubjects.push(newSubject);
  return { subject: newSubject, error: null };
}

export function updateMockSubject(
  subjectId: string,
  updates: Partial<Pick<Subject, 'name' | 'code' | 'description' | 'status'>>
): { subject: Subject | null; error: Error | null } {
  const index = mockSubjects.findIndex((s) => s.id === subjectId);
  if (index === -1) {
    return { subject: null, error: new Error('Study area not found.') };
  }

  const current = mockSubjects[index];

  if (updates.name !== undefined) {
    const cleanName = updates.name.trim();
    if (!cleanName) {
      return { subject: null, error: new Error('Subject name cannot be empty.') };
    }
    const duplicate = mockSubjects.some(
      (s) => s.id !== subjectId && s.student_id === current.student_id && s.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      return { subject: null, error: new Error(`A study area named "${cleanName}" already exists for this student.`) };
    }
    current.name = cleanName;
  }

  if (updates.code !== undefined) {
    current.code = updates.code ? updates.code.trim().toUpperCase() : null;
  }
  if (updates.description !== undefined) {
    current.description = updates.description ? updates.description.trim() : null;
  }
  if (updates.status !== undefined) {
    current.status = updates.status;
  }
  current.updated_at = new Date().toISOString();

  mockSubjects[index] = { ...current };
  return { subject: { ...current }, error: null };
}

export function deleteMockSubject(subjectId: string): { success: boolean; error: Error | null } {
  const index = mockSubjects.findIndex((s) => s.id === subjectId);
  if (index === -1) {
    return { success: false, error: new Error('Study area not found.') };
  }
  mockSubjects.splice(index, 1);
  return { success: true, error: null };
}

/**
 * In-memory mock study plans store.
 */
let mockStudyPlans: StudyPlan[] = [
  {
    id: 'mock-plan-phy-001',
    student_id: 'mock-student-pp001',
    created_by: 'mock-mentor-ppm001',
    subject_id: 'mock-sub-phy-101',
    title: 'Newtonian Mechanics & Dynamics Milestone',
    description: 'Core foundation of classical mechanics covering Newton\'s laws of motion, friction, and work-energy theorem.',
    status: 'active',
    created_at: new Date('2026-10-02T10:00:00Z').toISOString(),
    updated_at: new Date('2026-10-02T10:00:00Z').toISOString(),
  },
];

let mockStudyPlanItems: StudyPlanItem[] = [
  {
    id: 'mock-plan-item-001',
    plan_id: 'mock-plan-phy-001',
    title: 'Newton\'s First & Second Laws with Free Body Diagrams',
    instructions: 'Review Giancoli Ch. 4 or Resnick & Halliday Ch. 5. Draw FBDs for inclined planes.',
    estimated_minutes: 60,
    target_date: '2026-10-25',
    item_order: 1,
    status: 'in_progress',
    created_at: new Date('2026-10-02T10:00:00Z').toISOString(),
    updated_at: new Date('2026-10-02T10:00:00Z').toISOString(),
  },
  {
    id: 'mock-plan-item-002',
    plan_id: 'mock-plan-phy-001',
    title: 'Frictional Forces (Static vs Kinetic) & Pulleys',
    instructions: 'Solve 5 multi-body friction problems with friction coefficients.',
    estimated_minutes: 45,
    target_date: '2026-10-27',
    item_order: 2,
    status: 'pending',
    created_at: new Date('2026-10-02T10:00:00Z').toISOString(),
    updated_at: new Date('2026-10-02T10:00:00Z').toISOString(),
  },
  {
    id: 'mock-plan-item-003',
    plan_id: 'mock-plan-phy-001',
    title: 'Work-Energy Theorem & Conservation of Energy',
    instructions: 'Derive the work-kinetic energy relation; analyze conservative vs non-conservative forces.',
    estimated_minutes: 90,
    target_date: '2026-10-30',
    item_order: 3,
    status: 'pending',
    created_at: new Date('2026-10-02T10:00:00Z').toISOString(),
    updated_at: new Date('2026-10-02T10:00:00Z').toISOString(),
  },
];

export function getMockStudentStudyPlans(studentId: string): (StudyPlan & { items_count: number; subject_name?: string })[] {
  return mockStudyPlans
    .filter((p) => p.student_id === studentId)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .map((plan) => {
      const itemsCount = mockStudyPlanItems.filter((item) => item.plan_id === plan.id).length;
      const subject = plan.subject_id ? mockSubjects.find((s) => s.id === plan.subject_id) : null;
      return {
        ...plan,
        items_count: itemsCount,
        subject_name: subject ? subject.name : undefined,
      };
    });
}

export function getMockStudyPlanById(planId: string): {
  plan: StudyPlan | null;
  items: StudyPlanItem[];
  subject: Subject | null;
} {
  const plan = mockStudyPlans.find((p) => p.id === planId) || null;
  if (!plan) {
    return { plan: null, items: [], subject: null };
  }
  const items = mockStudyPlanItems
    .filter((item) => item.plan_id === planId)
    .sort((a, b) => a.item_order - b.item_order);
  const subject = plan.subject_id ? mockSubjects.find((s) => s.id === plan.subject_id) || null : null;

  return { plan: { ...plan }, items: items.map((i) => ({ ...i })), subject };
}

export function createMockStudyPlan(params: {
  studentId: string;
  createdBy?: string;
  subjectId?: string;
  title: string;
  description?: string;
  items?: {
    title: string;
    instructions?: string;
    estimated_minutes?: number;
    target_date?: string;
  }[];
}): {
  plan: StudyPlan | null;
  items: StudyPlanItem[];
  error: Error | null;
} {
  const cleanTitle = params.title.trim();
  if (!cleanTitle) {
    return { plan: null, items: [], error: new Error('Plan title is required.') };
  }
  if (!params.studentId) {
    return { plan: null, items: [], error: new Error('Student ID is required.') };
  }

  // If subjectId is supplied, verify it belongs to this student
  if (params.subjectId) {
    const subject = mockSubjects.find((s) => s.id === params.subjectId);
    if (!subject || subject.student_id !== params.studentId) {
      return { plan: null, items: [], error: new Error('Selected study area does not belong to this student.') };
    }
  }

  const planId = `mock-plan-${Date.now()}`;
  const now = new Date().toISOString();

  const newPlan: StudyPlan = {
    id: planId,
    student_id: params.studentId,
    created_by: params.createdBy || null,
    subject_id: params.subjectId || null,
    title: cleanTitle,
    description: params.description?.trim() || null,
    status: 'active',
    created_at: now,
    updated_at: now,
  };

  mockStudyPlans.push(newPlan);

  const createdItems: StudyPlanItem[] = [];
  if (params.items && params.items.length > 0) {
    params.items.forEach((item, idx) => {
      const itemTitle = item.title.trim();
      if (!itemTitle) return; // skip empty item titles

      const newItem: StudyPlanItem = {
        id: `mock-plan-item-${Date.now()}-${idx}`,
        plan_id: planId,
        title: itemTitle,
        instructions: item.instructions?.trim() || null,
        estimated_minutes: item.estimated_minutes && item.estimated_minutes > 0 ? item.estimated_minutes : null,
        target_date: item.target_date || null,
        item_order: idx + 1,
        status: 'pending',
        created_at: now,
        updated_at: now,
      };
      mockStudyPlanItems.push(newItem);
      createdItems.push(newItem);
    });
  }

  return { plan: newPlan, items: createdItems, error: null };
}

export function updateMockStudyPlan(
  planId: string,
  updates: Partial<Pick<StudyPlan, 'title' | 'description' | 'subject_id' | 'status'>>,
  items?: {
    id?: string;
    title: string;
    instructions?: string;
    estimated_minutes?: number;
    target_date?: string;
    status?: StudyPlanItemStatus;
  }[]
): {
  plan: StudyPlan | null;
  items: StudyPlanItem[];
  error: Error | null;
} {
  const index = mockStudyPlans.findIndex((p) => p.id === planId);
  if (index === -1) {
    return { plan: null, items: [], error: new Error('Study plan not found.') };
  }

  const current = mockStudyPlans[index];

  if (updates.title !== undefined) {
    const cleanTitle = updates.title.trim();
    if (!cleanTitle) {
      return { plan: null, items: [], error: new Error('Plan title cannot be empty.') };
    }
    current.title = cleanTitle;
  }
  if (updates.description !== undefined) {
    current.description = updates.description ? updates.description.trim() : null;
  }
  if (updates.subject_id !== undefined) {
    if (updates.subject_id) {
      const sub = mockSubjects.find((s) => s.id === updates.subject_id);
      if (!sub || sub.student_id !== current.student_id) {
        return { plan: null, items: [], error: new Error('Selected study area does not belong to this student.') };
      }
    }
    current.subject_id = updates.subject_id || null;
  }
  if (updates.status !== undefined) {
    current.status = updates.status;
  }
  current.updated_at = new Date().toISOString();
  mockStudyPlans[index] = { ...current };

  // Replace or update items if provided
  if (items !== undefined) {
    // Remove old items for this plan
    mockStudyPlanItems = mockStudyPlanItems.filter((i) => i.plan_id !== planId);
    const now = new Date().toISOString();

    const newItems: StudyPlanItem[] = [];
    items.forEach((item, idx) => {
      const itemTitle = item.title.trim();
      if (!itemTitle) return;

      const newItem: StudyPlanItem = {
        id: item.id || `mock-plan-item-${Date.now()}-${idx}`,
        plan_id: planId,
        title: itemTitle,
        instructions: item.instructions?.trim() || null,
        estimated_minutes: item.estimated_minutes && item.estimated_minutes > 0 ? item.estimated_minutes : null,
        target_date: item.target_date || null,
        item_order: idx + 1,
        status: item.status || 'pending',
        created_at: now,
        updated_at: now,
      };
      mockStudyPlanItems.push(newItem);
      newItems.push(newItem);
    });

    return { plan: { ...current }, items: newItems, error: null };
  }

  const existingItems = mockStudyPlanItems
    .filter((i) => i.plan_id === planId)
    .sort((a, b) => a.item_order - b.item_order);

  return { plan: { ...current }, items: existingItems, error: null };
}

export function deleteMockStudyPlan(planId: string): { success: boolean; error: Error | null } {
  const index = mockStudyPlans.findIndex((p) => p.id === planId);
  if (index === -1) {
    return { success: false, error: new Error('Study plan not found.') };
  }
  mockStudyPlans.splice(index, 1);
  mockStudyPlanItems = mockStudyPlanItems.filter((i) => i.plan_id !== planId);
  return { success: true, error: null };
}
