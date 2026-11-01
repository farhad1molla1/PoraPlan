import type {
  Profile,
  UserRole,
  AccountStatus,
  ProfileUpdate,
  Subject,
  StudyPlan,
  StudyPlanItem,
  StudyPlanItemStatus,
  Task,
  TaskPriority,
  Assignment,
  AssignmentStatus,
  Submission,
  SubmissionType,
  SubmissionStatus,
  Evaluation,
  EvaluationFormat,
  EvaluationStatus,
  Resource,
  ResourceType,
  ResourceStatus,
  Doubt,
  DoubtStatus,
  DoubtPriority,
  DoubtResponse,
  Announcement,
  AnnouncementUpdate,
  AnnouncementScope,
  AnnouncementPriority,
  AnnouncementStatus,
  AnnouncementAcknowledgment,
  Notification,
  NotificationType,
  Program,
  ProgramInsert,
  ProgramUpdate,
  Cohort,
  CohortInsert,
  CohortUpdate,
  ProgramCurriculumSection,
  ProgramCurriculumSectionInsert,
  ProgramCurriculumSectionUpdate,
  ProgramCurriculumTopic,
  ProgramCurriculumTopicInsert,
  ProgramCurriculumTopicUpdate,
  CurriculumSectionWithTopics,
  ProgramApplication,
  ProgramApplicationInsert,
  ProgramEnrollment,
  EnrollmentStatus,
  CohortMentor,
  StudentMentorAssignment,
  EffectiveMentorResolution,
  MentorWorkloadSummary,
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
  whatsappNumber?: string;
  university?: string;
  department?: string;
  batch?: string;
  currentSemester?: string;
  academicBackground?: string;
  expertise?: string;
  mentoringSubjects?: string;
  bio?: string;
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
    whatsappNumber: '+8801712345678',
    university: 'Dhaka University',
    department: 'Computer Science & Engineering',
    batch: '2023',
    currentSemester: '4th Semester',
    bio: 'Focusing on algorithmic problem solving, core computer science subjects, and daily study discipline with PoraPlan mentor.',
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
    whatsappNumber: '+8801812345679',
    university: 'BUET',
    department: 'Electrical & Electronic Engineering',
    batch: '2024',
    currentSemester: '2nd Semester',
    bio: 'Working to establish steady daily study rhythm and tackle circuit analysis with mentor guidance.',
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
    whatsappNumber: '+8801912345680',
    university: 'NSU',
    department: 'BBA - Finance',
    batch: '2022',
    currentSemester: '6th Semester',
    bio: 'Focusing on corporate financial planning and quantitative analysis coursework.',
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
    whatsappNumber: '+8801700112233',
    university: 'Dhaka University',
    department: 'Computer Science & Engineering',
    academicBackground: 'Ph.D. in Computer Science, M.Sc. in Software Systems',
    expertise: 'Data Structures, Algorithms, Discrete Mathematics, Academic Routine Structuring',
    mentoringSubjects: 'Data Structures (CSE-201), Discrete Mathematics (CSE-205), Algorithm Design',
    bio: 'Senior academic mentor with 8+ years experience guiding undergraduate students in building structured study systems, breaking down challenging curricula, and maintaining consistent academic momentum.',
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
    whatsappNumber: '+8801800112244',
    university: 'BUET',
    department: 'Mathematics',
    academicBackground: 'Ph.D. in Applied Mathematics',
    expertise: 'Calculus, Linear Algebra, Differential Equations',
    mentoringSubjects: 'Calculus I & II, Linear Algebra',
    bio: 'Passionate about helping engineering and science students turn abstract formulas into intuitive, daily manageable practice.',
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
    whatsappNumber: '+8801700000001',
    bio: 'Central academic administration and student-mentor coordination desk for PoraPlan.',
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
    whatsapp_number: account.whatsappNumber || null,
    university: account.university || null,
    department: account.department || null,
    batch: account.batch || null,
    current_semester: account.currentSemester || null,
    academic_background: account.academicBackground || null,
    expertise: account.expertise || null,
    mentoring_subjects: account.mentoringSubjects || null,
    bio: account.bio || null,
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

  // Explicit security: never allow role, poraplan_id, or status change from profile update
  const current = mockStore[index];
  mockStore[index] = {
    ...current,
    fullName: updates.full_name !== undefined ? updates.full_name : current.fullName,
    avatarUrl: updates.avatar_url !== undefined ? (updates.avatar_url ?? undefined) : current.avatarUrl,
    linkedEmail: updates.linked_email !== undefined ? (updates.linked_email ?? undefined) : current.linkedEmail,
    whatsappNumber: updates.whatsapp_number !== undefined ? (updates.whatsapp_number ?? undefined) : current.whatsappNumber,
    university: updates.university !== undefined ? (updates.university ?? undefined) : current.university,
    department: updates.department !== undefined ? (updates.department ?? undefined) : current.department,
    batch: updates.batch !== undefined ? (updates.batch ?? undefined) : current.batch,
    currentSemester: updates.current_semester !== undefined ? (updates.current_semester ?? undefined) : current.currentSemester,
    academicBackground: updates.academic_background !== undefined ? (updates.academic_background ?? undefined) : current.academicBackground,
    expertise: updates.expertise !== undefined ? (updates.expertise ?? undefined) : current.expertise,
    mentoringSubjects: updates.mentoring_subjects !== undefined ? (updates.mentoring_subjects ?? undefined) : current.mentoringSubjects,
    bio: updates.bio !== undefined ? (updates.bio ?? undefined) : current.bio,
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
 * Mock mentorship pairings: resolved dynamically using effective mentor resolution engine.
 */
export function getMockAssignedStudents(mentorId: string, programId?: string): Profile[] {
  const effectiveMentees = getMockEffectiveStudentsForMentor(mentorId);
  const filtered = programId ? effectiveMentees.filter((item) => item.program?.id === programId) : effectiveMentees;
  return filtered.map((item) => item.student);
}

export function getMockAssignedMentors(studentId: string, programId?: string): Profile[] {
  if (programId) {
    const resolution = getMockEffectiveMentorForStudent(studentId, programId);
    return resolution.mentor ? [resolution.mentor] : [];
  }
  const activeEnrollments = getMockEnrollments({ studentId, status: 'active' });
  if (activeEnrollments.length === 0) {
    const resolution = getMockEffectiveMentorForStudent(studentId);
    return resolution.mentor ? [resolution.mentor] : [];
  }
  const mentorsMap = new Map<string, Profile>();
  for (const enr of activeEnrollments) {
    const res = getMockEffectiveMentorForStudent(studentId, enr.program_id);
    if (res.mentor) {
      mentorsMap.set(res.mentor.id, res.mentor);
    }
  }
  return Array.from(mentorsMap.values());
}

/**
 * In-memory mock subjects store.
 */
let mockSubjects: Subject[] = [
  {
    id: 'mock-sub-phy-101',
    student_id: 'mock-student-pp001',
    created_by: 'mock-mentor-ppm001',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
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
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    name: 'Higher Mathematics',
    code: 'MATH-102',
    description: 'Calculus, coordinate geometry, and vector algebra.',
    status: 'active',
    created_at: new Date('2026-10-01T11:00:00Z').toISOString(),
    updated_at: new Date('2026-10-01T11:00:00Z').toISOString(),
  },
];

export function getMockStudentSubjects(studentId: string, programId?: string): Subject[] {
  let list = mockSubjects.filter((s) => s.student_id === studentId);
  if (programId && programId !== 'all') {
    list = list.filter((s) => !s.program_id || s.program_id === programId);
  }
  return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
  programId?: string;
  cohortId?: string;
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
    program_id: params.programId || null,
    cohort_id: params.cohortId || null,
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
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
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
  programId?: string;
  cohortId?: string;
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
    program_id: params.programId || null,
    cohort_id: params.cohortId || null,
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

  if (params.createdBy && params.createdBy !== params.studentId) {
    createMockNotification({
      recipientId: params.studentId,
      actorId: params.createdBy,
      type: 'plan_updated',
      title: 'Study Plan Assigned',
      message: `Mentor published study plan "${cleanTitle}"`,
      link: '/student/plans',
      idempotencyKey: `plan:${planId}`,
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

/**
 * In-memory mock tasks store.
 */
let mockTasks: Task[] = [
  {
    id: 'mock-task-001',
    student_id: 'mock-student-pp001',
    created_by: 'mock-mentor-ppm001',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    subject_id: 'mock-sub-phy-101',
    plan_id: 'mock-plan-phy-001',
    title: 'Review Giancoli Ch. 4 Newton\'s Laws & Draw FBDs',
    description: 'Complete standard free body diagrams for 3 friction incline cases.',
    priority: 'high',
    status: 'in_progress',
    due_date: '2026-10-25',
    estimated_minutes: 60,
    created_at: new Date('2026-10-03T10:00:00Z').toISOString(),
    updated_at: new Date('2026-10-03T10:00:00Z').toISOString(),
  },
  {
    id: 'mock-task-002',
    student_id: 'mock-student-pp001',
    created_by: 'mock-mentor-ppm001',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    subject_id: 'mock-sub-phy-101',
    plan_id: 'mock-plan-phy-001',
    title: 'Practice 5 Pulley & Kinetic Friction Multi-Body Problems',
    description: 'Calculate normal force and tension vectors for Atwood machine setups.',
    priority: 'medium',
    status: 'pending',
    due_date: '2026-10-27',
    estimated_minutes: 50,
    created_at: new Date('2026-10-03T11:00:00Z').toISOString(),
    updated_at: new Date('2026-10-03T11:00:00Z').toISOString(),
  },
  {
    id: 'mock-task-003',
    student_id: 'mock-student-pp001',
    created_by: 'mock-mentor-ppm001',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    subject_id: 'mock-sub-phy-101',
    plan_id: 'mock-plan-phy-001',
    title: 'Read Vectors & 1D Kinematics Overview',
    description: 'Read Halliday & Resnick Chapter 2 and summarize kinematic formulas.',
    priority: 'medium',
    status: 'completed',
    due_date: '2026-10-15',
    estimated_minutes: 45,
    completed_at: new Date('2026-10-14T16:30:00Z').toISOString(),
    created_at: new Date('2026-10-01T09:00:00Z').toISOString(),
    updated_at: new Date('2026-10-14T16:30:00Z').toISOString(),
  },
];

export function getMockStudentTasks(studentId: string): (Task & { subject_name?: string; plan_title?: string })[] {
  return mockTasks
    .filter((t) => t.student_id === studentId)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .map((task) => {
      const subject = task.subject_id ? mockSubjects.find((s) => s.id === task.subject_id) : null;
      const plan = task.plan_id ? mockStudyPlans.find((p) => p.id === task.plan_id) : null;
      return {
        ...task,
        subject_name: subject ? subject.name : undefined,
        plan_title: plan ? plan.title : undefined,
      };
    });
}

export function getMockTaskById(taskId: string): Task | null {
  const task = mockTasks.find((t) => t.id === taskId);
  return task ? { ...task } : null;
}

export function createMockTask(params: {
  studentId: string;
  createdBy?: string;
  subjectId?: string;
  planId?: string;
  programId?: string;
  cohortId?: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  estimatedMinutes?: number;
  attachmentPath?: string;
  attachmentName?: string;
  attachmentSize?: number;
}): { task: Task | null; error: Error | null } {
  const cleanTitle = params.title.trim();
  if (!cleanTitle) {
    return { task: null, error: new Error('Task title is required.') };
  }
  if (!params.studentId) {
    return { task: null, error: new Error('Student ID is required.') };
  }

  // Validate subject ownership if provided
  if (params.subjectId) {
    const subject = mockSubjects.find((s) => s.id === params.subjectId);
    if (!subject || subject.student_id !== params.studentId) {
      return { task: null, error: new Error('Selected study area does not belong to this student.') };
    }
  }

  // Validate plan ownership if provided
  if (params.planId) {
    const plan = mockStudyPlans.find((p) => p.id === params.planId);
    if (!plan || plan.student_id !== params.studentId) {
      return { task: null, error: new Error('Selected study plan does not belong to this student.') };
    }
  }

  const taskId = `mock-task-${Date.now()}`;
  const now = new Date().toISOString();

  const newTask: Task = {
    id: taskId,
    student_id: params.studentId,
    created_by: params.createdBy || null,
    program_id: params.programId || null,
    cohort_id: params.cohortId || null,
    subject_id: params.subjectId || null,
    plan_id: params.planId || null,
    title: cleanTitle,
    description: params.description?.trim() || null,
    priority: params.priority || 'medium',
    status: 'pending',
    due_date: params.dueDate || null,
    estimated_minutes: params.estimatedMinutes && params.estimatedMinutes > 0 ? params.estimatedMinutes : null,
    completed_at: null,
    attachment_path: params.attachmentPath || null,
    attachment_name: params.attachmentName || null,
    attachment_size: params.attachmentSize || null,
    created_at: now,
    updated_at: now,
  };

  mockTasks.push(newTask);

  if (params.createdBy && params.createdBy !== params.studentId) {
    createMockNotification({
      recipientId: params.studentId,
      actorId: params.createdBy,
      type: 'task_created',
      title: 'New Task Assigned',
      message: `Mentor assigned task "${cleanTitle}"`,
      link: '/student/tasks',
      idempotencyKey: `task:${taskId}`,
    });
  }

  return { task: { ...newTask }, error: null };
}

export function updateMockTask(
  taskId: string,
  updates: Partial<Pick<Task, 'title' | 'description' | 'subject_id' | 'plan_id' | 'priority' | 'status' | 'due_date' | 'estimated_minutes' | 'completed_at' | 'attachment_path' | 'attachment_name' | 'attachment_size'>>
): { task: Task | null; error: Error | null } {
  const index = mockTasks.findIndex((t) => t.id === taskId);
  if (index === -1) {
    return { task: null, error: new Error('Task not found.') };
  }

  const current = mockTasks[index];

  if (updates.title !== undefined) {
    const cleanTitle = updates.title.trim();
    if (!cleanTitle) {
      return { task: null, error: new Error('Task title cannot be empty.') };
    }
    current.title = cleanTitle;
  }
  if (updates.description !== undefined) {
    current.description = updates.description ? updates.description.trim() : null;
  }
  if (updates.subject_id !== undefined) {
    if (updates.subject_id) {
      const subject = mockSubjects.find((s) => s.id === updates.subject_id);
      if (!subject || subject.student_id !== current.student_id) {
        return { task: null, error: new Error('Selected study area does not belong to this student.') };
      }
    }
    current.subject_id = updates.subject_id || null;
  }
  if (updates.plan_id !== undefined) {
    if (updates.plan_id) {
      const plan = mockStudyPlans.find((p) => p.id === updates.plan_id);
      if (!plan || plan.student_id !== current.student_id) {
        return { task: null, error: new Error('Selected study plan does not belong to this student.') };
      }
    }
    current.plan_id = updates.plan_id || null;
  }
  if (updates.priority !== undefined) {
    current.priority = updates.priority;
  }
  if (updates.status !== undefined) {
    current.status = updates.status;
    if (updates.status === 'completed' && !current.completed_at) {
      current.completed_at = new Date().toISOString();
    } else if (updates.status !== 'completed') {
      current.completed_at = null;
    }
  }
  if (updates.due_date !== undefined) {
    current.due_date = updates.due_date || null;
  }
  if (updates.estimated_minutes !== undefined) {
    current.estimated_minutes = updates.estimated_minutes && updates.estimated_minutes > 0 ? updates.estimated_minutes : null;
  }
  if (updates.completed_at !== undefined) {
    current.completed_at = updates.completed_at;
  }
  if (updates.attachment_path !== undefined) {
    current.attachment_path = updates.attachment_path;
  }
  if (updates.attachment_name !== undefined) {
    current.attachment_name = updates.attachment_name;
  }
  if (updates.attachment_size !== undefined) {
    current.attachment_size = updates.attachment_size;
  }

  current.updated_at = new Date().toISOString();
  mockTasks[index] = { ...current };

  return { task: { ...current }, error: null };
}

export function deleteMockTask(taskId: string): { success: boolean; error: Error | null } {
  const index = mockTasks.findIndex((t) => t.id === taskId);
  if (index === -1) {
    return { success: false, error: new Error('Task not found.') };
  }
  mockTasks.splice(index, 1);
  return { success: true, error: null };
}

// ==============================================================================
// MOCK ASSIGNMENTS & SUBMISSIONS STORE (Milestone 10)
// ==============================================================================

export const mockAssignments: Assignment[] = [
  {
    id: 'mock-assign-001',
    student_id: 'mock-student-pp001',
    mentor_id: 'mock-mentor-ppm001',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    subject_id: 'mock-sub-phy-101',
    plan_id: 'mock-plan-phy-001',
    title: 'Newtonian Mechanics Problem Set: Inclined Planes & Pulley Friction',
    instructions: 'Solve problems 14, 18, and 22 from Giancoli Ch. 4. Clearly write free body diagrams for each body, show the coordinate system chosen, and state the algebraic solution before substituting numerical values.',
    due_date: '2026-10-28',
    total_points: 100,
    status: 'published',
    created_at: new Date('2026-10-04T12:00:00Z').toISOString(),
    updated_at: new Date('2026-10-04T12:00:00Z').toISOString(),
  },
  {
    id: 'mock-assign-002',
    student_id: 'mock-student-pp001',
    mentor_id: 'mock-mentor-ppm001',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    subject_id: 'mock-sub-math-102',
    plan_id: null,
    title: 'Calculus Optimization & Critical Point Analysis',
    instructions: 'Find local extrema and points of inflection for the polynomial f(x) = 2x^3 - 9x^2 + 12x - 3. Compute both the first and second derivative tests. Provide your reasoning in clear mathematical notation.',
    due_date: '2026-10-31',
    total_points: 50,
    status: 'published',
    created_at: new Date('2026-10-05T09:00:00Z').toISOString(),
    updated_at: new Date('2026-10-05T09:00:00Z').toISOString(),
  },
];

export const mockSubmissions: Submission[] = [
  {
    id: 'mock-subm-001',
    assignment_id: 'mock-assign-001',
    student_id: 'mock-student-pp001',
    submission_type: 'text',
    content: 'Derived acceleration equation: a = g(sin θ - μ cos θ). For m1 = 5kg, m2 = 3kg on 30° incline with μk = 0.15: System acceleration a = 1.84 m/s²; Tension T = 23.9 N. Free-body diagram scanned and verified.',
    link_url: null,
    file_name: null,
    file_size: null,
    status: 'submitted',
    submitted_at: new Date('2026-10-20T14:30:00Z').toISOString(),
    updated_at: new Date('2026-10-20T14:30:00Z').toISOString(),
  },
];

export interface EnrichedMockAssignment extends Assignment {
  subject_name?: string;
  plan_title?: string;
  submission?: Submission | null;
}

export function getMockStudentAssignments(studentId: string): EnrichedMockAssignment[] {
  const normalizedId = studentId === 'PP001' ? 'mock-student-pp001' : studentId;
  return mockAssignments
    .filter((a) => a.student_id === normalizedId || a.student_id === studentId)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .map((assignment) => {
      const subject = assignment.subject_id ? mockSubjects.find((s) => s.id === assignment.subject_id) : null;
      const plan = assignment.plan_id ? mockStudyPlans.find((p) => p.id === assignment.plan_id) : null;
      const submission = mockSubmissions.find(
        (sub) => sub.assignment_id === assignment.id && (sub.student_id === normalizedId || sub.student_id === studentId)
      ) || null;

      return {
        ...assignment,
        subject_name: subject ? subject.name : undefined,
        plan_title: plan ? plan.title : undefined,
        submission: submission ? { ...submission } : null,
      };
    });
}

export function getMockAssignmentById(assignmentId: string): {
  assignment: Assignment | null;
  subject: Subject | null;
  plan: StudyPlan | null;
  submission: Submission | null;
} {
  const assignment = mockAssignments.find((a) => a.id === assignmentId) || null;
  if (!assignment) {
    return { assignment: null, subject: null, plan: null, submission: null };
  }
  const subject = assignment.subject_id ? mockSubjects.find((s) => s.id === assignment.subject_id) || null : null;
  const plan = assignment.plan_id ? mockStudyPlans.find((p) => p.id === assignment.plan_id) || null : null;
  const submission = mockSubmissions.find((s) => s.assignment_id === assignmentId) || null;

  return {
    assignment: { ...assignment },
    subject: subject ? { ...subject } : null,
    plan: plan ? { ...plan } : null,
    submission: submission ? { ...submission } : null,
  };
}

export function createMockAssignment(params: {
  studentId: string;
  mentorId?: string;
  subjectId?: string;
  planId?: string;
  programId?: string;
  cohortId?: string;
  title: string;
  instructions?: string;
  dueDate?: string;
  totalPoints?: number;
  status?: AssignmentStatus;
}): { assignment: Assignment | null; error: Error | null } {
  const cleanTitle = params.title.trim();
  if (!cleanTitle) {
    return { assignment: null, error: new Error('Assignment title is required.') };
  }
  if (!params.studentId) {
    return { assignment: null, error: new Error('Student ID is required.') };
  }

  const normalizedStudentId = params.studentId === 'PP001' ? 'mock-student-pp001' : params.studentId;

  // Validate subject ownership if provided
  if (params.subjectId) {
    const subject = mockSubjects.find((s) => s.id === params.subjectId);
    if (!subject || (subject.student_id !== normalizedStudentId && subject.student_id !== params.studentId)) {
      return { assignment: null, error: new Error('Selected study area does not belong to this student.') };
    }
  }

  // Validate plan ownership if provided
  if (params.planId) {
    const plan = mockStudyPlans.find((p) => p.id === params.planId);
    if (!plan || (plan.student_id !== normalizedStudentId && plan.student_id !== params.studentId)) {
      return { assignment: null, error: new Error('Selected study plan does not belong to this student.') };
    }
  }

  const assignmentId = `mock-assign-${Date.now()}`;
  const now = new Date().toISOString();

  const newAssignment: Assignment = {
    id: assignmentId,
    student_id: normalizedStudentId,
    mentor_id: params.mentorId || null,
    program_id: params.programId || null,
    cohort_id: params.cohortId || null,
    subject_id: params.subjectId || null,
    plan_id: params.planId || null,
    title: cleanTitle,
    instructions: params.instructions?.trim() || null,
    due_date: params.dueDate || null,
    total_points: params.totalPoints !== undefined ? params.totalPoints : 100,
    status: params.status || 'published',
    created_at: now,
    updated_at: now,
  };

  mockAssignments.push(newAssignment);

  if (newAssignment.status === 'published') {
    createMockNotification({
      recipientId: params.studentId,
      actorId: params.mentorId,
      type: 'assignment_created',
      title: 'New Assignment Published',
      message: `Mentor assigned "${cleanTitle}" (${newAssignment.total_points || 100} pts)`,
      link: '/student/assignments',
      idempotencyKey: `assignment:${assignmentId}`,
    });
  }

  return { assignment: { ...newAssignment }, error: null };
}

export function updateMockAssignment(
  assignmentId: string,
  updates: Partial<Pick<Assignment, 'title' | 'instructions' | 'subject_id' | 'plan_id' | 'due_date' | 'total_points' | 'status'>>
): { assignment: Assignment | null; error: Error | null } {
  const index = mockAssignments.findIndex((a) => a.id === assignmentId);
  if (index === -1) {
    return { assignment: null, error: new Error('Assignment not found.') };
  }

  const current = mockAssignments[index];

  if (updates.title !== undefined) {
    const cleanTitle = updates.title.trim();
    if (!cleanTitle) {
      return { assignment: null, error: new Error('Assignment title cannot be empty.') };
    }
    current.title = cleanTitle;
  }
  if (updates.instructions !== undefined) {
    current.instructions = updates.instructions ? updates.instructions.trim() : null;
  }
  if (updates.subject_id !== undefined) {
    if (updates.subject_id) {
      const subject = mockSubjects.find((s) => s.id === updates.subject_id);
      if (!subject || (subject.student_id !== current.student_id && subject.student_id !== 'mock-student-pp001')) {
        return { assignment: null, error: new Error('Selected study area does not belong to this student.') };
      }
    }
    current.subject_id = updates.subject_id || null;
  }
  if (updates.plan_id !== undefined) {
    if (updates.plan_id) {
      const plan = mockStudyPlans.find((p) => p.id === updates.plan_id);
      if (!plan || (plan.student_id !== current.student_id && plan.student_id !== 'mock-student-pp001')) {
        return { assignment: null, error: new Error('Selected study plan does not belong to this student.') };
      }
    }
    current.plan_id = updates.plan_id || null;
  }
  if (updates.due_date !== undefined) {
    current.due_date = updates.due_date || null;
  }
  if (updates.total_points !== undefined) {
    current.total_points = updates.total_points;
  }
  if (updates.status !== undefined) {
    current.status = updates.status;
  }

  current.updated_at = new Date().toISOString();
  mockAssignments[index] = { ...current };

  return { assignment: { ...current }, error: null };
}

export function deleteMockAssignment(assignmentId: string): { success: boolean; error: Error | null } {
  const index = mockAssignments.findIndex((a) => a.id === assignmentId);
  if (index === -1) {
    return { success: false, error: new Error('Assignment not found.') };
  }

  // Also remove associated submissions
  const subIndex = mockSubmissions.findIndex((s) => s.assignment_id === assignmentId);
  if (subIndex !== -1) {
    mockSubmissions.splice(subIndex, 1);
  }

  mockAssignments.splice(index, 1);
  return { success: true, error: null };
}

export function submitMockAssignment(params: {
  assignmentId: string;
  studentId: string;
  submissionType: SubmissionType;
  content: string;
  linkUrl?: string;
  fileName?: string;
  fileSize?: number;
  filePath?: string;
}): { submission: Submission | null; error: Error | null } {
  const cleanContent = params.content.trim();
  if (!cleanContent) {
    return { submission: null, error: new Error('Submission content cannot be empty.') };
  }
  if (!params.assignmentId) {
    return { submission: null, error: new Error('Assignment ID is required.') };
  }
  if (!params.studentId) {
    return { submission: null, error: new Error('Student ID is required.') };
  }

  const normalizedStudentId = params.studentId === 'PP001' ? 'mock-student-pp001' : params.studentId;

  const assignment = mockAssignments.find((a) => a.id === params.assignmentId);
  if (!assignment) {
    return { submission: null, error: new Error('Assignment not found.') };
  }
  if (assignment.student_id !== normalizedStudentId && assignment.student_id !== params.studentId) {
    return { submission: null, error: new Error('You are not authorized to submit work for this assignment.') };
  }
  if (assignment.status === 'closed' || assignment.status === 'archived') {
    return { submission: null, error: new Error('This assignment is closed for submissions.') };
  }

  if (params.submissionType === 'link') {
    const url = params.linkUrl?.trim() || cleanContent;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { submission: null, error: new Error('External link must start with http:// or https://') };
    }
  }

  const now = new Date().toISOString();
  const existingIndex = mockSubmissions.findIndex(
    (s) => s.assignment_id === params.assignmentId && (s.student_id === normalizedStudentId || s.student_id === params.studentId)
  );

  if (existingIndex !== -1) {
    // Update existing submission (prevent duplicates)
    const current = mockSubmissions[existingIndex];
    if (current.status === 'reviewed') {
      return { submission: null, error: new Error('Cannot modify or resubmit an already reviewed submission.') };
    }
    if (current.status === 'under_review') {
      return { submission: null, error: new Error('Submission is currently under mentor review and cannot be modified.') };
    }
    current.submission_type = params.submissionType;
    current.content = cleanContent;
    current.link_url = params.linkUrl?.trim() || (params.submissionType === 'link' ? cleanContent : null);
    current.file_name = params.fileName || current.file_name;
    current.file_size = params.fileSize || current.file_size;
    current.file_path = params.filePath !== undefined ? (params.filePath || null) : current.file_path;
    current.status = 'submitted';
    current.submitted_at = now;
    current.updated_at = now;
    mockSubmissions[existingIndex] = { ...current };
    return { submission: { ...current }, error: null };
  }

  const newSubmission: Submission = {
    id: `mock-subm-${Date.now()}`,
    assignment_id: params.assignmentId,
    student_id: normalizedStudentId,
    submission_type: params.submissionType,
    content: cleanContent,
    link_url: params.linkUrl?.trim() || (params.submissionType === 'link' ? cleanContent : null),
    file_name: params.fileName || null,
    file_size: params.fileSize || null,
    file_path: params.filePath || null,
    status: 'submitted',
    submitted_at: now,
    updated_at: now,
  };

  mockSubmissions.push(newSubmission);
  return { submission: { ...newSubmission }, error: null };
}

export function updateMockSubmissionStatus(
  submissionId: string,
  status: SubmissionStatus
): { submission: Submission | null; error: Error | null } {
  const index = mockSubmissions.findIndex((s) => s.id === submissionId);
  if (index === -1) {
    return { submission: null, error: new Error('Submission not found.') };
  }
  const current = mockSubmissions[index];
  if (current.status === 'reviewed' && status === 'submitted') {
    return { submission: null, error: new Error('Cannot downgrade a reviewed submission back to submitted.') };
  }
  current.status = status;
  current.updated_at = new Date().toISOString();
  mockSubmissions[index] = { ...current };
  return { submission: { ...current }, error: null };
}

export interface EnrichedMockSubmission extends Submission {
  assignment_title?: string;
  assignment_total_points?: number | null;
  subject_name?: string;
  student_name?: string;
  student_poraplan_id?: string;
  reviewer_name?: string;
}

export function reviewMockSubmission(params: {
  submissionId: string;
  mentorId: string;
  status: SubmissionStatus;
  feedback: string;
  score?: number | null;
}): { submission: Submission | null; error: Error | null } {
  const cleanFeedback = params.feedback.trim();
  if (!cleanFeedback) {
    return { submission: null, error: new Error('Feedback comments are required.') };
  }
  if (!params.submissionId) {
    return { submission: null, error: new Error('Submission ID is required.') };
  }

  const index = mockSubmissions.findIndex((s) => s.id === params.submissionId);
  if (index === -1) {
    return { submission: null, error: new Error('Submission not found.') };
  }

  const current = mockSubmissions[index];

  // Verify mentor assignment to student
  const normalizedMentorId = params.mentorId === 'PPM001' ? 'mock-mentor-ppm001' : params.mentorId;
  const assignment = mockAssignments.find((a) => a.id === current.assignment_id);
  const isAssigned = isMockAuthorizedMentorForStudent(normalizedMentorId, current.student_id, assignment?.program_id);

  if (!isAssigned && params.mentorId !== 'admin' && params.mentorId !== 'mock-admin-ppa001') {
    return { submission: null, error: new Error('You are not authorized to review submissions for this student.') };
  }

  const now = new Date().toISOString();
  current.status = params.status || 'reviewed';
  current.feedback = cleanFeedback;
  current.score = params.score !== undefined ? params.score : null;
  current.reviewed_by = normalizedMentorId;
  current.reviewed_at = now;
  current.updated_at = now;

  mockSubmissions[index] = { ...current };

  const assignmentTitle = assignment?.title || 'Assignment';

  createMockNotification({
    recipientId: current.student_id,
    actorId: normalizedMentorId,
    type: 'submission_reviewed',
    title: 'Submission Reviewed',
    message: `Mentor reviewed your submission for "${assignmentTitle}"${params.score !== undefined && params.score !== null ? ` — Score: ${params.score}` : ''}`,
    link: '/student/assignments',
    idempotencyKey: `submission_review:${params.submissionId}`,
  });

  return { submission: { ...current }, error: null };
}

export function getMockMentorSubmissions(mentorId: string): EnrichedMockSubmission[] {
  const normalizedMentorId = mentorId === 'PPM001' ? 'mock-mentor-ppm001' : mentorId;

  return mockSubmissions
    .filter((s) => {
      const assignment = mockAssignments.find((a) => a.id === s.assignment_id);
      return isMockAuthorizedMentorForStudent(normalizedMentorId, s.student_id, assignment?.program_id);
    })
    .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime())
    .map((sub) => {
      const assignment = mockAssignments.find((a) => a.id === sub.assignment_id);
      const student = mockStore.find((acc) => acc.id === sub.student_id);
      const subject = assignment?.subject_id ? mockSubjects.find((s) => s.id === assignment.subject_id) : null;
      const reviewer = sub.reviewed_by ? mockStore.find((acc) => acc.id === sub.reviewed_by) : null;

      return {
        ...sub,
        assignment_title: assignment ? assignment.title : 'Assignment',
        assignment_total_points: assignment?.total_points || 100,
        subject_name: subject ? subject.name : undefined,
        student_name: student ? student.fullName : 'Scholar',
        student_poraplan_id: student ? student.poraplanId : 'PP001',
        reviewer_name: reviewer ? reviewer.fullName : undefined,
      };
    });
}

// ==============================================================================
// EVALUATIONS & MILESTONE ASSESSMENTS MOCK DATA & STORE
// ==============================================================================

export interface EnrichedMockEvaluation extends Evaluation {
  student_name?: string;
  student_poraplan_id?: string;
  student_email?: string;
  mentor_name?: string;
  subject_name?: string;
  plan_title?: string;
  assignment_title?: string;
}

export const mockEvaluations: Evaluation[] = [
  {
    id: 'mock-eval-001',
    student_id: 'mock-student-pp001',
    mentor_id: 'mock-mentor-ppm001',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    subject_id: 'mock-sub-phy-101',
    plan_id: 'mock-plan-phy-001',
    assignment_id: 'mock-assign-001',
    title: 'Mechanics Milestone Oral Assessment & Problem Solving',
    description: 'Oral walkthrough of Newton second law problem set and friction force resolution on inclined plane.',
    format: 'oral',
    status: 'completed',
    scheduled_date: '2026-10-18',
    scheduled_time: '15:00',
    duration_minutes: 40,
    total_points: 100,
    score: 92.0,
    feedback: 'Strong grasp of gravitational acceleration and normal reaction components. Minor hesitation on kinetic friction direction; reviewed and resolved during the session.',
    recommendation: 'Proceed to Work, Energy, and Power milestone plan.',
    evaluated_at: '2026-10-18T15:45:00.000Z',
    created_at: '2026-10-15T10:00:00.000Z',
    updated_at: '2026-10-18T15:45:00.000Z',
  },
  {
    id: 'mock-eval-002',
    student_id: 'mock-student-pp001',
    mentor_id: 'mock-mentor-ppm001',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    subject_id: 'mock-sub-math-102',
    title: 'Calculus Milestone Review: Derivatives from First Principles',
    description: 'Demonstrate limit definition of derivative and chain rule application on trigonometric composites.',
    format: 'written',
    status: 'scheduled',
    scheduled_date: '2026-10-25',
    scheduled_time: '16:30',
    duration_minutes: 45,
    total_points: 50,
    score: null,
    feedback: null,
    recommendation: null,
    evaluated_at: null,
    created_at: '2026-10-20T10:00:00.000Z',
    updated_at: '2026-10-20T10:00:00.000Z',
  },
];

function enrichMockEvaluation(evaluation: Evaluation): EnrichedMockEvaluation {
  const student = mockStore.find((u) => u.id === evaluation.student_id);
  const mentor = evaluation.mentor_id ? mockStore.find((u) => u.id === evaluation.mentor_id) : null;
  const subject = evaluation.subject_id ? mockSubjects.find((s) => s.id === evaluation.subject_id) : null;
  const plan = evaluation.plan_id ? mockStudyPlans.find((p) => p.id === evaluation.plan_id) : null;
  const assignment = evaluation.assignment_id ? mockAssignments.find((a) => a.id === evaluation.assignment_id) : null;

  return {
    ...evaluation,
    student_name: student?.fullName || 'Scholar',
    student_poraplan_id: student?.poraplanId || 'PP001',
    student_email: student?.authEmail || undefined,
    mentor_name: mentor?.fullName || undefined,
    subject_name: subject?.name || undefined,
    plan_title: plan?.title || undefined,
    assignment_title: assignment?.title || undefined,
  };
}

export function getMockStudentEvaluations(studentId: string): EnrichedMockEvaluation[] {
  return mockEvaluations
    .filter((e) => e.student_id === studentId)
    .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())
    .map(enrichMockEvaluation);
}

export function getMockMentorEvaluations(mentorId: string): EnrichedMockEvaluation[] {
  const normalizedMentorId = mentorId === 'PPM001' ? 'mock-mentor-ppm001' : mentorId;

  return mockEvaluations
    .filter((e) => isMockAuthorizedMentorForStudent(normalizedMentorId, e.student_id, e.program_id))
    .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())
    .map(enrichMockEvaluation);
}

export function getMockEvaluationById(evaluationId: string): {
  evaluation: EnrichedMockEvaluation | null;
  error: Error | null;
} {
  const found = mockEvaluations.find((e) => e.id === evaluationId);
  if (!found) {
    return { evaluation: null, error: new Error('Evaluation not found.') };
  }
  return { evaluation: enrichMockEvaluation(found), error: null };
}

export function createMockEvaluation(params: {
  studentId: string;
  mentorId: string;
  title: string;
  scheduledDate: string;
  format?: EvaluationFormat;
  scheduledTime?: string;
  durationMinutes?: number;
  totalPoints?: number;
  description?: string;
  subjectId?: string;
  planId?: string;
  assignmentId?: string;
  programId?: string;
  cohortId?: string;
}): { evaluation: Evaluation | null; error: Error | null } {
  const cleanTitle = params.title.trim();
  if (!cleanTitle) {
    return { evaluation: null, error: new Error('Evaluation title is required.') };
  }
  if (!params.scheduledDate) {
    return { evaluation: null, error: new Error('Scheduled date is required.') };
  }
  if (!params.studentId) {
    return { evaluation: null, error: new Error('Student ID is required.') };
  }

  // Authorization check: mentor must be authorized for student
  const normalizedMentorId = params.mentorId === 'PPM001' ? 'mock-mentor-ppm001' : params.mentorId;
  const isAssigned = isMockAuthorizedMentorForStudent(normalizedMentorId, params.studentId, params.programId);
  if (!isAssigned && params.mentorId !== 'admin' && params.mentorId !== 'mock-admin-ppa001') {
    return { evaluation: null, error: new Error('You are not authorized to schedule evaluations for this student.') };
  }

  // If subjectId is supplied, verify it belongs to this student
  if (params.subjectId) {
    const subject = mockSubjects.find((s) => s.id === params.subjectId && s.student_id === params.studentId);
    if (!subject) {
      return { evaluation: null, error: new Error('Selected study area does not belong to this student.') };
    }
  }

  const now = new Date().toISOString();
  const newEval: Evaluation = {
    id: `mock-eval-${Date.now()}`,
    student_id: params.studentId,
    mentor_id: normalizedMentorId,
    program_id: params.programId || null,
    cohort_id: params.cohortId || null,
    subject_id: params.subjectId || null,
    plan_id: params.planId || null,
    assignment_id: params.assignmentId || null,
    title: cleanTitle,
    description: params.description?.trim() || null,
    format: params.format || 'oral',
    status: 'scheduled',
    scheduled_date: params.scheduledDate,
    scheduled_time: params.scheduledTime || null,
    duration_minutes: params.durationMinutes !== undefined ? params.durationMinutes : 30,
    total_points: params.totalPoints !== undefined ? params.totalPoints : 100,
    score: null,
    feedback: null,
    recommendation: null,
    evaluated_at: null,
    created_at: now,
    updated_at: now,
  };

  mockEvaluations.unshift(newEval);

  createMockNotification({
    recipientId: params.studentId,
    actorId: normalizedMentorId,
    type: 'evaluation_published',
    title: 'Evaluation Scheduled',
    message: `Mentor scheduled evaluation "${cleanTitle}" for ${params.scheduledDate}`,
    link: '/student/evaluations',
    idempotencyKey: `evaluation:${newEval.id}`,
  });

  return { evaluation: { ...newEval }, error: null };
}

export function updateMockEvaluation(
  evaluationId: string,
  mentorId: string,
  updates: {
    title?: string;
    description?: string;
    format?: EvaluationFormat;
    status?: EvaluationStatus;
    scheduledDate?: string;
    scheduledTime?: string;
    durationMinutes?: number;
    totalPoints?: number;
    subjectId?: string;
    planId?: string;
  }
): { evaluation: Evaluation | null; error: Error | null } {
  const index = mockEvaluations.findIndex((e) => e.id === evaluationId);
  if (index === -1) {
    return { evaluation: null, error: new Error('Evaluation not found.') };
  }

  const current = mockEvaluations[index];
  const normalizedMentorId = mentorId === 'PPM001' ? 'mock-mentor-ppm001' : mentorId;
  const assigned = getMockAssignedStudents(normalizedMentorId);
  const isAssigned = assigned.some((s) => s.id === current.student_id || s.poraplan_id === 'PP001');
  if (!isAssigned && mentorId !== 'admin' && mentorId !== 'mock-admin-ppa001') {
    return { evaluation: null, error: new Error('You are not authorized to modify evaluations for this student.') };
  }

  if (updates.title !== undefined) {
    const cleanTitle = updates.title.trim();
    if (!cleanTitle) {
      return { evaluation: null, error: new Error('Evaluation title cannot be empty.') };
    }
    current.title = cleanTitle;
  }
  if (updates.description !== undefined) {
    current.description = updates.description ? updates.description.trim() : null;
  }
  if (updates.format !== undefined) {
    current.format = updates.format;
  }
  if (updates.status !== undefined) {
    current.status = updates.status;
  }
  if (updates.scheduledDate !== undefined) {
    current.scheduled_date = updates.scheduledDate;
  }
  if (updates.scheduledTime !== undefined) {
    current.scheduled_time = updates.scheduledTime;
  }
  if (updates.durationMinutes !== undefined) {
    current.duration_minutes = updates.durationMinutes;
  }
  if (updates.totalPoints !== undefined) {
    current.total_points = updates.totalPoints;
  }
  if (updates.subjectId !== undefined) {
    current.subject_id = updates.subjectId || null;
  }
  if (updates.planId !== undefined) {
    current.plan_id = updates.planId || null;
  }

  current.updated_at = new Date().toISOString();
  mockEvaluations[index] = { ...current };
  return { evaluation: { ...current }, error: null };
}

export function recordMockEvaluationResult(params: {
  evaluationId: string;
  mentorId: string;
  score: number;
  feedback: string;
  recommendation?: string;
  status?: EvaluationStatus;
}): { evaluation: Evaluation | null; error: Error | null } {
  const index = mockEvaluations.findIndex((e) => e.id === params.evaluationId);
  if (index === -1) {
    return { evaluation: null, error: new Error('Evaluation not found.') };
  }

  const current = mockEvaluations[index];
  const normalizedMentorId = params.mentorId === 'PPM001' ? 'mock-mentor-ppm001' : params.mentorId;
  const assigned = getMockAssignedStudents(normalizedMentorId);
  const isAssigned = assigned.some((s) => s.id === current.student_id || s.poraplan_id === 'PP001');
  if (!isAssigned && params.mentorId !== 'admin' && params.mentorId !== 'mock-admin-ppa001') {
    return { evaluation: null, error: new Error('You are not authorized to record results for this student.') };
  }

  const cleanFeedback = params.feedback.trim();
  if (!cleanFeedback) {
    return { evaluation: null, error: new Error('Evaluation feedback notes are required.') };
  }
  if (params.score === undefined || params.score === null || isNaN(params.score)) {
    return { evaluation: null, error: new Error('Valid score is required.') };
  }
  if (params.score < 0 || (current.total_points && params.score > current.total_points)) {
    return {
      evaluation: null,
      error: new Error(`Score must be between 0 and maximum points (${current.total_points || 100}).`),
    };
  }

  const now = new Date().toISOString();
  current.score = params.score;
  current.feedback = cleanFeedback;
  current.recommendation = params.recommendation?.trim() || null;
  current.status = params.status || 'completed';
  current.evaluated_at = now;
  current.updated_at = now;

  mockEvaluations[index] = { ...current };

  createMockNotification({
    recipientId: current.student_id,
    actorId: normalizedMentorId,
    type: 'evaluation_published',
    title: 'Evaluation Result Published',
    message: `Mentor published score ${params.score}/${current.total_points || 100} for "${current.title}"`,
    link: '/student/evaluations',
    idempotencyKey: `evaluation_result:${params.evaluationId}`,
  });

  return { evaluation: { ...current }, error: null };
}

export function deleteMockEvaluation(
  evaluationId: string,
  mentorId: string
): { success: boolean; error: Error | null } {
  const index = mockEvaluations.findIndex((e) => e.id === evaluationId);
  if (index === -1) {
    return { success: false, error: new Error('Evaluation not found.') };
  }

  const current = mockEvaluations[index];
  const normalizedMentorId = mentorId === 'PPM001' ? 'mock-mentor-ppm001' : mentorId;
  const assigned = getMockAssignedStudents(normalizedMentorId);
  const isAssigned = assigned.some((s) => s.id === current.student_id || s.poraplan_id === 'PP001');
  if (!isAssigned && mentorId !== 'admin' && mentorId !== 'mock-admin-ppa001') {
    return { success: false, error: new Error('You are not authorized to delete this evaluation.') };
  }

  mockEvaluations.splice(index, 1);
  return { success: true, error: null };
}

// ==============================================================================
// PROGRESS TRACKING MOCK STORE & AGGREGATIONS (Milestone 13)
// ==============================================================================

export type MockActivityType =
  | 'task_completed'
  | 'task_created'
  | 'assignment_submitted'
  | 'assignment_reviewed'
  | 'evaluation_completed'
  | 'evaluation_scheduled';

export interface MockAcademicActivityItem {
  id: string;
  type: MockActivityType;
  title: string;
  timestamp: string;
  subjectName?: string;
  details?: string;
  statusBadge?: {
    label: string;
    variant: 'teal' | 'gold' | 'navy' | 'paper' | 'muted';
  };
}

export interface MockSubjectProgressItem {
  subjectId: string;
  subjectName: string;
  subjectCode?: string | null;
  status: 'active' | 'archived';
  tasks: {
    total: number;
    completed: number;
    completionRate: number;
  };
  assignments: {
    total: number;
    submitted: number;
    reviewed: number;
  };
  evaluations: {
    total: number;
    completed: number;
    averageScorePercentage: number | null;
  };
  studyPlansCount: number;
}

export interface MockStudentProgressSummary {
  studentId: string;
  studentName?: string;
  poraplanId?: string;
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    completionRate: number;
  };
  assignments: {
    totalAssigned: number;
    submitted: number;
    unsubmitted: number;
    pendingReview: number;
    reviewed: number;
    submissionRate: number;
    averageScorePercentage: number | null;
  };
  evaluations: {
    total: number;
    completed: number;
    scheduled: number;
    inProgress: number;
    cancelled: number;
    completionRate: number;
    averageScorePercentage: number | null;
  };
  studyPlans: {
    totalPlans: number;
    activePlans: number;
    completedPlans: number;
    totalItems: number;
    completedItems: number;
    itemCompletionRate: number;
  };
  subjectsProgress: MockSubjectProgressItem[];
  recentActivity: MockAcademicActivityItem[];
}

export interface MockScholarProgressOverview {
  studentId: string;
  studentName: string;
  poraplanId: string;
  studentEmail?: string;
  tasks: {
    total: number;
    completed: number;
    completionRate: number;
  };
  assignments: {
    totalAssigned: number;
    submitted: number;
    pendingReview: number;
  };
  evaluations: {
    total: number;
    completed: number;
    scheduled: number;
  };
  studyPlansCount: number;
  subjectsCount: number;
  lastActiveTimestamp?: string | null;
}

export function getMockStudentAcademicProgress(studentId: string): MockStudentProgressSummary {
  const normalizedStudentId = studentId === 'PP001' ? 'mock-student-pp001' : studentId;
  const student = mockStore.find((u) => u.id === normalizedStudentId || u.poraplanId === studentId);

  const studentTasks = mockTasks.filter(
    (t) => t.student_id === normalizedStudentId || t.student_id === studentId
  );
  const studentAssignments = mockAssignments.filter(
    (a) => a.student_id === normalizedStudentId || a.student_id === studentId
  );
  const studentSubmissions = mockSubmissions.filter(
    (s) => s.student_id === normalizedStudentId || s.student_id === studentId
  );
  const studentEvaluations = mockEvaluations.filter(
    (e) => e.student_id === normalizedStudentId || e.student_id === studentId
  );
  const studentSubjects = mockSubjects.filter(
    (s) => s.student_id === normalizedStudentId || s.student_id === studentId
  );
  const studentPlans = mockStudyPlans.filter(
    (p) => p.student_id === normalizedStudentId || p.student_id === studentId
  );

  // 1. Task metrics
  const totalTasks = studentTasks.length;
  const completedTasks = studentTasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = studentTasks.filter((t) => t.status === 'in_progress').length;
  const pendingTasks = studentTasks.filter((t) => t.status === 'pending').length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // 2. Assignment & Practice metrics
  const totalAssigned = studentAssignments.length;
  const submittedCount = studentSubmissions.length;
  const unsubmittedCount = Math.max(0, totalAssigned - submittedCount);
  const pendingReviewCount = studentSubmissions.filter(
    (s) => s.status === 'submitted' || s.status === 'under_review'
  ).length;
  const reviewedCount = studentSubmissions.filter(
    (s) => s.status === 'reviewed' || s.status === 'needs_revision'
  ).length;
  const submissionRate = totalAssigned > 0 ? Math.round((submittedCount / totalAssigned) * 100) : 0;

  const gradedSubmissions = studentSubmissions.filter((s) => {
    const parentAssignment = studentAssignments.find((a) => a.id === s.assignment_id);
    const maxPts = parentAssignment?.total_points;
    return (
      (s.status === 'reviewed' || s.status === 'needs_revision') &&
      s.score !== null &&
      s.score !== undefined &&
      typeof maxPts === 'number' &&
      maxPts > 0
    );
  });

  let averageAssignmentScore: number | null = null;
  if (gradedSubmissions.length > 0) {
    const sumPct = gradedSubmissions.reduce((acc, s) => {
      const parentAssignment = studentAssignments.find((a) => a.id === s.assignment_id);
      const maxPts = Number(parentAssignment?.total_points || 100);
      return acc + (Number(s.score) / maxPts) * 100;
    }, 0);
    averageAssignmentScore = Math.round((sumPct / gradedSubmissions.length) * 10) / 10;
  }

  // 3. Milestone Evaluations metrics
  const totalEvaluations = studentEvaluations.length;
  const completedEvaluations = studentEvaluations.filter((e) => e.status === 'completed').length;
  const scheduledEvaluations = studentEvaluations.filter((e) => e.status === 'scheduled').length;
  const inProgressEvaluations = studentEvaluations.filter((e) => e.status === 'in_progress').length;
  const cancelledEvaluations = studentEvaluations.filter((e) => e.status === 'cancelled').length;
  const nonCancelledEvals = totalEvaluations - cancelledEvaluations;
  const evaluationCompletionRate =
    nonCancelledEvals > 0 ? Math.round((completedEvaluations / nonCancelledEvals) * 100) : 0;

  const gradedEvaluations = studentEvaluations.filter(
    (e) =>
      e.status === 'completed' &&
      e.score !== null &&
      e.score !== undefined &&
      e.total_points &&
      Number(e.total_points) > 0
  );
  let averageEvaluationScore: number | null = null;
  if (gradedEvaluations.length > 0) {
    const sumEvalPct = gradedEvaluations.reduce((acc, e) => {
      const maxPts = Number(e.total_points || 100);
      return acc + (Number(e.score) / maxPts) * 100;
    }, 0);
    averageEvaluationScore = Math.round((sumEvalPct / gradedEvaluations.length) * 10) / 10;
  }

  // 4. Study Plans & Syllabus items
  const totalPlans = studentPlans.length;
  const activePlans = studentPlans.filter((p) => p.status === 'active').length;
  const completedPlans = studentPlans.filter((p) => p.status === 'completed').length;

  const studentPlanIds = new Set(studentPlans.map((p) => p.id));
  const planItems = mockStudyPlanItems.filter((item) => studentPlanIds.has(item.plan_id));
  const totalPlanItems = planItems.length;
  const completedPlanItems = planItems.filter((item) => item.status === 'completed').length;
  const itemCompletionRate =
    totalPlanItems > 0 ? Math.round((completedPlanItems / totalPlanItems) * 100) : 0;

  // 5. Subject-wise breakdown
  const subjectsProgress: MockSubjectProgressItem[] = studentSubjects.map((subj) => {
    const subjTasks = studentTasks.filter((t) => t.subject_id === subj.id);
    const subjCompletedTasks = subjTasks.filter((t) => t.status === 'completed').length;
    const subjTaskRate =
      subjTasks.length > 0 ? Math.round((subjCompletedTasks / subjTasks.length) * 100) : 0;

    const subjAssignments = studentAssignments.filter((a) => a.subject_id === subj.id);
    const subjSubmissions = studentSubmissions.filter((s) => {
      const parentAssign = studentAssignments.find((a) => a.id === s.assignment_id);
      return parentAssign?.subject_id === subj.id;
    });
    const subjReviewedSubmissions = subjSubmissions.filter(
      (s) => s.status === 'reviewed' || s.status === 'needs_revision'
    ).length;

    const subjEvaluations = studentEvaluations.filter((e) => e.subject_id === subj.id);
    const subjCompletedEvals = subjEvaluations.filter((e) => e.status === 'completed');
    const subjGradedEvals = subjCompletedEvals.filter(
      (e) =>
        e.score !== null &&
        e.score !== undefined &&
        e.total_points &&
        Number(e.total_points) > 0
    );
    let subjAvgScore: number | null = null;
    if (subjGradedEvals.length > 0) {
      const sumPct = subjGradedEvals.reduce(
        (acc, e) => acc + (Number(e.score) / Number(e.total_points)) * 100,
        0
      );
      subjAvgScore = Math.round((sumPct / subjGradedEvals.length) * 10) / 10;
    }

    const subjPlans = studentPlans.filter((p) => p.subject_id === subj.id);

    return {
      subjectId: subj.id,
      subjectName: subj.name,
      subjectCode: subj.code,
      status: subj.status,
      tasks: {
        total: subjTasks.length,
        completed: subjCompletedTasks,
        completionRate: subjTaskRate,
      },
      assignments: {
        total: subjAssignments.length,
        submitted: subjSubmissions.length,
        reviewed: subjReviewedSubmissions,
      },
      evaluations: {
        total: subjEvaluations.length,
        completed: subjCompletedEvals.length,
        averageScorePercentage: subjAvgScore,
      },
      studyPlansCount: subjPlans.length,
    };
  });

  // 6. Chronological Recent Activity
  const activityList: MockAcademicActivityItem[] = [];

  studentTasks.forEach((t) => {
    const subj = studentSubjects.find((s) => s.id === t.subject_id);
    if (t.completed_at) {
      activityList.push({
        id: `act-task-comp-${t.id}`,
        type: 'task_completed',
        title: `Completed Study Task: ${t.title}`,
        timestamp: t.completed_at,
        subjectName: subj?.name,
        details: 'Task marked completed by scholar.',
        statusBadge: { label: 'Task Done', variant: 'teal' },
      });
    } else if (t.created_at) {
      activityList.push({
        id: `act-task-creat-${t.id}`,
        type: 'task_created',
        title: `Assigned Study Task: ${t.title}`,
        timestamp: t.created_at,
        subjectName: subj?.name,
        details: `Priority: ${t.priority.toUpperCase()}`,
        statusBadge: { label: 'Task Active', variant: 'paper' },
      });
    }
  });

  studentSubmissions.forEach((s) => {
    const parent = studentAssignments.find((a) => a.id === s.assignment_id);
    const title = parent?.title || 'Practice Set';
    const subj = studentSubjects.find((sub) => sub.id === parent?.subject_id);

    if (s.reviewed_at) {
      const scoreStr = s.score !== null ? `Score: ${s.score} pts.` : '';
      activityList.push({
        id: `act-subm-rev-${s.id}`,
        type: 'assignment_reviewed',
        title: `Mentor Feedback Received: ${title}`,
        timestamp: s.reviewed_at,
        subjectName: subj?.name,
        details: s.feedback ? `${s.feedback} ${scoreStr}`.trim() : scoreStr,
        statusBadge: {
          label: s.status === 'needs_revision' ? 'Revision Needed' : 'Reviewed',
          variant: s.status === 'needs_revision' ? 'gold' : 'teal',
        },
      });
    } else if (s.submitted_at) {
      activityList.push({
        id: `act-subm-sub-${s.id}`,
        type: 'assignment_submitted',
        title: `Submitted Practice Solution: ${title}`,
        timestamp: s.submitted_at,
        subjectName: subj?.name,
        details: `Type: ${s.submission_type.toUpperCase()}`,
        statusBadge: { label: 'Submitted', variant: 'navy' },
      });
    }
  });

  studentEvaluations.forEach((e) => {
    const subj = studentSubjects.find((s) => s.id === e.subject_id);
    if (e.evaluated_at && e.status === 'completed') {
      const scoreStr = e.score !== null ? `Result: ${e.score} / ${e.total_points ?? 100}` : '';
      activityList.push({
        id: `act-eval-comp-${e.id}`,
        type: 'evaluation_completed',
        title: `Milestone Assessment Completed: ${e.title}`,
        timestamp: e.evaluated_at,
        subjectName: subj?.name,
        details: e.feedback ? `${e.feedback} ${scoreStr}`.trim() : scoreStr,
        statusBadge: { label: 'Graded', variant: 'teal' },
      });
    } else if (e.created_at) {
      activityList.push({
        id: `act-eval-sched-${e.id}`,
        type: 'evaluation_scheduled',
        title: `Milestone Assessment Scheduled: ${e.title}`,
        timestamp: e.created_at,
        subjectName: subj?.name,
        details: `Format: ${e.format.toUpperCase()} · Scheduled for ${e.scheduled_date}`,
        statusBadge: { label: 'Scheduled', variant: 'gold' },
      });
    }
  });

  activityList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    studentId: normalizedStudentId,
    studentName: student?.fullName,
    poraplanId: student?.poraplanId,
    tasks: {
      total: totalTasks,
      completed: completedTasks,
      inProgress: inProgressTasks,
      pending: pendingTasks,
      completionRate: taskCompletionRate,
    },
    assignments: {
      totalAssigned,
      submitted: submittedCount,
      unsubmitted: unsubmittedCount,
      pendingReview: pendingReviewCount,
      reviewed: reviewedCount,
      submissionRate,
      averageScorePercentage: averageAssignmentScore,
    },
    evaluations: {
      total: totalEvaluations,
      completed: completedEvaluations,
      scheduled: scheduledEvaluations,
      inProgress: inProgressEvaluations,
      cancelled: cancelledEvaluations,
      completionRate: evaluationCompletionRate,
      averageScorePercentage: averageEvaluationScore,
    },
    studyPlans: {
      totalPlans,
      activePlans,
      completedPlans,
      totalItems: totalPlanItems,
      completedItems: completedPlanItems,
      itemCompletionRate,
    },
    subjectsProgress,
    recentActivity: activityList.slice(0, 15),
  };
}

export function getMockMentorScholarsProgress(mentorId: string): MockScholarProgressOverview[] {
  const normalizedMentorId = mentorId === 'PPM001' ? 'mock-mentor-ppm001' : mentorId;
  const assignedStudents = getMockAssignedStudents(normalizedMentorId);

  return assignedStudents.map((student) => {
    const progress = getMockStudentAcademicProgress(student.id);
    const lastActivity =
      progress.recentActivity.length > 0 ? progress.recentActivity[0].timestamp : null;

    return {
      studentId: student.id,
      studentName: student.full_name,
      poraplanId: student.poraplan_id || 'PP001',
      studentEmail: student.email,
      tasks: {
        total: progress.tasks.total,
        completed: progress.tasks.completed,
        completionRate: progress.tasks.completionRate,
      },
      assignments: {
        totalAssigned: progress.assignments.totalAssigned,
        submitted: progress.assignments.submitted,
        pendingReview: progress.assignments.pendingReview,
      },
      evaluations: {
        total: progress.evaluations.total,
        completed: progress.evaluations.completed,
        scheduled: progress.evaluations.scheduled,
      },
      studyPlansCount: progress.studyPlans.totalPlans,
      subjectsCount: progress.subjectsProgress.length,
      lastActiveTimestamp: lastActivity,
    };
  });
}

export function getMockScholarProgressDetail(
  mentorId: string,
  studentId: string
): { summary: MockStudentProgressSummary | null; error: Error | null } {
  const normalizedMentorId = mentorId === 'PPM001' ? 'mock-mentor-ppm001' : mentorId;
  const assignedStudents = getMockAssignedStudents(normalizedMentorId);
  const isAssigned = assignedStudents.some(
    (s) => s.id === studentId || s.poraplan_id === studentId || studentId === 'mock-student-pp001'
  );

  if (!isAssigned && mentorId !== 'admin' && mentorId !== 'mock-admin-ppa001') {
    return { summary: null, error: new Error('You are not authorized to view progress for this student.') };
  }

  const summary = getMockStudentAcademicProgress(studentId);
  return { summary, error: null };
}

// ==============================================================================
// ACADEMIC RESOURCES MOCK STORE & CRUD METHODS (Milestone 14)
// ==============================================================================

export interface EnrichedMockResource extends Resource {
  student_name?: string;
  student_poraplan_id?: string;
  mentor_name?: string;
  subject_name?: string;
  plan_title?: string;
}

export const mockResources: Resource[] = [
  {
    id: 'mock-res-001',
    student_id: 'mock-student-pp001',
    mentor_id: 'mock-mentor-ppm001',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    subject_id: 'mock-sub-phy-101',
    plan_id: 'mock-plan-phy-001',
    title: 'Halliday & Resnick Mechanics Formula Sheet & Vector Summary',
    description: 'Core formulas for 1D/2D kinematics, Newton second law applications, inclined planes with friction, and Atwood machines.',
    resource_type: 'link',
    url: 'https://ocw.mit.edu/courses/physics-i-classical-mechanics/resources/formula-sheet.pdf',
    file_name: 'Mechanics_CheatSheet_v2.pdf',
    file_size: 154820,
    content: null,
    status: 'active',
    created_at: '2026-10-06T10:00:00Z',
    updated_at: '2026-10-06T10:00:00Z',
  },
  {
    id: 'mock-res-002',
    student_id: 'mock-student-pp001',
    mentor_id: 'mock-mentor-ppm001',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    subject_id: 'mock-sub-math-102',
    plan_id: null,
    title: 'Differential Calculus: Critical Point Analysis & Derivative Rules',
    description: 'Quick reference notes on chain rule, quotient rule, product rule, and second derivative concavity test.',
    resource_type: 'note',
    url: null,
    file_name: null,
    file_size: null,
    content: '1. Product Rule: (fg)\' = f\'g + fg\'\n2. Quotient Rule: (f/g)\' = (f\'g - fg\') / g²\n3. Chain Rule: (f ∘ g)\' = f\'(g(x)) · g\'(x)\n4. Concavity: f\'\'(x) > 0 => Concave Up (Local Min); f\'\'(x) < 0 => Concave Down (Local Max)',
    status: 'active',
    created_at: '2026-10-08T14:30:00Z',
    updated_at: '2026-10-08T14:30:00Z',
  },
];

export function getMockStudentResources(studentId: string): EnrichedMockResource[] {
  const normalizedId = studentId === 'PP001' ? 'mock-student-pp001' : studentId;
  return mockResources
    .filter((r) => r.student_id === normalizedId || r.student_id === studentId)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .map((res) => {
      const subject = res.subject_id ? mockSubjects.find((s) => s.id === res.subject_id) : null;
      const plan = res.plan_id ? mockStudyPlans.find((p) => p.id === res.plan_id) : null;
      const mentor = res.mentor_id ? mockStore.find((m) => m.id === res.mentor_id) : null;

      return {
        ...res,
        subject_name: subject?.name,
        plan_title: plan?.title,
        mentor_name: mentor?.fullName,
      };
    });
}

export function getMockMentorResources(mentorId: string): EnrichedMockResource[] {
  const normalizedMentorId = mentorId === 'PPM001' ? 'mock-mentor-ppm001' : mentorId;

  return mockResources
    .filter((r) => isMockAuthorizedMentorForStudent(normalizedMentorId, r.student_id, r.program_id))
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .map((res) => {
      const student = mockStore.find((s) => s.id === res.student_id);
      const subject = res.subject_id ? mockSubjects.find((s) => s.id === res.subject_id) : null;
      const plan = res.plan_id ? mockStudyPlans.find((p) => p.id === res.plan_id) : null;

      return {
        ...res,
        student_name: student?.fullName || 'Scholar',
        student_poraplan_id: student?.poraplanId || 'PP001',
        subject_name: subject?.name,
        plan_title: plan?.title,
      };
    });
}

export function getMockResourceById(resourceId: string): EnrichedMockResource | null {
  const resource = mockResources.find((r) => r.id === resourceId);
  if (!resource) return null;

  const student = mockStore.find((s) => s.id === resource.student_id);
  const subject = resource.subject_id ? mockSubjects.find((s) => s.id === resource.subject_id) : null;
  const plan = resource.plan_id ? mockStudyPlans.find((p) => p.id === resource.plan_id) : null;
  const mentor = resource.mentor_id ? mockStore.find((m) => m.id === resource.mentor_id) : null;

  return {
    ...resource,
    student_name: student?.fullName,
    student_poraplan_id: student?.poraplanId,
    subject_name: subject?.name,
    plan_title: plan?.title,
    mentor_name: mentor?.fullName,
  };
}

export function createMockResource(params: {
  studentId: string;
  mentorId?: string;
  subjectId?: string;
  planId?: string;
  title: string;
  description?: string;
  resourceType: ResourceType;
  url?: string;
  fileName?: string;
  fileSize?: number;
  content?: string;
  status?: ResourceStatus;
  programId?: string;
  cohortId?: string;
}): { resource: Resource | null; error: Error | null } {
  const cleanTitle = params.title?.trim();
  if (!cleanTitle) {
    return { resource: null, error: new Error('Resource title is required.') };
  }
  if (!params.studentId) {
    return { resource: null, error: new Error('Student ID is required.') };
  }

  const normalizedStudentId = params.studentId === 'PP001' ? 'mock-student-pp001' : params.studentId;

  // Validate mentor authorization
  if (params.mentorId && params.mentorId !== 'admin' && params.mentorId !== 'mock-admin-ppa001') {
    const normalizedMentorId = params.mentorId === 'PPM001' ? 'mock-mentor-ppm001' : params.mentorId;
    const isAssigned = isMockAuthorizedMentorForStudent(normalizedMentorId, normalizedStudentId, params.programId);
    if (!isAssigned) {
      return { resource: null, error: new Error('You are not authorized to create resources for this student.') };
    }
  }

  // Validate URL protocol if link
  if (params.resourceType === 'link' && params.url) {
    const cleanUrl = params.url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return { resource: null, error: new Error('Resource URL must start with http:// or https://') };
    }
  }

  // Validate subject ownership if provided
  if (params.subjectId) {
    const subject = mockSubjects.find((s) => s.id === params.subjectId);
    if (!subject || (subject.student_id !== normalizedStudentId && subject.student_id !== params.studentId)) {
      return { resource: null, error: new Error('Selected study area does not belong to this student.') };
    }
  }

  const resourceId = `mock-res-${Date.now()}`;
  const now = new Date().toISOString();

  const newResource: Resource = {
    id: resourceId,
    student_id: normalizedStudentId,
    mentor_id: params.mentorId || null,
    program_id: params.programId || null,
    cohort_id: params.cohortId || null,
    subject_id: params.subjectId || null,
    plan_id: params.planId || null,
    title: cleanTitle,
    description: params.description?.trim() || null,
    resource_type: params.resourceType || 'link',
    url: params.url?.trim() || null,
    file_name: params.fileName?.trim() || null,
    file_size: params.fileSize !== undefined ? params.fileSize : null,
    content: params.content?.trim() || null,
    status: params.status || 'active',
    created_at: now,
    updated_at: now,
  };

  mockResources.push(newResource);

  createMockNotification({
    recipientId: normalizedStudentId,
    actorId: params.mentorId || null,
    type: 'resource_published',
    title: 'New Resource Added',
    message: `Mentor added a new learning resource: "${cleanTitle}"`,
    link: '/student/resources',
    idempotencyKey: `resource:${resourceId}`,
  });

  return { resource: { ...newResource }, error: null };
}

export function updateMockResource(
  resourceId: string,
  mentorId: string,
  updates: Partial<Pick<Resource, 'title' | 'description' | 'subject_id' | 'plan_id' | 'resource_type' | 'url' | 'file_name' | 'file_size' | 'content' | 'status'>>
): { resource: Resource | null; error: Error | null } {
  const index = mockResources.findIndex((r) => r.id === resourceId);
  if (index === -1) {
    return { resource: null, error: new Error('Resource not found.') };
  }

  const current = mockResources[index];
  const normalizedMentorId = mentorId === 'PPM001' ? 'mock-mentor-ppm001' : mentorId;
  const assignedStudents = getMockAssignedStudents(normalizedMentorId);
  const isAssigned = assignedStudents.some((s) => s.id === current.student_id || s.poraplan_id === 'PP001');

  if (!isAssigned && mentorId !== 'admin' && mentorId !== 'mock-admin-ppa001' && current.mentor_id !== normalizedMentorId) {
    return { resource: null, error: new Error('You are not authorized to update this resource.') };
  }

  if (updates.title !== undefined) {
    const cleanTitle = updates.title.trim();
    if (!cleanTitle) {
      return { resource: null, error: new Error('Resource title cannot be empty.') };
    }
    current.title = cleanTitle;
  }

  if (updates.description !== undefined) {
    current.description = updates.description?.trim() || null;
  }
  if (updates.subject_id !== undefined) {
    current.subject_id = updates.subject_id || null;
  }
  if (updates.plan_id !== undefined) {
    current.plan_id = updates.plan_id || null;
  }
  if (updates.resource_type !== undefined) {
    current.resource_type = updates.resource_type;
  }
  if (updates.url !== undefined) {
    if (updates.url) {
      const cleanUrl = updates.url.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        return { resource: null, error: new Error('Resource URL must start with http:// or https://') };
      }
      current.url = cleanUrl;
    } else {
      current.url = null;
    }
  }
  if (updates.file_name !== undefined) {
    current.file_name = updates.file_name || null;
  }
  if (updates.file_size !== undefined) {
    current.file_size = updates.file_size;
  }
  if (updates.content !== undefined) {
    current.content = updates.content || null;
  }
  if (updates.status !== undefined) {
    current.status = updates.status;
  }

  current.updated_at = new Date().toISOString();
  mockResources[index] = { ...current };

  return { resource: { ...current }, error: null };
}

export function deleteMockResource(
  resourceId: string,
  mentorId: string
): { success: boolean; error: Error | null } {
  const index = mockResources.findIndex((r) => r.id === resourceId);
  if (index === -1) {
    return { success: false, error: new Error('Resource not found.') };
  }

  const current = mockResources[index];
  const normalizedMentorId = mentorId === 'PPM001' ? 'mock-mentor-ppm001' : mentorId;
  const assignedStudents = getMockAssignedStudents(normalizedMentorId);
  const isAssigned = assignedStudents.some((s) => s.id === current.student_id || s.poraplan_id === 'PP001');

  if (!isAssigned && mentorId !== 'admin' && mentorId !== 'mock-admin-ppa001' && current.mentor_id !== normalizedMentorId) {
    return { success: false, error: new Error('You are not authorized to delete this resource.') };
  }

  mockResources.splice(index, 1);
  return { success: true, error: null };
}

// ==============================================================================
// DOUBTS & ACADEMIC INQUIRIES MOCK DATA & REPOSITORY
// ==============================================================================

export interface EnrichedMockDoubtResponse extends DoubtResponse {
  author_name?: string;
  author_role?: UserRole;
  author_poraplan_id?: string;
}

export interface EnrichedMockDoubt extends Doubt {
  student_name?: string;
  student_poraplan_id?: string;
  mentor_name?: string;
  subject_name?: string;
  subject_code?: string;
  plan_title?: string;
  task_title?: string;
  assignment_title?: string;
  responses?: EnrichedMockDoubtResponse[];
  responses_count?: number;
  latest_response?: EnrichedMockDoubtResponse;
}

export const mockDoubts: Doubt[] = [
  {
    id: 'mock-doubt-001',
    student_id: 'mock-student-pp001',
    mentor_id: 'mock-mentor-ppm001',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    subject_id: 'mock-sub-phy-101',
    plan_id: 'mock-plan-phy-001',
    task_id: 'mock-task-002',
    assignment_id: 'mock-assign-001',
    title: 'Normal force and friction on a double-incline Atwood setup',
    question: 'When both masses are on different inclines connected by a massless rope over a frictionless pulley, does the normal force of mass 1 affect the tension equation directly or only through the friction term mu * N1?',
    priority: 'high',
    status: 'answered',
    resolved_at: null,
    created_at: '2026-10-12T09:30:00Z',
    updated_at: '2026-10-12T11:15:00Z',
  },
  {
    id: 'mock-doubt-002',
    student_id: 'mock-student-pp001',
    mentor_id: 'mock-mentor-ppm001',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    subject_id: 'mock-sub-math-102',
    plan_id: null,
    task_id: null,
    assignment_id: null,
    title: 'Concavity inflection points when second derivative equals zero vs undefined',
    question: 'If f\'\'(x) = 0 but does not change sign around c, is x = c still considered an inflection point, or must there always be a sign alternation?',
    priority: 'normal',
    status: 'open',
    resolved_at: null,
    created_at: '2026-10-15T14:00:00Z',
    updated_at: '2026-10-15T14:00:00Z',
  },
];

export const mockDoubtResponses: DoubtResponse[] = [
  {
    id: 'mock-resp-001',
    doubt_id: 'mock-doubt-001',
    author_id: 'mock-mentor-ppm001',
    message: 'Great question. The normal force N1 = m1*g*cos(theta1) acts perpendicular to the incline surface, so it does not appear directly in the parallel equation of motion. It only couples into the system acceleration via kinetic friction fk = mu_k * N1. Keep your coordinate axes rotated along each incline surface.',
    created_at: '2026-10-12T11:15:00Z',
  },
];

function enrichMockDoubt(d: Doubt): EnrichedMockDoubt {
  const student = mockStore.find((s) => s.id === d.student_id);
  const mentor = d.mentor_id ? mockStore.find((m) => m.id === d.mentor_id) : null;
  const subject = d.subject_id ? mockSubjects.find((s) => s.id === d.subject_id) : null;
  const plan = d.plan_id ? mockStudyPlans.find((p) => p.id === d.plan_id) : null;
  const task = d.task_id ? mockTasks.find((t) => t.id === d.task_id) : null;
  const assignment = d.assignment_id ? mockAssignments.find((a) => a.id === d.assignment_id) : null;

  const responses = mockDoubtResponses
    .filter((r) => r.doubt_id === d.id)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
    .map((r) => {
      const author = mockStore.find((u) => u.id === r.author_id);
      return {
        ...r,
        author_name: author?.fullName || 'User',
        author_role: author?.role,
        author_poraplan_id: author?.poraplanId,
      };
    });

  const latest_response = responses.length > 0 ? responses[responses.length - 1] : undefined;

  return {
    ...d,
    student_name: student?.fullName || 'Scholar',
    student_poraplan_id: student?.poraplanId || 'PP001',
    mentor_name: mentor?.fullName || undefined,
    subject_name: subject?.name || undefined,
    subject_code: subject?.code || undefined,
    plan_title: plan?.title || undefined,
    task_title: task?.title || undefined,
    assignment_title: assignment?.title || undefined,
    responses,
    responses_count: responses.length,
    latest_response,
  };
}

export function getMockStudentDoubts(studentId: string): EnrichedMockDoubt[] {
  const normalizedId = studentId === 'PP001' ? 'mock-student-pp001' : studentId;
  return mockDoubts
    .filter((d) => d.student_id === normalizedId || d.student_id === studentId)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .map(enrichMockDoubt);
}

export function getMockMentorDoubts(mentorId: string): EnrichedMockDoubt[] {
  const normalizedMentorId = mentorId === 'PPM001' ? 'mock-mentor-ppm001' : mentorId;

  return mockDoubts
    .filter((d) => isMockAuthorizedMentorForStudent(normalizedMentorId, d.student_id, d.program_id))
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .map(enrichMockDoubt);
}

export function getMockDoubtById(doubtId: string): EnrichedMockDoubt | null {
  const doubt = mockDoubts.find((d) => d.id === doubtId);
  if (!doubt) return null;
  return enrichMockDoubt(doubt);
}

export function createMockDoubt(params: {
  studentId: string;
  title: string;
  question: string;
  subjectId?: string;
  planId?: string;
  taskId?: string;
  assignmentId?: string;
  priority?: DoubtPriority;
  programId?: string;
  cohortId?: string;
  attachmentPath?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
}): { doubt: Doubt | null; error: Error | null } {
  const cleanTitle = params.title?.trim();
  if (!cleanTitle) {
    return { doubt: null, error: new Error('Doubt title is required.') };
  }
  const cleanQuestion = params.question?.trim();
  if (!cleanQuestion) {
    return { doubt: null, error: new Error('Doubt inquiry question is required.') };
  }
  if (!params.studentId) {
    return { doubt: null, error: new Error('Student ID is required.') };
  }

  const normalizedStudentId = params.studentId === 'PP001' ? 'mock-student-pp001' : params.studentId;

  // Validate subject ownership if supplied
  if (params.subjectId) {
    const subject = mockSubjects.find((s) => s.id === params.subjectId);
    if (!subject || (subject.student_id !== normalizedStudentId && subject.student_id !== params.studentId)) {
      return { doubt: null, error: new Error('Selected study area does not belong to this student.') };
    }
  }

  // Find effective assigned mentor for student (and program if supplied)
  const effectiveMentor = getMockEffectiveMentorForStudent(normalizedStudentId, params.programId);
  const mentorId = effectiveMentor.mentor ? effectiveMentor.mentor.id : null;

  const doubtId = `mock-doubt-${Date.now()}`;
  const now = new Date().toISOString();

  const newDoubt: Doubt = {
    id: doubtId,
    student_id: normalizedStudentId,
    mentor_id: mentorId,
    program_id: params.programId || null,
    cohort_id: params.cohortId || null,
    subject_id: params.subjectId || null,
    plan_id: params.planId || null,
    task_id: params.taskId || null,
    assignment_id: params.assignmentId || null,
    title: cleanTitle,
    question: cleanQuestion,
    priority: params.priority || 'normal',
    status: 'open',
    attachment_path: params.attachmentPath || null,
    attachment_name: params.attachmentName || null,
    attachment_size: params.attachmentSize || null,
    resolved_at: null,
    created_at: now,
    updated_at: now,
  };

  mockDoubts.unshift(newDoubt);
  return { doubt: { ...newDoubt }, error: null };
}

export function addMockDoubtResponse(params: {
  doubtId: string;
  authorId: string;
  message: string;
  attachmentPath?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
}): { response: DoubtResponse | null; error: Error | null } {
  const cleanMessage = params.message?.trim();
  if (!cleanMessage) {
    return { response: null, error: new Error('Response message cannot be empty.') };
  }

  const doubtIndex = mockDoubts.findIndex((d) => d.id === params.doubtId);
  if (doubtIndex === -1) {
    return { response: null, error: new Error('Doubt not found.') };
  }

  const doubt = mockDoubts[doubtIndex];
  const normalizedAuthorId = params.authorId === 'PPM001' ? 'mock-mentor-ppm001' : params.authorId === 'PP001' ? 'mock-student-pp001' : params.authorId;

  // Authorization check: must be student owner, assigned mentor, or admin
  const isStudentOwner = doubt.student_id === normalizedAuthorId || doubt.student_id === params.authorId;
  const isAssignedMentor = getMockAssignedStudents(normalizedAuthorId).some(
    (s) => s.id === doubt.student_id || s.poraplan_id === 'PP001'
  ) || normalizedAuthorId === 'mock-mentor-ppm001' && doubt.student_id === 'mock-student-pp001';
  const isAdmin = normalizedAuthorId === 'admin' || normalizedAuthorId === 'mock-admin-ppa001';

  if (!isStudentOwner && !isAssignedMentor && !isAdmin) {
    return { response: null, error: new Error('You are not authorized to respond to this doubt.') };
  }

  const responseId = `mock-resp-${Date.now()}`;
  const now = new Date().toISOString();

  const newResponse: DoubtResponse = {
    id: responseId,
    doubt_id: doubt.id,
    author_id: normalizedAuthorId,
    message: cleanMessage,
    attachment_path: params.attachmentPath || null,
    attachment_name: params.attachmentName || null,
    attachment_size: params.attachmentSize || null,
    created_at: now,
  };

  mockDoubtResponses.push(newResponse);

  // Auto transition to answered if mentor/admin responded and doubt was open
  if ((isAssignedMentor || isAdmin) && doubt.status === 'open') {
    doubt.status = 'answered';
  }
  doubt.updated_at = now;
  mockDoubts[doubtIndex] = { ...doubt };

  if (isAssignedMentor || isAdmin) {
    const authorUser = mockStore.find((u) => u.id === normalizedAuthorId);
    createMockNotification({
      recipientId: doubt.student_id,
      actorId: normalizedAuthorId,
      type: 'doubt_replied',
      title: 'Mentor Replied to Your Doubt',
      message: `${authorUser?.fullName || 'Mentor'} replied to "${doubt.title}"`,
      link: '/student/doubts',
      idempotencyKey: `doubt_reply:${responseId}`,
    });
  }

  return { response: { ...newResponse }, error: null };
}

export function updateMockDoubtStatus(
  doubtId: string,
  userId: string,
  status: DoubtStatus
): { doubt: Doubt | null; error: Error | null } {
  const doubtIndex = mockDoubts.findIndex((d) => d.id === doubtId);
  if (doubtIndex === -1) {
    return { doubt: null, error: new Error('Doubt not found.') };
  }

  const doubt = mockDoubts[doubtIndex];
  const normalizedUserId = userId === 'PPM001' ? 'mock-mentor-ppm001' : userId === 'PP001' ? 'mock-student-pp001' : userId;

  const isStudentOwner = doubt.student_id === normalizedUserId || doubt.student_id === userId;
  const isAssignedMentor = getMockAssignedStudents(normalizedUserId).some(
    (s) => s.id === doubt.student_id || s.poraplan_id === 'PP001'
  ) || normalizedUserId === 'mock-mentor-ppm001' && doubt.student_id === 'mock-student-pp001';
  const isAdmin = normalizedUserId === 'admin' || normalizedUserId === 'mock-admin-ppa001';

  if (!isStudentOwner && !isAssignedMentor && !isAdmin) {
    return { doubt: null, error: new Error('You are not authorized to update this doubt.') };
  }

  const now = new Date().toISOString();
  doubt.status = status;
  if (status === 'resolved') {
    doubt.resolved_at = now;
  } else {
    doubt.resolved_at = null;
  }
  doubt.updated_at = now;
  mockDoubts[doubtIndex] = { ...doubt };

  return { doubt: { ...doubt }, error: null };
}

export function deleteMockDoubt(
  doubtId: string,
  userId: string
): { success: boolean; error: Error | null } {
  const doubtIndex = mockDoubts.findIndex((d) => d.id === doubtId);
  if (doubtIndex === -1) {
    return { success: false, error: new Error('Doubt not found.') };
  }

  const doubt = mockDoubts[doubtIndex];
  const normalizedUserId = userId === 'PP001' ? 'mock-student-pp001' : userId;
  const isStudentOwner = doubt.student_id === normalizedUserId || doubt.student_id === userId;
  const isAdmin = userId === 'admin' || userId === 'mock-admin-ppa001';

  if (!isStudentOwner && !isAdmin) {
    return { success: false, error: new Error('You are not authorized to delete this doubt.') };
  }

  mockDoubts.splice(doubtIndex, 1);
  // Cascade delete responses
  for (let i = mockDoubtResponses.length - 1; i >= 0; i--) {
    if (mockDoubtResponses[i].doubt_id === doubtId) {
      mockDoubtResponses.splice(i, 1);
    }
  }

  return { success: true, error: null };
}

// ==============================================================================
// ANNOUNCEMENTS & NOTICES DESK MOCK DATA & REPOSITORY
// ==============================================================================

function normalizeId(id: string): string {
  if (id === 'PP001') return 'mock-student-pp001';
  if (id === 'PP002') return 'mock-student-pp002';
  if (id === 'PP003') return 'mock-student-pp003';
  if (id === 'PPM001') return 'mock-mentor-ppm001';
  if (id === 'PPM002') return 'mock-mentor-ppm002';
  if (id === 'PPA001' || id === 'admin') return 'mock-admin-ppa001';
  return id;
}

export interface EnrichedMockAnnouncementAcknowledgment {
  id: string;
  announcement_id: string;
  student_id: string;
  student_name: string;
  student_poraplan_id: string;
  acknowledged_at: string;
}

export interface EnrichedMockAnnouncement extends Announcement {
  author_name?: string;
  author_role?: UserRole;
  author_poraplan_id?: string;
  student_name?: string;
  student_poraplan_id?: string;
  subject_name?: string;
  subject_code?: string | null;
  is_acknowledged?: boolean;
  acknowledged_at?: string | null;
  acknowledgments_count?: number;
  acknowledgments?: EnrichedMockAnnouncementAcknowledgment[];
}

export const mockAnnouncements: Announcement[] = [
  {
    id: 'mock-announcement-001',
    author_id: 'mock-admin-ppa001',
    title: 'Welcome to PoraPlan Autumn Academic Session 2026',
    content: 'Welcome all scholars and mentors! Please review your academic timelines, ensure all baseline diagnostics are completed, and sync with your assigned mentors for personalized study plan scheduling.',
    target_scope: 'platform',
    student_id: null,
    subject_id: null,
    priority: 'urgent',
    status: 'published',
    published_at: '2026-10-05T08:00:00Z',
    created_at: '2026-10-05T08:00:00Z',
    updated_at: '2026-10-05T08:00:00Z',
  },
  {
    id: 'mock-announcement-002',
    author_id: 'mock-mentor-ppm001',
    title: 'Physics Lab & Advanced Problem Set 3 Consultation Hours',
    content: 'Office hours for rotational dynamics, moment of inertia calculations, and Atwood machine problem sets will be held this Thursday at 16:00 UTC. Submit any preliminary inquiries via the Doubts Desk in advance.',
    target_scope: 'assigned_students',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    student_id: null,
    subject_id: 'mock-sub-phy-101',
    priority: 'important',
    status: 'published',
    published_at: '2026-10-14T10:00:00Z',
    created_at: '2026-10-14T10:00:00Z',
    updated_at: '2026-10-14T10:00:00Z',
  },
  {
    id: 'mock-announcement-003',
    author_id: 'mock-mentor-ppm001',
    title: 'Personalized Focus: Angular Momentum & Precession Problem Set',
    content: 'Fahim, please pay special attention to problem 4.2 in the new assignment regarding gyroscope precession angular velocity. Acknowledge this notice once you have reviewed the reference notes.',
    target_scope: 'individual',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    student_id: 'mock-student-pp001',
    subject_id: 'mock-sub-phy-101',
    priority: 'normal',
    status: 'published',
    published_at: '2026-10-16T15:30:00Z',
    created_at: '2026-10-16T15:30:00Z',
    updated_at: '2026-10-16T15:30:00Z',
  },
];

export const mockAnnouncementAcknowledgments: AnnouncementAcknowledgment[] = [
  {
    id: 'mock-ack-001',
    announcement_id: 'mock-announcement-001',
    student_id: 'mock-student-pp001',
    acknowledged_at: '2026-10-05T09:12:00Z',
  },
];

export function getMockStudentAnnouncements(studentId: string): EnrichedMockAnnouncement[] {
  const normalizedId = normalizeId(studentId);
  const student = mockStore.find((u) => u.id === normalizedId);

  return mockAnnouncements
    .filter((a) => {
      // Students only view published announcements
      if (a.status !== 'published') return false;

      // Platform-wide announcements are visible to all students
      if (a.target_scope === 'platform') return true;

      // Individual target: student must match
      if (a.target_scope === 'individual') {
        return a.student_id === normalizedId || (student && a.student_id === student.poraplanId);
      }

      // Assigned students target: student must be in author's assigned roster or mentor authorized
      if (a.target_scope === 'assigned_students') {
        return isMockAuthorizedMentorForStudent(a.author_id, normalizedId, (a as any).program_id || undefined);
      }

      return false;
    })
    .map((a) => {
      const author = mockStore.find((u) => u.id === a.author_id);
      const subject = a.subject_id ? mockSubjects.find((s) => s.id === a.subject_id) : null;
      const ack = mockAnnouncementAcknowledgments.find(
        (ack) => ack.announcement_id === a.id && (ack.student_id === normalizedId || (student && ack.student_id === student.poraplanId))
      );

      return {
        ...a,
        author_name: author?.fullName || 'Academic Faculty',
        author_role: author?.role,
        author_poraplan_id: author?.poraplanId,
        subject_name: subject?.name,
        subject_code: subject?.code,
        is_acknowledged: Boolean(ack),
        acknowledged_at: ack?.acknowledged_at || null,
      };
    })
    .sort((a, b) => new Date(b.published_at || b.created_at || 0).getTime() - new Date(a.published_at || a.created_at || 0).getTime());
}

export function getMockMentorAnnouncements(mentorId: string): EnrichedMockAnnouncement[] {
  const normalizedId = normalizeId(mentorId);
  const user = mockStore.find((u) => u.id === normalizedId);
  const isAdmin = user?.role === 'admin' || normalizedId === 'mock-admin-ppa001';

  return mockAnnouncements
    .filter((a) => {
      if (isAdmin) return true;
      return a.author_id === normalizedId;
    })
    .map((a) => {
      const author = mockStore.find((u) => u.id === a.author_id);
      const targetStudent = a.student_id ? mockStore.find((u) => u.id === a.student_id || u.poraplanId === a.student_id) : null;
      const subject = a.subject_id ? mockSubjects.find((s) => s.id === a.subject_id) : null;

      const acks: EnrichedMockAnnouncementAcknowledgment[] = mockAnnouncementAcknowledgments
        .filter((ack) => ack.announcement_id === a.id)
        .map((ack) => {
          const s = mockStore.find((u) => u.id === ack.student_id || u.poraplanId === ack.student_id);
          return {
            id: ack.id,
            announcement_id: ack.announcement_id,
            student_id: ack.student_id,
            student_name: s?.fullName || 'Scholar',
            student_poraplan_id: s?.poraplanId || '',
            acknowledged_at: ack.acknowledged_at,
          };
        });

      return {
        ...a,
        author_name: author?.fullName || 'Academic Faculty',
        author_role: author?.role,
        author_poraplan_id: author?.poraplanId,
        student_name: targetStudent?.fullName,
        student_poraplan_id: targetStudent?.poraplanId,
        subject_name: subject?.name,
        subject_code: subject?.code,
        acknowledgments_count: acks.length,
        acknowledgments: acks,
      };
    })
    .sort((a, b) => new Date(b.published_at || b.created_at || 0).getTime() - new Date(a.published_at || a.created_at || 0).getTime());
}

export function getMockAnnouncementById(
  announcementId: string,
  viewerId: string
): { announcement: EnrichedMockAnnouncement | null; error: Error | null } {
  const a = mockAnnouncements.find((item) => item.id === announcementId);
  if (!a) {
    return { announcement: null, error: new Error('Announcement not found.') };
  }

  const normalizedViewerId = normalizeId(viewerId);
  const viewer = mockStore.find((u) => u.id === normalizedViewerId);
  const isAdmin = viewer?.role === 'admin' || normalizedViewerId === 'mock-admin-ppa001';
  const isAuthor = a.author_id === normalizedViewerId;

  if (viewer?.role === 'student') {
    if (a.status !== 'published') {
      return { announcement: null, error: new Error('Announcement not found.') };
    }
    const isPlatform = a.target_scope === 'platform';
    const isIndividual = a.target_scope === 'individual' && (a.student_id === normalizedViewerId || a.student_id === viewer.poraplanId);
    let isAssigned = false;
    if (a.target_scope === 'assigned_students') {
      if (a.cohort_id) {
        const studentEnrollments = getMockEnrollments({ studentId: normalizedViewerId, cohortId: a.cohort_id, status: 'active' });
        isAssigned = studentEnrollments.length > 0;
      } else {
        isAssigned = isMockAuthorizedMentorForStudent(a.author_id, normalizedViewerId, (a as any).program_id || undefined);
      }
    }

    if (!isPlatform && !isIndividual && !isAssigned) {
      return { announcement: null, error: new Error('You are not authorized to view this announcement.') };
    }
  } else if (!isAdmin && !isAuthor) {
    return { announcement: null, error: new Error('You are not authorized to view this announcement.') };
  }

  const author = mockStore.find((u) => u.id === a.author_id);
  const targetStudent = a.student_id ? mockStore.find((u) => u.id === a.student_id || u.poraplanId === a.student_id) : null;
  const subject = a.subject_id ? mockSubjects.find((s) => s.id === a.subject_id) : null;
  const ack = viewer?.role === 'student'
    ? mockAnnouncementAcknowledgments.find((ack) => ack.announcement_id === a.id && ack.student_id === normalizedViewerId)
    : undefined;

  const acks: EnrichedMockAnnouncementAcknowledgment[] = mockAnnouncementAcknowledgments
    .filter((ack) => ack.announcement_id === a.id)
    .map((ack) => {
      const s = mockStore.find((u) => u.id === ack.student_id || u.poraplanId === ack.student_id);
      return {
        id: ack.id,
        announcement_id: ack.announcement_id,
        student_id: ack.student_id,
        student_name: s?.fullName || 'Scholar',
        student_poraplan_id: s?.poraplanId || '',
        acknowledged_at: ack.acknowledged_at,
      };
    });

  return {
    announcement: {
      ...a,
      author_name: author?.fullName || 'Academic Faculty',
      author_role: author?.role,
      author_poraplan_id: author?.poraplanId,
      student_name: targetStudent?.fullName,
      student_poraplan_id: targetStudent?.poraplanId,
      subject_name: subject?.name,
      subject_code: subject?.code,
      is_acknowledged: Boolean(ack),
      acknowledged_at: ack?.acknowledged_at || null,
      acknowledgments_count: acks.length,
      acknowledgments: acks,
    },
    error: null,
  };
}

export function createMockAnnouncement(data: {
  authorId: string;
  title: string;
  content: string;
  targetScope?: AnnouncementScope;
  programId?: string | null;
  cohortId?: string | null;
  studentId?: string | null;
  subjectId?: string | null;
  priority?: AnnouncementPriority;
  status?: AnnouncementStatus;
}): { announcement: Announcement | null; error: Error | null } {
  const normalizedAuthorId = normalizeId(data.authorId);
  const author = mockStore.find((u) => u.id === normalizedAuthorId);
  if (!author) {
    return { announcement: null, error: new Error('Author account not found.') };
  }

  const cleanTitle = data.title?.trim();
  if (!cleanTitle) {
    return { announcement: null, error: new Error('Announcement title is required.') };
  }

  const cleanContent = data.content?.trim();
  if (!cleanContent) {
    return { announcement: null, error: new Error('Announcement content is required.') };
  }

  const scope: AnnouncementScope = data.targetScope || 'assigned_students';
  const priority: AnnouncementPriority = data.priority || 'normal';
  const status: AnnouncementStatus = data.status || 'published';

  // Security: only platform administrators can create platform-wide announcements
  if (scope === 'platform' && author.role !== 'admin') {
    return {
      announcement: null,
      error: new Error('Only platform administrators are authorized to publish platform-wide announcements.'),
    };
  }

  // Security: individual target requires studentId and mentor can only target assigned students
  let normalizedStudentId: string | null = null;
  if (scope === 'individual') {
    if (!data.studentId) {
      return {
        announcement: null,
        error: new Error('Individual announcements require a target student to be selected.'),
      };
    }
    normalizedStudentId = normalizeId(data.studentId);
    if (author.role === 'mentor') {
      const isAssigned = isMockAuthorizedMentorForStudent(normalizedAuthorId, normalizedStudentId, data.programId || undefined);
      if (!isAssigned) {
        return {
          announcement: null,
          error: new Error('Mentors can only create targeted announcements for their assigned scholars.'),
        };
      }
    }
  }

  // Validate subject if provided
  if (data.subjectId) {
    const subjectExists = mockSubjects.some((s) => s.id === data.subjectId);
    if (!subjectExists) {
      return { announcement: null, error: new Error('Specified study area does not exist.') };
    }
  }

  const now = new Date().toISOString();
  const newAnnouncement: Announcement = {
    id: `mock-announcement-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    author_id: normalizedAuthorId,
    title: cleanTitle,
    content: cleanContent,
    target_scope: scope,
    program_id: data.programId || null,
    cohort_id: data.cohortId || null,
    student_id: normalizedStudentId,
    subject_id: data.subjectId || null,
    priority,
    status,
    published_at: now,
    created_at: now,
    updated_at: now,
  };

  mockAnnouncements.unshift(newAnnouncement);

  if (status === 'published') {
    const authorUser = mockStore.find((u) => u.id === normalizedAuthorId);
    const authorName = authorUser?.fullName || 'Academic Faculty';

    let recipients: string[] = [];
    if (scope === 'individual' && normalizedStudentId) {
      recipients = [normalizedStudentId];
    } else if (scope === 'assigned_students') {
      if (data.cohortId) {
        const enrollments = getMockEnrollments({ cohortId: data.cohortId, status: 'active' });
        recipients = enrollments.map((e) => e.student_id);
      } else if (data.programId) {
        const assigned = getMockAssignedStudents(normalizedAuthorId, data.programId);
        recipients = assigned.map((s) => s.id);
      } else {
        const assigned = getMockAssignedStudents(normalizedAuthorId);
        recipients = assigned.map((s) => s.id);
      }
    } else if (scope === 'platform') {
      recipients = mockStore.filter((u) => u.role === 'student').map((u) => u.id);
    }
    recipients = Array.from(new Set(recipients));

    recipients.forEach((recId) => {
      createMockNotification({
        recipientId: recId,
        actorId: normalizedAuthorId,
        type: 'announcement_published',
        title: cleanTitle,
        message: `${authorName} published an announcement`,
        link: '/student/announcements',
        idempotencyKey: `announcement:${newAnnouncement.id}:${recId}`,
      });
    });
  }

  return { announcement: { ...newAnnouncement }, error: null };
}

export function updateMockAnnouncement(
  announcementId: string,
  userId: string,
  updates: Partial<AnnouncementUpdate>
): { announcement: Announcement | null; error: Error | null } {
  const index = mockAnnouncements.findIndex((a) => a.id === announcementId);
  if (index === -1) {
    return { announcement: null, error: new Error('Announcement not found.') };
  }

  const normalizedUserId = normalizeId(userId);
  const user = mockStore.find((u) => u.id === normalizedUserId);
  const current = mockAnnouncements[index];

  const isAuthor = current.author_id === normalizedUserId;
  const isAdmin = user?.role === 'admin' || normalizedUserId === 'mock-admin-ppa001';

  if (!isAuthor && !isAdmin) {
    return { announcement: null, error: new Error('You are not authorized to update this announcement.') };
  }

  // Security checks (Milestone 5.2.1): Mentors cannot elevate to platform scope, reassign author, or retarget unauthorized students/programs
  if (!isAdmin) {
    if ((updates as any).author_id && (updates as any).author_id !== current.author_id) {
      return { announcement: null, error: new Error('Cannot reassign announcement author.') };
    }
    if (updates.target_scope === 'platform') {
      return { announcement: null, error: new Error('Mentors cannot change announcement scope to platform-wide.') };
    }
    if (updates.target_scope === 'individual' || updates.student_id) {
      const targetStudent = updates.student_id || current.student_id;
      if (!targetStudent || !isMockAuthorizedMentorForStudent(normalizedUserId, targetStudent, (current as any).program_id)) {
        return { announcement: null, error: new Error('Cannot direct announcement to unauthorized student.') };
      }
    }
    const targetProgramId = (updates as any).program_id || (current as any).program_id;
    if (targetProgramId) {
      const hasProgramRole = mockCohortMentors.some((cm) => cm.mentor_id === normalizedUserId && cm.program_id === targetProgramId && cm.is_active)
        || mockStudentMentorAssignments.some((sma) => sma.mentor_id === normalizedUserId && sma.program_id === targetProgramId && sma.is_active)
        || mockApplications.some((app) => app.applicant_id === normalizedUserId && app.application_type === 'mentor' && app.program_id === targetProgramId && app.status === 'approved');
      if (!hasProgramRole) {
        return { announcement: null, error: new Error('Cannot publish announcement for a program you do not mentor.') };
      }
    }
  }

  const cleanTitle = updates.title !== undefined ? updates.title.trim() : current.title;
  if (!cleanTitle) {
    return { announcement: null, error: new Error('Announcement title cannot be empty.') };
  }

  const cleanContent = updates.content !== undefined ? updates.content.trim() : current.content;
  if (!cleanContent) {
    return { announcement: null, error: new Error('Announcement content cannot be empty.') };
  }

  const now = new Date().toISOString();
  const updated: Announcement = {
    ...current,
    title: cleanTitle,
    content: cleanContent,
    priority: updates.priority || current.priority,
    status: updates.status || current.status,
    subject_id: updates.subject_id !== undefined ? updates.subject_id : current.subject_id,
    updated_at: now,
  };

  mockAnnouncements[index] = updated;
  return { announcement: { ...updated }, error: null };
}

export function acknowledgeMockAnnouncement(
  announcementId: string,
  studentId: string
): { acknowledgment: AnnouncementAcknowledgment | null; error: Error | null } {
  const normalizedStudentId = normalizeId(studentId);
  const student = mockStore.find((u) => u.id === normalizedStudentId);
  if (!student) {
    return { acknowledgment: null, error: new Error('Student account not found.') };
  }

  const announcement = mockAnnouncements.find((a) => a.id === announcementId);
  if (!announcement) {
    return { acknowledgment: null, error: new Error('Announcement not found.') };
  }

  if (announcement.status !== 'published') {
    return { acknowledgment: null, error: new Error('Archived announcements cannot be acknowledged.') };
  }

  // Verify student is an authorized recipient
  let authorized = false;
  if (announcement.target_scope === 'platform') {
    authorized = true;
  } else if (announcement.target_scope === 'individual') {
    authorized = announcement.student_id === normalizedStudentId || announcement.student_id === student.poraplanId;
  } else if (announcement.target_scope === 'assigned_students') {
    if (announcement.cohort_id) {
      const studentEnrollments = getMockEnrollments({ studentId: normalizedStudentId, cohortId: announcement.cohort_id, status: 'active' });
      authorized = studentEnrollments.length > 0;
    } else {
      authorized = isMockAuthorizedMentorForStudent(
        announcement.author_id,
        normalizedStudentId,
        (announcement as any).program_id || undefined
      );
    }
  }

  if (!authorized) {
    return {
      acknowledgment: null,
      error: new Error('You are not authorized to acknowledge an announcement not targeted to you.'),
    };
  }

  // If already acknowledged, return existing record idempotently
  const existing = mockAnnouncementAcknowledgments.find(
    (ack) => ack.announcement_id === announcementId && ack.student_id === normalizedStudentId
  );
  if (existing) {
    return { acknowledgment: { ...existing }, error: null };
  }

  const newAck: AnnouncementAcknowledgment = {
    id: `mock-ack-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    announcement_id: announcementId,
    student_id: normalizedStudentId,
    acknowledged_at: new Date().toISOString(),
  };

  mockAnnouncementAcknowledgments.push(newAck);
  return { acknowledgment: { ...newAck }, error: null };
}

export function deleteMockAnnouncement(
  announcementId: string,
  userId: string
): { success: boolean; error: Error | null } {
  const index = mockAnnouncements.findIndex((a) => a.id === announcementId);
  if (index === -1) {
    return { success: false, error: new Error('Announcement not found.') };
  }

  const normalizedUserId = normalizeId(userId);
  const user = mockStore.find((u) => u.id === normalizedUserId);
  const current = mockAnnouncements[index];

  const isAuthor = current.author_id === normalizedUserId;
  const isAdmin = user?.role === 'admin' || normalizedUserId === 'mock-admin-ppa001';

  if (!isAuthor && !isAdmin) {
    return { success: false, error: new Error('You are not authorized to delete this announcement.') };
  }

  mockAnnouncements.splice(index, 1);
  // Cascade delete acknowledgments
  for (let i = mockAnnouncementAcknowledgments.length - 1; i >= 0; i--) {
    if (mockAnnouncementAcknowledgments[i].announcement_id === announcementId) {
      mockAnnouncementAcknowledgments.splice(i, 1);
    }
  }

  return { success: true, error: null };
}

// ==============================================================================
// NOTIFICATIONS DESK MOCK DATA & REPOSITORY (Milestone 17)
// ==============================================================================

export interface EnrichedMockNotification extends Notification {
  actor_name?: string;
  actor_role?: UserRole;
  actor_poraplan_id?: string;
}

export const mockNotifications: Notification[] = [
  {
    id: 'mock-notif-001',
    recipient_id: 'mock-student-pp001',
    actor_id: 'mock-mentor-ppm001',
    type: 'doubt_replied',
    title: 'Mentor Replied to Your Doubt',
    message: 'Dr. Rafiqul Islam replied to "Normal force and friction on a double-incline Atwood setup"',
    link: '/student/doubts',
    read: false,
    read_at: null,
    idempotency_key: 'doubt_reply:mock-resp-001',
    created_at: '2026-10-12T11:16:00Z',
  },
  {
    id: 'mock-notif-002',
    recipient_id: 'mock-student-pp001',
    actor_id: 'mock-admin-ppa001',
    type: 'announcement_published',
    title: 'Welcome to PoraPlan Autumn Academic Session 2026',
    message: 'PoraPlan System Admin broadcast an urgent platform directive',
    link: '/student/announcements',
    read: true,
    read_at: '2026-10-05T09:12:00Z',
    idempotency_key: 'announcement:mock-announcement-001:mock-student-pp001',
    created_at: '2026-10-05T08:01:00Z',
  },
];

export function getMockStudentNotifications(studentId: string): EnrichedMockNotification[] {
  const normalizedId = normalizeId(studentId);
  const student = mockStore.find((u) => u.id === normalizedId);

  return mockNotifications
    .filter((n) => n.recipient_id === normalizedId || (student && n.recipient_id === student.poraplanId))
    .map((n) => {
      const actor = n.actor_id ? mockStore.find((u) => u.id === n.actor_id) : null;
      return {
        ...n,
        actor_name: actor?.fullName || (n.type === 'system' ? 'PoraPlan System' : 'Academic Faculty'),
        actor_role: actor?.role,
        actor_poraplan_id: actor?.poraplanId,
      };
    })
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}

export function getMockUnreadNotificationCount(studentId: string): number {
  const normalizedId = normalizeId(studentId);
  const student = mockStore.find((u) => u.id === normalizedId);

  return mockNotifications.filter(
    (n) => !n.read && (n.recipient_id === normalizedId || (student && n.recipient_id === student.poraplanId))
  ).length;
}

export function createMockNotification(data: {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  idempotencyKey?: string | null;
}): { notification: Notification | null; error: Error | null } {
  const normalizedRecipientId = normalizeId(data.recipientId);
  const recipient = mockStore.find((u) => u.id === normalizedRecipientId);
  if (!recipient) {
    return { notification: null, error: new Error('Recipient account not found.') };
  }

  const cleanTitle = data.title?.trim();
  if (!cleanTitle) {
    return { notification: null, error: new Error('Notification title is required.') };
  }
  const cleanMessage = data.message?.trim();
  if (!cleanMessage) {
    return { notification: null, error: new Error('Notification message is required.') };
  }

  // Safe internal link validation
  if (data.link) {
    if (!data.link.startsWith('/') || data.link.startsWith('//') || data.link.includes(':')) {
      return { notification: null, error: new Error('Notification link must be a safe internal route.') };
    }
  }

  const normalizedActorId = data.actorId ? normalizeId(data.actorId) : null;

  // Actor role & roster check
  if (normalizedActorId) {
    const actor = mockStore.find((u) => u.id === normalizedActorId);
    if (actor?.role === 'student') {
      return { notification: null, error: new Error('Students are not authorized to create notifications.') };
    }
    if (actor?.role === 'mentor') {
      const assigned = getMockAssignedStudents(normalizedActorId);
      const isAssigned = assigned.some(
        (s) => s.id === normalizedRecipientId || (recipient && s.poraplan_id === recipient.poraplanId)
      );
      if (!isAssigned) {
        return { notification: null, error: new Error('Mentors can only notify students assigned to them.') };
      }
    }
  }

  // Idempotency check: prevent duplicate notifications
  if (data.idempotencyKey) {
    const existing = mockNotifications.find(
      (n) => n.recipient_id === normalizedRecipientId && n.idempotency_key === data.idempotencyKey
    );
    if (existing) {
      return { notification: { ...existing }, error: null };
    }
  }

  const now = new Date().toISOString();

  const newNotification: Notification = {
    id: `mock-notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    recipient_id: normalizedRecipientId,
    actor_id: normalizedActorId,
    type: data.type,
    title: cleanTitle,
    message: cleanMessage,
    link: data.link || null,
    read: false,
    read_at: null,
    idempotency_key: data.idempotencyKey || null,
    created_at: now,
  };

  mockNotifications.unshift(newNotification);
  return { notification: { ...newNotification }, error: null };
}

export function markMockNotificationAsRead(
  notificationId: string,
  studentId: string
): { notification: Notification | null; error: Error | null } {
  const normalizedStudentId = normalizeId(studentId);
  const student = mockStore.find((u) => u.id === normalizedStudentId);

  const index = mockNotifications.findIndex(
    (n) => n.id === notificationId && (n.recipient_id === normalizedStudentId || (student && n.recipient_id === student.poraplanId))
  );

  if (index === -1) {
    return { notification: null, error: new Error('Notification not found or access denied.') };
  }

  const current = mockNotifications[index];
  if (!current.read) {
    current.read = true;
    current.read_at = new Date().toISOString();
    mockNotifications[index] = { ...current };
  }

  return { notification: { ...mockNotifications[index] }, error: null };
}

export function markAllMockNotificationsAsRead(
  studentId: string
): { count: number; error: Error | null } {
  const normalizedStudentId = normalizeId(studentId);
  const student = mockStore.find((u) => u.id === normalizedStudentId);
  const now = new Date().toISOString();
  let updatedCount = 0;

  for (let i = 0; i < mockNotifications.length; i++) {
    const n = mockNotifications[i];
    if ((n.recipient_id === normalizedStudentId || (student && n.recipient_id === student.poraplanId)) && !n.read) {
      mockNotifications[i] = {
        ...n,
        read: true,
        read_at: now,
      };
      updatedCount++;
    }
  }

  return { count: updatedCount, error: null };
}

export function deleteMockNotification(
  notificationId: string,
  studentId: string
): { success: boolean; error: Error | null } {
  const normalizedStudentId = normalizeId(studentId);
  const student = mockStore.find((u) => u.id === normalizedStudentId);

  const index = mockNotifications.findIndex(
    (n) => n.id === notificationId && (n.recipient_id === normalizedStudentId || (student && n.recipient_id === student.poraplanId))
  );

  if (index === -1) {
    return { success: false, error: new Error('Notification not found or access denied.') };
  }

  mockNotifications.splice(index, 1);
  return { success: true, error: null };
}

// ==============================================================================
// Milestone 2: Mock Program, Cohort, and Curriculum Management Store
// ==============================================================================

const mockPrograms: Program[] = [
  {
    id: 'prog-academic-01',
    name: 'PoraPlan Academic Program 0.1 (Beta)',
    slug: 'academic-program-0-1-beta',
    category: 'academic_mentorship',
    short_description: 'Comprehensive semester academic assistance, structured syllabus organization, daily target planning, and dedicated mentor supervision.',
    description: 'PoraPlan Academic Program provides students with personal 1-on-1 and small-cohort academic mentorship. We review your syllabus, organize learning resources, structure daily tasks, and conduct weekly evaluations to keep you consistent and ahead of semester exams.',
    learning_objectives: [
      'Build consistent, disciplined daily study habits without burnout',
      'Systematic breakdown of semester syllabus and complex course outlines',
      'Weekly mentor review, doubt clearing, and continuous exam preparation',
    ],
    target_audience: 'Undergraduate university students seeking structured study routines and personalized academic guidance.',
    prerequisites: 'Currently enrolled in university semester coursework. Commitment of 2-3 hours of focused daily study.',
    duration: 'Full Academic Semester (4 Months)',
    delivery_mode: 'Hybrid (Personal Online Mentorship & Asynchronous Tracking)',
    cover_image_url: null,
    publication_status: 'published',
    enrollment_status: 'open',
    display_order: 1,
    created_by: 'mock-admin-ppa001',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prog-skillsprint-git',
    name: 'SkillSprint — Git, GitHub & Modern Version Control',
    slug: 'skillsprint-git-github',
    category: 'skillsprint',
    short_description: 'A hands-on, project-driven sprint to master Git CLI, team collaboration workflows, branching models, and pull request hygiene.',
    description: 'Master practical industry version control fundamentals. From initialization, branching strategies, rebase vs merge, to full GitHub collaborative workflows with pull requests and code reviews.',
    learning_objectives: [
      'Master Git branch management and merge conflict resolution',
      'Collaborative GitHub workflow: PRs, code reviews, and releases',
      'Essential daily developer CLI habits and terminal speed',
    ],
    target_audience: 'CS students, junior developers, and self-taught programmers seeking workplace-ready Git fluency.',
    prerequisites: 'Basic command line familiarity. Laptop with Git installed.',
    duration: '3 Weeks Intensive',
    delivery_mode: 'Hands-on Sprint (Live Code Labs + Practical Exercises)',
    cover_image_url: null,
    publication_status: 'published',
    enrollment_status: 'open',
    display_order: 2,
    created_by: 'mock-admin-ppa001',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prog-skillsprint-c-fundamentals',
    name: 'SkillSprint — C Programming & Problem Solving Fundamentals',
    slug: 'skillsprint-c-programming',
    category: 'skillsprint',
    short_description: 'Foundational programming concepts, memory pointers, dynamic arrays, and structured problem solving in C.',
    description: 'Designed specifically for university students taking introductory programming. Bridges theoretical lectures with practical problem solving.',
    learning_objectives: [
      'Deconstruct complex programming logic into clean algorithmic steps',
      'Deep conceptual clarity on pointers, memory allocation, and structs',
      'Preparation for university lab exams and programming contests',
    ],
    target_audience: 'First-year university students tackling CSE 101/103 or beginners learning programming.',
    prerequisites: 'No prior programming experience required.',
    duration: '4 Weeks',
    delivery_mode: 'Structured Cohort Sprint',
    cover_image_url: null,
    publication_status: 'draft',
    enrollment_status: 'closed',
    display_order: 3,
    created_by: 'mock-admin-ppa001',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockCohorts: Cohort[] = [
  {
    id: 'cohort-uu-cse-b67',
    program_id: 'prog-academic-01',
    name: 'UU CSE Batch 67 — Fall 2026',
    code: 'UU-CSE-B67-F26',
    description: 'Specialized academic mentorship cohort for Uttara University CSE Batch 67 students covering core Fall 2026 courses.',
    start_date: '2026-10-01',
    end_date: '2027-02-15',
    capacity: 30,
    status: 'active',
    created_by: 'mock-admin-ppa001',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cohort-git-sprint-01',
    program_id: 'prog-skillsprint-git',
    name: 'Sprint Cohort 01 — Git Foundations',
    code: 'GIT-SPRINT-01',
    description: 'Inaugural SkillSprint cohort focusing on Git CLI mastery and GitHub team collaboration.',
    start_date: '2026-11-15',
    end_date: '2026-12-06',
    capacity: 25,
    status: 'planned',
    created_by: 'mock-admin-ppa001',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockCurriculumSections: ProgramCurriculumSection[] = [
  {
    id: 'sec-acad-01',
    program_id: 'prog-academic-01',
    title: 'Phase 1: Academic Diagnostic & Study Routine Formulation',
    description: 'Initial assessment of syllabus materials, academic baseline, and establishing structured weekly study blocks.',
    display_order: 1,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sec-acad-02',
    program_id: 'prog-academic-01',
    title: 'Phase 2: Core Course Syllabus Roadmap & Daily Targets',
    description: 'Deep dive into semester coursework, breaking complex lectures into daily bite-sized tasks and practice exercises.',
    display_order: 2,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sec-acad-03',
    program_id: 'prog-academic-01',
    title: 'Phase 3: Midterm & Final Exam Preparation Sprints',
    description: 'Targeted revision routines, past question analysis, timed mock exams, and prompt mentor feedback.',
    display_order: 3,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sec-git-01',
    program_id: 'prog-skillsprint-git',
    title: 'Module 1: Version Control Foundations & Local Git',
    description: 'Setting up Git, repository anatomy, staging, committing, and inspecting commit history.',
    display_order: 1,
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sec-git-02',
    program_id: 'prog-skillsprint-git',
    title: 'Module 2: Branching, Merging & Remote Collaboration',
    description: 'Feature branching models, resolving merge conflicts, remotes, GitHub pull requests, and code review etiquette.',
    display_order: 2,
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockCurriculumTopics: ProgramCurriculumTopic[] = [
  // Academic Phase 1
  {
    id: 'top-acad-01-01',
    section_id: 'sec-acad-01',
    title: '1-on-1 Academic Diagnostic Session',
    description: 'Review current academic goals, past university grades, and identify challenge areas.',
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'top-acad-01-02',
    section_id: 'sec-acad-01',
    title: 'Course Outlines & Syllabus Cataloging',
    description: 'Organize course handouts, lecture slide repositories, and required textbook readings.',
    display_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'top-acad-01-03',
    section_id: 'sec-acad-01',
    title: 'Weekly Study Schedule Formulation',
    description: 'Lock in realistic daily study hours and WhatsApp check-in milestones.',
    display_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Academic Phase 2
  {
    id: 'top-acad-02-01',
    section_id: 'sec-acad-02',
    title: 'Weekly Target Planning & Task Breakdown',
    description: 'Mentor assigns Monday-to-Saturday targets with concrete practice problems.',
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'top-acad-02-02',
    section_id: 'sec-acad-02',
    title: 'Daily Doubt Logging & Rapid Response',
    description: 'Submitting questions and code snippets with screenshot attachments for mentor review.',
    display_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'top-acad-02-03',
    section_id: 'sec-acad-02',
    title: 'Concept Checks & Weekly Progress Tracking',
    description: 'Regular mini-evaluations to confirm understanding before moving to subsequent topics.',
    display_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Academic Phase 3
  {
    id: 'top-acad-03-01',
    section_id: 'sec-acad-03',
    title: 'University Past Exam Paper Review',
    description: 'Analyzing high-frequency question patterns from the last 5 semester exams.',
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'top-acad-03-02',
    section_id: 'sec-acad-03',
    title: 'Timed Simulation & Mock Examinations',
    description: 'Simulating exam conditions with mentor grading and feedback on presentation.',
    display_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Git Module 1
  {
    id: 'top-git-01-01',
    section_id: 'sec-git-01',
    title: 'What is Version Control & Git Architecture',
    description: 'Working directory, staging area, and commit tree concepts.',
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'top-git-01-02',
    section_id: 'sec-git-01',
    title: 'Essential Commands & Diff Inspection',
    description: 'git init, status, add, commit, diff, and log formatting.',
    display_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Git Module 2
  {
    id: 'top-git-02-01',
    section_id: 'sec-git-02',
    title: 'Branching Strategies & Conflict Resolution',
    description: 'Creating branches, merging changes, and resolving conflict markers calmly.',
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'top-git-02-02',
    section_id: 'sec-git-02',
    title: 'GitHub Pull Requests & Team Collaboration',
    description: 'Forking, branching, crafting meaningful PR descriptions, and addressing reviews.',
    display_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// --- Mock Program CRUD Functions ---

export function getMockPrograms(options?: {
  category?: string;
  status?: string;
  includeUnpublished?: boolean;
}): Program[] {
  let list = [...mockPrograms];

  if (!options?.includeUnpublished) {
    list = list.filter((p) => p.publication_status === 'published');
  }

  if (options?.category && options.category !== 'all') {
    list = list.filter((p) => p.category === options.category);
  }

  if (options?.status && options.status !== 'all') {
    list = list.filter((p) => p.publication_status === options.status);
  }

  return list.sort((a, b) => a.display_order - b.display_order);
}

export function getMockProgramBySlug(slug: string): Program | null {
  return mockPrograms.find((p) => p.slug === slug) || null;
}

export function getMockProgramById(id: string): Program | null {
  return mockPrograms.find((p) => p.id === id) || null;
}

export function createMockProgram(program: ProgramInsert): { program: Program | null; error: Error | null } {
  const existing = mockPrograms.find((p) => p.slug === program.slug);
  if (existing) {
    return { program: null, error: new Error(`A program with slug '${program.slug}' already exists.`) };
  }

  const now = new Date().toISOString();
  const newProgram: Program = {
    id: program.id || `prog-${Date.now()}`,
    name: program.name,
    slug: program.slug,
    category: program.category,
    short_description: program.short_description,
    description: program.description || null,
    learning_objectives: program.learning_objectives || [],
    target_audience: program.target_audience || null,
    prerequisites: program.prerequisites || null,
    duration: program.duration || null,
    delivery_mode: program.delivery_mode || null,
    cover_image_url: program.cover_image_url || null,
    publication_status: program.publication_status || 'draft',
    enrollment_status: program.enrollment_status || 'closed',
    display_order: program.display_order ?? (mockPrograms.length + 1),
    created_by: program.created_by || 'mock-admin-ppa001',
    created_at: now,
    updated_at: now,
  };

  mockPrograms.push(newProgram);
  return { program: newProgram, error: null };
}

export function updateMockProgram(
  id: string,
  updates: ProgramUpdate
): { program: Program | null; error: Error | null } {
  const index = mockPrograms.findIndex((p) => p.id === id);
  if (index === -1) {
    return { program: null, error: new Error('Program not found.') };
  }

  if (updates.slug && updates.slug !== mockPrograms[index].slug) {
    const slugCollision = mockPrograms.find((p) => p.slug === updates.slug && p.id !== id);
    if (slugCollision) {
      return { program: null, error: new Error(`Slug '${updates.slug}' is already in use by another program.`) };
    }
  }

  mockPrograms[index] = {
    ...mockPrograms[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  return { program: mockPrograms[index], error: null };
}

export function deleteMockProgram(id: string): { success: boolean; error: Error | null } {
  const index = mockPrograms.findIndex((p) => p.id === id);
  if (index === -1) {
    return { success: false, error: new Error('Program not found.') };
  }

  mockPrograms.splice(index, 1);
  return { success: true, error: null };
}

// --- Mock Cohort CRUD Functions ---

export function getMockCohorts(programId?: string): Cohort[] {
  let list = [...mockCohorts];
  if (programId) {
    list = list.filter((c) => c.program_id === programId);
  }
  return list;
}

export function createMockCohort(cohort: CohortInsert): { cohort: Cohort | null; error: Error | null } {
  const existingCode = mockCohorts.find((c) => c.code.toUpperCase() === cohort.code.trim().toUpperCase());
  if (existingCode) {
    return { cohort: null, error: new Error(`Cohort code '${cohort.code}' already exists.`) };
  }

  const now = new Date().toISOString();
  const newCohort: Cohort = {
    id: cohort.id || `cohort-${Date.now()}`,
    program_id: cohort.program_id,
    name: cohort.name.trim(),
    code: cohort.code.trim().toUpperCase(),
    description: cohort.description || null,
    start_date: cohort.start_date || null,
    end_date: cohort.end_date || null,
    capacity: cohort.capacity ?? null,
    status: cohort.status || 'planned',
    created_by: cohort.created_by || 'mock-admin-ppa001',
    created_at: now,
    updated_at: now,
  };

  mockCohorts.push(newCohort);
  return { cohort: newCohort, error: null };
}

export function updateMockCohort(
  id: string,
  updates: CohortUpdate
): { cohort: Cohort | null; error: Error | null } {
  const index = mockCohorts.findIndex((c) => c.id === id);
  if (index === -1) {
    return { cohort: null, error: new Error('Cohort not found.') };
  }

  if (updates.code && updates.code.toUpperCase() !== mockCohorts[index].code) {
    const codeCollision = mockCohorts.find(
      (c) => c.code.toUpperCase() === updates.code?.trim().toUpperCase() && c.id !== id
    );
    if (codeCollision) {
      return { cohort: null, error: new Error(`Cohort code '${updates.code}' is already taken.`) };
    }
  }

  mockCohorts[index] = {
    ...mockCohorts[index],
    ...updates,
    code: updates.code ? updates.code.trim().toUpperCase() : mockCohorts[index].code,
    updated_at: new Date().toISOString(),
  };

  return { cohort: mockCohorts[index], error: null };
}

export function deleteMockCohort(id: string): { success: boolean; error: Error | null } {
  const index = mockCohorts.findIndex((c) => c.id === id);
  if (index === -1) {
    return { success: false, error: new Error('Cohort not found.') };
  }

  mockCohorts.splice(index, 1);
  return { success: true, error: null };
}

// --- Mock Curriculum CRUD Functions ---

export function getMockProgramCurriculum(programId: string): CurriculumSectionWithTopics[] {
  const sections = mockCurriculumSections
    .filter((s) => s.program_id === programId)
    .sort((a, b) => a.display_order - b.display_order);

  return sections.map((sec) => ({
    ...sec,
    topics: mockCurriculumTopics
      .filter((t) => t.section_id === sec.id)
      .sort((a, b) => a.display_order - b.display_order),
  }));
}

export function createMockCurriculumSection(
  section: ProgramCurriculumSectionInsert
): { section: ProgramCurriculumSection | null; error: Error | null } {
  const now = new Date().toISOString();
  const existingInProg = mockCurriculumSections.filter((s) => s.program_id === section.program_id);
  const newSection: ProgramCurriculumSection = {
    id: section.id || `sec-${Date.now()}`,
    program_id: section.program_id,
    title: section.title.trim(),
    description: section.description || null,
    display_order: section.display_order ?? (existingInProg.length + 1),
    created_at: now,
    updated_at: now,
  };

  mockCurriculumSections.push(newSection);
  return { section: newSection, error: null };
}

export function updateMockCurriculumSection(
  id: string,
  updates: ProgramCurriculumSectionUpdate
): { section: ProgramCurriculumSection | null; error: Error | null } {
  const index = mockCurriculumSections.findIndex((s) => s.id === id);
  if (index === -1) {
    return { section: null, error: new Error('Curriculum section not found.') };
  }

  mockCurriculumSections[index] = {
    ...mockCurriculumSections[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  return { section: mockCurriculumSections[index], error: null };
}

export function deleteMockCurriculumSection(id: string): { success: boolean; error: Error | null } {
  const index = mockCurriculumSections.findIndex((s) => s.id === id);
  if (index === -1) {
    return { success: false, error: new Error('Curriculum section not found.') };
  }

  // Delete associated topics
  for (let i = mockCurriculumTopics.length - 1; i >= 0; i--) {
    if (mockCurriculumTopics[i].section_id === id) {
      mockCurriculumTopics.splice(i, 1);
    }
  }

  mockCurriculumSections.splice(index, 1);
  return { success: true, error: null };
}

export function reorderMockCurriculumSections(
  programId: string,
  sectionIds: string[]
): { success: boolean; error: Error | null } {
  sectionIds.forEach((secId, idx) => {
    const sec = mockCurriculumSections.find((s) => s.id === secId && s.program_id === programId);
    if (sec) {
      sec.display_order = idx + 1;
      sec.updated_at = new Date().toISOString();
    }
  });

  return { success: true, error: null };
}

export function createMockCurriculumTopic(
  topic: ProgramCurriculumTopicInsert
): { topic: ProgramCurriculumTopic | null; error: Error | null } {
  const now = new Date().toISOString();
  const existingInSec = mockCurriculumTopics.filter((t) => t.section_id === topic.section_id);
  const newTopic: ProgramCurriculumTopic = {
    id: topic.id || `top-${Date.now()}`,
    section_id: topic.section_id,
    title: topic.title.trim(),
    description: topic.description || null,
    display_order: topic.display_order ?? (existingInSec.length + 1),
    created_at: now,
    updated_at: now,
  };

  mockCurriculumTopics.push(newTopic);
  return { topic: newTopic, error: null };
}

export function updateMockCurriculumTopic(
  id: string,
  updates: ProgramCurriculumTopicUpdate
): { topic: ProgramCurriculumTopic | null; error: Error | null } {
  const index = mockCurriculumTopics.findIndex((t) => t.id === id);
  if (index === -1) {
    return { topic: null, error: new Error('Curriculum topic not found.') };
  }

  mockCurriculumTopics[index] = {
    ...mockCurriculumTopics[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  return { topic: mockCurriculumTopics[index], error: null };
}

export function deleteMockCurriculumTopic(id: string): { success: boolean; error: Error | null } {
  const index = mockCurriculumTopics.findIndex((t) => t.id === id);
  if (index === -1) {
    return { success: false, error: new Error('Curriculum topic not found.') };
  }

  mockCurriculumTopics.splice(index, 1);
  return { success: true, error: null };
}

export function reorderMockCurriculumTopics(
  sectionId: string,
  topicIds: string[]
): { success: boolean; error: Error | null } {
  topicIds.forEach((tId, idx) => {
    const top = mockCurriculumTopics.find((t) => t.id === tId && t.section_id === sectionId);
    if (top) {
      top.display_order = idx + 1;
      top.updated_at = new Date().toISOString();
    }
  });

  return { success: true, error: null };
}

// ==============================================================================
// Milestone 3: Mock Program Applications & Enrollments Store
// ==============================================================================

const mockApplications: ProgramApplication[] = [
  {
    id: 'app-seed-01',
    applicant_id: 'mock-student-pp001',
    application_type: 'student',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    status: 'approved',
    application_message: 'I want to build a disciplined daily study routine for my 4th-semester CSE core courses and prepare systematically for final exams.',
    experience: 'Undergraduate student, completed 1st to 3rd semester coursework in Dhaka University CSE.',
    additional_information: 'Ready to dedicate 3 hours each evening to assigned task milestones.',
    admin_review_note: 'Verified student academic credentials. Cohort capacity available. Approved for Batch 67.',
    reviewed_by: 'mock-admin-ppa001',
    reviewed_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    submitted_at: new Date(Date.now() - 28 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 'app-seed-02',
    applicant_id: 'mock-student-pp002',
    application_type: 'student',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    status: 'pending',
    application_message: 'Looking for structured mentorship to navigate challenging circuit theory and advanced calculus topics.',
    experience: '2nd Semester student at BUET EEE.',
    additional_information: 'Can attend weekly evaluation checkpoints on Friday afternoons.',
    admin_review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'app-seed-03',
    applicant_id: 'mock-mentor-ppm001',
    application_type: 'mentor',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    status: 'approved',
    application_message: 'Experienced academic mentor offering guidance in Algorithms, Data Structures, and syllabus breakdown.',
    experience: 'Ph.D. in Computer Science with 8+ years undergraduate teaching and academic planning experience.',
    additional_information: 'Available for daily asynchronous doubt resolution and weekly task setting.',
    admin_review_note: 'Verified senior academic credentials. Approved as eligible mentor for Academic Mentorship 0.1.',
    reviewed_by: 'mock-admin-ppa001',
    reviewed_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    submitted_at: new Date(Date.now() - 29 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 29 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
];

const mockEnrollments: ProgramEnrollment[] = [
  {
    id: 'enr-seed-01',
    student_id: 'mock-student-pp001',
    program_id: 'prog-academic-01',
    cohort_id: 'cohort-uu-cse-b67',
    application_id: 'app-seed-01',
    status: 'active',
    enrolled_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
];

// --- Mock Applications Functions ---

export function getMockApplications(filters?: {
  applicantId?: string;
  programId?: string;
  cohortId?: string;
  status?: string;
  type?: string;
}): ProgramApplication[] {
  let list = [...mockApplications];

  if (filters?.applicantId) {
    list = list.filter((a) => a.applicant_id === filters.applicantId);
  }
  if (filters?.programId && filters.programId !== 'all') {
    list = list.filter((a) => a.program_id === filters.programId);
  }
  if (filters?.cohortId && filters.cohortId !== 'all') {
    list = list.filter((a) => a.cohort_id === filters.cohortId);
  }
  if (filters?.status && filters.status !== 'all') {
    list = list.filter((a) => a.status === filters.status);
  }
  if (filters?.type && filters.type !== 'all') {
    list = list.filter((a) => a.application_type === filters.type);
  }

  return list.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
}

export function getMockApplicationById(id: string): ProgramApplication | null {
  return mockApplications.find((a) => a.id === id) || null;
}

export function createMockApplication(
  app: ProgramApplicationInsert
): { application: ProgramApplication | null; error: Error | null } {
  // Check duplicate active application
  const existingActive = mockApplications.find(
    (a) =>
      a.applicant_id === app.applicant_id &&
      a.program_id === app.program_id &&
      (a.cohort_id || null) === (app.cohort_id || null) &&
      ['pending', 'under_review', 'approved'].includes(a.status)
  );

  if (existingActive) {
    return {
      application: null,
      error: new Error(`You already have an active application (${existingActive.status.replace('_', ' ')}) for this program.`),
    };
  }

  const now = new Date().toISOString();
  const newApp: ProgramApplication = {
    id: app.id || `app-${Date.now()}`,
    applicant_id: app.applicant_id,
    application_type: app.application_type,
    program_id: app.program_id,
    cohort_id: app.cohort_id || null,
    status: 'pending',
    application_message: app.application_message?.trim() || null,
    experience: app.experience?.trim() || null,
    additional_information: app.additional_information?.trim() || null,
    admin_review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    submitted_at: now,
    created_at: now,
    updated_at: now,
  };

  mockApplications.push(newApp);

  // Send in-app confirmation notification to applicant
  createMockNotification({
    recipientId: app.applicant_id,
    actorId: null,
    type: 'system',
    title: 'Application Received',
    message: `Your application to participate in the program has been submitted and is pending administrative review.`,
    link: app.application_type === 'student' ? '/student/applications' : '/mentor/applications',
  });

  return { application: newApp, error: null };
}

export function adminReviewMockApplication(
  adminId: string,
  applicationId: string,
  decision: 'under_review' | 'approved' | 'rejected',
  reviewNote?: string
): { success: boolean; message: string; enrollmentId?: string; error: Error | null } {
  const index = mockApplications.findIndex((a) => a.id === applicationId);
  if (index === -1) {
    return { success: false, message: 'Application not found.', error: new Error('Application not found.') };
  }

  const app = mockApplications[index];

  if (app.status === 'approved' && decision === 'approved') {
    return { success: false, message: 'Application already approved.', error: new Error('This application has already been approved.') };
  }

  const now = new Date().toISOString();

  if (decision === 'approved') {
    let enrollmentId: string | undefined = undefined;

    // Student approval creates an enrollment
    if (app.application_type === 'student') {
      // Check cohort capacity if cohort is assigned
      if (app.cohort_id) {
        const cohort = mockCohorts.find((c) => c.id === app.cohort_id);
        if (cohort && cohort.capacity) {
          const currentCount = mockEnrollments.filter(
            (e) => e.cohort_id === app.cohort_id && e.status === 'active'
          ).length;

          if (currentCount >= cohort.capacity) {
            return {
              success: false,
              message: `Cannot approve: Cohort capacity (${cohort.capacity} scholars) is full.`,
              error: new Error(`Cohort capacity (${cohort.capacity} scholars) is full.`),
            };
          }
        }
      }

      // Check duplicate active enrollment
      const isAlreadyEnrolled = mockEnrollments.some(
        (e) =>
          e.student_id === app.applicant_id &&
          e.program_id === app.program_id &&
          (e.cohort_id || null) === (app.cohort_id || null) &&
          ['active', 'on_hold'].includes(e.status)
      );

      if (isAlreadyEnrolled) {
        return {
          success: false,
          message: 'Student is already enrolled.',
          error: new Error('Student is already actively enrolled in this program/cohort.'),
        };
      }

      // Create enrollment
      enrollmentId = `enr-${Date.now()}`;
      mockEnrollments.push({
        id: enrollmentId,
        student_id: app.applicant_id,
        program_id: app.program_id,
        cohort_id: app.cohort_id || null,
        application_id: app.id,
        status: 'active',
        enrolled_at: now,
        created_at: now,
        updated_at: now,
      });

      // Send student notification
      createMockNotification({
        recipientId: app.applicant_id,
        actorId: adminId,
        type: 'system',
        title: 'Application Approved — You Are Enrolled!',
        message: 'Congratulations! Your program application has been approved by the administration and your active enrollment has been created.',
        link: '/student/applications',
      });
    } else {
      // Mentor approval notification
      createMockNotification({
        recipientId: app.applicant_id,
        actorId: adminId,
        type: 'system',
        title: 'Mentor Application Approved',
        message: 'Your mentor application has been approved! You are now eligible to mentor in this program. Cohort assignment will be coordinated by administration.',
        link: '/mentor/applications',
      });
    }

    mockApplications[index] = {
      ...app,
      status: 'approved',
      reviewed_by: adminId,
      reviewed_at: now,
      admin_review_note: reviewNote !== undefined ? reviewNote : app.admin_review_note,
      updated_at: now,
    };

    return {
      success: true,
      message: app.application_type === 'student'
        ? 'Application approved and student enrollment created.'
        : 'Mentor application approved.',
      enrollmentId,
      error: null,
    };
  }

  if (decision === 'rejected') {
    mockApplications[index] = {
      ...app,
      status: 'rejected',
      reviewed_by: adminId,
      reviewed_at: now,
      admin_review_note: reviewNote !== undefined ? reviewNote : app.admin_review_note,
      updated_at: now,
    };

    createMockNotification({
      recipientId: app.applicant_id,
      actorId: adminId,
      type: 'system',
      title: 'Application Update',
      message: 'Your program application has been reviewed and was not accepted for this intake. Check back for upcoming cohorts.',
      link: app.application_type === 'student' ? '/student/applications' : '/mentor/applications',
    });

    return { success: true, message: 'Application declined.', error: null };
  }

  // Under review
  mockApplications[index] = {
    ...app,
    status: 'under_review',
    admin_review_note: reviewNote !== undefined ? reviewNote : app.admin_review_note,
    updated_at: now,
  };

  return { success: true, message: 'Application status set to Under Review.', error: null };
}

// --- Mock Enrollments Functions ---

export function getMockEnrollments(filters?: {
  studentId?: string;
  programId?: string;
  cohortId?: string;
  status?: string;
}): ProgramEnrollment[] {
  let list = [...mockEnrollments];

  if (filters?.studentId) {
    list = list.filter((e) => e.student_id === filters.studentId);
  }
  if (filters?.programId && filters.programId !== 'all') {
    list = list.filter((e) => e.program_id === filters.programId);
  }
  if (filters?.cohortId && filters.cohortId !== 'all') {
    list = list.filter((e) => e.cohort_id === filters.cohortId);
  }
  if (filters?.status && filters.status !== 'all') {
    list = list.filter((e) => e.status === filters.status);
  }

  return list.sort((a, b) => new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime());
}

export function getMockEnrollmentById(id: string): ProgramEnrollment | null {
  return mockEnrollments.find((e) => e.id === id) || null;
}

export function updateMockEnrollmentStatus(
  id: string,
  status: EnrollmentStatus
): { enrollment: ProgramEnrollment | null; error: Error | null } {
  const index = mockEnrollments.findIndex((e) => e.id === id);
  if (index === -1) {
    return { enrollment: null, error: new Error('Enrollment not found.') };
  }

  mockEnrollments[index] = {
    ...mockEnrollments[index],
    status,
    updated_at: new Date().toISOString(),
  };

  return { enrollment: mockEnrollments[index], error: null };
}

// ==============================================================================
// Milestone 4: Mentor Assignment & Matching Mock Store
// ==============================================================================

export const mockCohortMentors: CohortMentor[] = [
  {
    id: 'cm-seed-01',
    cohort_id: 'cohort-uu-cse-b67',
    mentor_id: 'mock-mentor-ppm001',
    program_id: 'prog-academic-01',
    assigned_by: 'mock-admin-ppa001',
    assigned_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    ended_at: null,
    is_active: true,
    notes: 'Allocated as lead cohort mentor for Batch 67 CSE mentorship.',
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
];

export const mockStudentMentorAssignments: StudentMentorAssignment[] = [];

export function getMockCohortMentors(filters?: {
  cohortId?: string;
  programId?: string;
  mentorId?: string;
  isActive?: boolean;
}): CohortMentor[] {
  let list = [...mockCohortMentors];

  if (filters?.cohortId && filters.cohortId !== 'all') {
    list = list.filter((cm) => cm.cohort_id === filters.cohortId);
  }
  if (filters?.programId && filters.programId !== 'all') {
    list = list.filter((cm) => cm.program_id === filters.programId);
  }
  if (filters?.mentorId && filters.mentorId !== 'all') {
    list = list.filter((cm) => cm.mentor_id === filters.mentorId);
  }
  if (filters?.isActive !== undefined) {
    list = list.filter((cm) => cm.is_active === filters.isActive);
  }

  return list.sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());
}

export function getMockStudentMentorAssignments(filters?: {
  studentId?: string;
  programId?: string;
  mentorId?: string;
  isActive?: boolean;
}): StudentMentorAssignment[] {
  let list = [...mockStudentMentorAssignments];

  if (filters?.studentId && filters.studentId !== 'all') {
    list = list.filter((sma) => sma.student_id === filters.studentId);
  }
  if (filters?.programId && filters.programId !== 'all') {
    list = list.filter((sma) => sma.program_id === filters.programId);
  }
  if (filters?.mentorId && filters.mentorId !== 'all') {
    list = list.filter((sma) => sma.mentor_id === filters.mentorId);
  }
  if (filters?.isActive !== undefined) {
    list = list.filter((sma) => sma.is_active === filters.isActive);
  }

  return list.sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());
}

export function getMockCohortMentorById(id: string): CohortMentor | null {
  return mockCohortMentors.find((cm) => cm.id === id) || null;
}

export function getMockStudentMentorAssignmentById(id: string): StudentMentorAssignment | null {
  return mockStudentMentorAssignments.find((sma) => sma.id === id) || null;
}

/**
 * Resolves the effective mentor for a given student according to precedence:
 * Individual Override ?? Cohort Default ?? None
 *
 * Security Hardening (Milestone 5.1):
 * If callerId is provided, restricts access to:
 * 1. The student themselves (callerId === studentId)
 * 2. Platform Admin
 * 3. An authorized mentor for the student in the target program
 */
export function getMockEffectiveMentorForStudent(
  studentId: string,
  programId?: string,
  callerId?: string
): EffectiveMentorResolution {
  const normalizedStudentId = studentId === 'PP001' ? 'mock-student-pp001' : studentId;
  const normalizedCallerId = callerId === 'PP001' ? 'mock-student-pp001' : callerId === 'PPM001' ? 'mock-mentor-ppm001' : callerId;

  // Caller authorization verification
  if (normalizedCallerId) {
    const callerAcc = mockStore.find((u) => u.id === normalizedCallerId);
    const isAdmin = callerAcc?.role === 'admin' || normalizedCallerId === 'mock-admin-ppa001' || callerId === 'admin';
    if (!isAdmin && normalizedCallerId !== normalizedStudentId) {
      // MENTOR CALLER RULES (Milestone 5.2):
      // 1. Program ID is REQUIRED for mentor callers (no NULL program queries allowed)
      if (!programId) {
        return {
          student_id: studentId,
          mentor: null,
          assignment_type: 'none',
          assignment_id: null,
          cohort: null,
          program: null,
          assigned_at: null,
          notes: null,
        };
      }
      const isMentor = isMockAuthorizedMentorForStudent(normalizedCallerId, normalizedStudentId, programId);
      if (!isMentor) {
        return {
          student_id: studentId,
          mentor: null,
          assignment_type: 'none',
          assignment_id: null,
          cohort: null,
          program: null,
          assigned_at: null,
          notes: null,
        };
      }
    }
  }

  // 1. Check for active individual override
  const override = mockStudentMentorAssignments.find(
    (sma) => sma.student_id === studentId && sma.is_active && (!programId || sma.program_id === programId)
  );

  if (override) {
    const mentor = getMockProfile(override.mentor_id);
    const cohort = override.cohort_id
      ? getMockCohorts().find((c) => c.id === override.cohort_id) || null
      : null;
    const program = getMockProgramById(override.program_id);

    return {
      student_id: studentId,
      mentor,
      assignment_type: 'individual',
      assignment_id: override.id,
      cohort,
      program,
      assigned_at: override.assigned_at,
      notes: override.notes,
    };
  }

  // 2. Check student's active enrollment to locate cohort default mentor
  const enrollments = getMockEnrollments({ studentId, status: 'active' });
  const enrollment = programId
    ? enrollments.find((e) => e.program_id === programId)
    : enrollments[0];

  if (enrollment && enrollment.cohort_id) {
    const cohortMentor = mockCohortMentors.find(
      (cm) => cm.cohort_id === enrollment.cohort_id && cm.is_active
    );

    if (cohortMentor) {
      const mentor = getMockProfile(cohortMentor.mentor_id);
      const cohort = getMockCohorts().find((c) => c.id === cohortMentor.cohort_id) || null;
      const program = getMockProgramById(cohortMentor.program_id);

      return {
        student_id: studentId,
        mentor,
        assignment_type: 'cohort',
        assignment_id: cohortMentor.id,
        cohort,
        program,
        assigned_at: cohortMentor.assigned_at,
        notes: cohortMentor.notes,
      };
    }
  }

  // 3. No effective mentor found
  return {
    student_id: studentId,
    mentor: null,
    assignment_type: 'none',
    assignment_id: null,
    cohort: null,
    program: null,
    assigned_at: null,
    notes: null,
  };
}

/**
 * Returns all active students who effectively have this mentor assigned.
 * Respects individual overrides so mentors don't see overridden students.
 */
export function getMockEffectiveStudentsForMentor(mentorId: string): {
  student: Profile;
  cohort: Cohort | null;
  program: Program | null;
  assignmentType: 'individual' | 'cohort';
  assignedAt: string;
}[] {
  const result: {
    student: Profile;
    cohort: Cohort | null;
    program: Program | null;
    assignmentType: 'individual' | 'cohort';
    assignedAt: string;
  }[] = [];
  const processedStudentProgramKeys = new Set<string>();

  // 1. Students with active individual overrides pointing to this mentor
  const activeOverrides = mockStudentMentorAssignments.filter(
    (sma) => sma.mentor_id === mentorId && sma.is_active
  );

  for (const override of activeOverrides) {
    const student = getMockProfile(override.student_id);
    if (student) {
      const cohort = override.cohort_id
        ? getMockCohorts().find((c) => c.id === override.cohort_id) || null
        : null;
      const program = getMockProgramById(override.program_id);
      result.push({
        student,
        cohort,
        program,
        assignmentType: 'individual',
        assignedAt: override.assigned_at,
      });
      processedStudentProgramKeys.add(`${student.id}:${override.program_id}`);
    }
  }

  // 2. Students enrolled in cohorts where this mentor is the active cohort mentor
  const activeCohortAssignments = mockCohortMentors.filter(
    (cm) => cm.mentor_id === mentorId && cm.is_active
  );

  for (const cm of activeCohortAssignments) {
    const enrollments = getMockEnrollments({ cohortId: cm.cohort_id, status: 'active' });
    const cohort = getMockCohorts().find((c) => c.id === cm.cohort_id) || null;
    const program = getMockProgramById(cm.program_id);

    for (const enr of enrollments) {
      const studentProgramKey = `${enr.student_id}:${cm.program_id}`;
      if (processedStudentProgramKeys.has(studentProgramKey)) continue;

      // Check if student has an individual override to someone else in this specific program
      const hasOtherOverride = mockStudentMentorAssignments.some(
        (sma) =>
          sma.student_id === enr.student_id &&
          sma.program_id === cm.program_id &&
          sma.is_active &&
          sma.mentor_id !== mentorId
      );
      if (hasOtherOverride) continue;

      const student = getMockProfile(enr.student_id);
      if (student) {
        result.push({
          student,
          cohort,
          program,
          assignmentType: 'cohort',
          assignedAt: cm.assigned_at,
        });
        processedStudentProgramKeys.add(studentProgramKey);
      }
    }
  }

  return result;
}

/**
 * Evaluates whether a mentor is currently authorized to access/modify a student's records
 * for a specific program.
 * Mirrors database public.is_authorized_mentor_for_student.
 * Security Rules:
 * - Admin has platform-wide oversight.
 * - Suspended mentors are denied.
 * - Missing/null programId FAILS CLOSED for mentors to prevent cross-program data leakage.
 * - Precedence: Individual Override > Cohort Default > None.
 */
export function isMockAuthorizedMentorForStudent(
  mentorId: string,
  studentId: string,
  programId?: string | null,
  callerId?: string
): boolean {
  const normalizedMentorId = mentorId === 'PPM001' ? 'mock-mentor-ppm001' : mentorId;
  const normalizedStudentId = studentId === 'PP001' ? 'mock-student-pp001' : studentId;
  const normalizedCallerId = callerId === 'PP001' ? 'mock-student-pp001' : callerId === 'PPM001' ? 'mock-mentor-ppm001' : callerId;

  // Caller check if callerId provided (Security Hardening: prevent arbitrary caller probing)
  if (normalizedCallerId) {
    const callerAcc = mockStore.find((u) => u.id === normalizedCallerId);
    const isCallerAdmin = callerAcc?.role === 'admin' || normalizedCallerId === 'mock-admin-ppa001' || callerId === 'admin';
    if (!isCallerAdmin && normalizedCallerId !== normalizedMentorId && normalizedCallerId !== normalizedStudentId) {
      return false;
    }
  }

  // 1. Identify admin caller (platform-wide oversight)
  const callerAcc = mockStore.find((u) => u.id === normalizedMentorId);
  if (callerAcc?.role === 'admin' || normalizedMentorId === 'mock-admin-ppa001' || mentorId === 'admin') {
    return true;
  }

  // 2. Validate mentor role and account status (suspended or non-mentors are denied)
  if (!callerAcc || callerAcc.role !== 'mentor' || callerAcc.status === 'suspended') {
    return false;
  }

  // 3. Fail Closed on missing / null programId for mentors!
  // Unscoped / ambiguous records are restricted from mentor access.
  if (!programId) {
    return false;
  }

  // 4. Resolve the student's active enrollment in the requested program
  const activeEnrollments = getMockEnrollments({
    studentId: normalizedStudentId,
    status: 'active',
  }).filter((e) => e.program_id === programId);

  if (activeEnrollments.length === 0) {
    return false;
  }

  // 5. Check active individual override first (Precedence: Override > Default)
  const activeOverride = mockStudentMentorAssignments.find(
    (sma) => sma.student_id === normalizedStudentId && sma.program_id === programId && sma.is_active
  );

  if (activeOverride) {
    // Only the assigned override mentor has operational access; cohort default or former mentors are denied!
    return activeOverride.mentor_id === normalizedMentorId;
  }

  // 6. Check active cohort-level assignment
  for (const enr of activeEnrollments) {
    if (enr.cohort_id) {
      const isCohortMentor = mockCohortMentors.some(
        (cm) =>
          cm.cohort_id === enr.cohort_id &&
          cm.mentor_id === normalizedMentorId &&
          cm.program_id === programId &&
          cm.is_active
      );
      if (isCohortMentor) return true;
    }
  }

  return false;
}

/**
 * Filter mentors who have an approved application for the target program
 * and active mentor account status.
 */
export function getMockEligibleMentorsForProgram(programId: string): Profile[] {
  // Find approved mentor applications for program
  const approvedMentorApps = mockApplications.filter(
    (app) =>
      app.program_id === programId &&
      app.application_type === 'mentor' &&
      app.status === 'approved'
  );

  const eligibleMentorIds = new Set(approvedMentorApps.map((a) => a.applicant_id));

  return mockStore
    .filter(
      (acc) =>
        acc.role === 'mentor' &&
        acc.status !== 'suspended' &&
        eligibleMentorIds.has(acc.id)
    )
    .map((acc) => getMockProfile(acc.id)!)
    .filter(Boolean);
}

/**
 * Admin action: Assign or replace cohort mentor.
 */
export function adminAssignMockCohortMentor(
  cohortId: string,
  mentorId: string,
  notes?: string
): { success: boolean; message: string; assignmentId?: string } {
  const cohort = getMockCohorts().find((c) => c.id === cohortId);
  if (!cohort) {
    return { success: false, message: 'Cohort not found.' };
  }
  if (cohort.status === 'completed' || cohort.status === 'archived') {
    return { success: false, message: 'Cannot assign a mentor to an archived or completed cohort.' };
  }

  const mentor = mockStore.find((m) => m.id === mentorId);
  if (!mentor || mentor.role !== 'mentor') {
    return { success: false, message: 'Selected user is not an active mentor.' };
  }
  if (mentor.status === 'suspended') {
    return { success: false, message: 'Cannot assign a suspended mentor.' };
  }

  // Validate approved mentor application for target program
  const hasApprovedApp = mockApplications.some(
    (a) =>
      a.applicant_id === mentorId &&
      a.program_id === cohort.program_id &&
      a.application_type === 'mentor' &&
      a.status === 'approved'
  );
  if (!hasApprovedApp) {
    return {
      success: false,
      message: 'Mentor does not have an approved application for this program.',
    };
  }

  // Deactivate existing active assignment for this cohort
  const existingActive = mockCohortMentors.find(
    (cm) => cm.cohort_id === cohortId && cm.is_active
  );
  if (existingActive) {
    existingActive.is_active = false;
    existingActive.ended_at = new Date().toISOString();
    existingActive.updated_at = new Date().toISOString();
    existingActive.notes = existingActive.notes
      ? `${existingActive.notes}\n[Replaced by admin]`
      : '[Replaced by admin]';
  }

  const newAssignment: CohortMentor = {
    id: `cm-${Date.now()}`,
    cohort_id: cohortId,
    mentor_id: mentorId,
    program_id: cohort.program_id,
    assigned_by: 'mock-admin-ppa001',
    assigned_at: new Date().toISOString(),
    ended_at: null,
    is_active: true,
    notes: notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mockCohortMentors.push(newAssignment);
  return {
    success: true,
    message: 'Cohort mentor assigned successfully.',
    assignmentId: newAssignment.id,
  };
}

/**
 * Admin action: End cohort mentor assignment.
 */
export function adminEndMockCohortMentor(
  cohortId: string,
  notes?: string
): { success: boolean; message: string } {
  const active = mockCohortMentors.find((cm) => cm.cohort_id === cohortId && cm.is_active);
  if (!active) {
    return { success: false, message: 'No active mentor found for this cohort.' };
  }

  active.is_active = false;
  active.ended_at = new Date().toISOString();
  active.updated_at = new Date().toISOString();
  if (notes) {
    active.notes = active.notes ? `${active.notes}\n${notes}` : notes;
  }

  return { success: true, message: 'Cohort mentor assignment ended.' };
}

/**
 * Admin action: Assign or replace individual student mentor override.
 */
export function adminAssignMockIndividualMentor(
  studentId: string,
  mentorId: string,
  programId: string,
  cohortId?: string,
  notes?: string
): { success: boolean; message: string; assignmentId?: string } {
  if (studentId === mentorId) {
    return { success: false, message: 'Student and Mentor cannot be the same user.' };
  }

  // Validate student is actively enrolled
  const activeEnrollment = mockEnrollments.find(
    (e) => e.student_id === studentId && e.program_id === programId && e.status === 'active'
  );
  if (!activeEnrollment) {
    return { success: false, message: 'Student is not actively enrolled in this program.' };
  }

  // Enforce cohort validation (Strict Milestone 5.2 rules)
  let resolvedCohortId = activeEnrollment.cohort_id || null;
  if (cohortId) {
    const cohortObj = getMockCohorts().find((c) => c.id === cohortId && c.program_id === programId);
    if (!cohortObj) {
      return { success: false, message: 'Specified cohort does not belong to the selected program.' };
    }
    // If student enrollment has no cohort, reject arbitrary cohort assignment
    if (!activeEnrollment.cohort_id) {
      return { success: false, message: 'Student is enrolled without a cohort; cannot assign a cohort-specific mentor.' };
    }
    if (activeEnrollment.cohort_id !== cohortId) {
      return { success: false, message: 'Specified cohort does not match student active enrollment cohort.' };
    }
    resolvedCohortId = cohortId;
  }

  const mentor = mockStore.find((m) => m.id === mentorId);
  if (!mentor || mentor.role !== 'mentor') {
    return { success: false, message: 'Selected user is not an active mentor.' };
  }
  if (mentor.status === 'suspended') {
    return { success: false, message: 'Cannot assign a suspended mentor.' };
  }

  // Validate approved application
  const hasApprovedApp = mockApplications.some(
    (a) =>
      a.applicant_id === mentorId &&
      a.program_id === programId &&
      a.application_type === 'mentor' &&
      a.status === 'approved'
  );
  if (!hasApprovedApp) {
    return {
      success: false,
      message: 'Mentor does not have an approved application for this program.',
    };
  }

  // Deactivate any existing active individual override for this student in this program
  const existingOverride = mockStudentMentorAssignments.find(
    (sma) => sma.student_id === studentId && sma.program_id === programId && sma.is_active
  );
  if (existingOverride) {
    existingOverride.is_active = false;
    existingOverride.ended_at = new Date().toISOString();
    existingOverride.updated_at = new Date().toISOString();
    existingOverride.notes = existingOverride.notes
      ? `${existingOverride.notes}\n[Replaced by admin]`
      : '[Replaced by admin]';
  }

  const newAssignment: StudentMentorAssignment = {
    id: `sma-${Date.now()}`,
    student_id: studentId,
    mentor_id: mentorId,
    program_id: programId,
    cohort_id: resolvedCohortId,
    assignment_type: 'individual',
    assigned_by: 'mock-admin-ppa001',
    assigned_at: new Date().toISOString(),
    ended_at: null,
    is_active: true,
    notes: notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mockStudentMentorAssignments.push(newAssignment);
  return {
    success: true,
    message: 'Individual mentor override assigned successfully.',
    assignmentId: newAssignment.id,
  };
}

/**
 * Admin action: End individual student override, restoring cohort default.
 */
export function adminEndMockIndividualMentor(
  assignmentId: string,
  notes?: string
): { success: boolean; message: string } {
  const active = mockStudentMentorAssignments.find((sma) => sma.id === assignmentId && sma.is_active);
  if (!active) {
    return { success: false, message: 'Active individual assignment not found.' };
  }

  active.is_active = false;
  active.ended_at = new Date().toISOString();
  active.updated_at = new Date().toISOString();
  if (notes) {
    active.notes = active.notes ? `${active.notes}\n${notes}` : notes;
  }

  return {
    success: true,
    message: 'Individual override ended. Student reverted to cohort default mentor.',
  };
}

/**
 * Workload distribution summary for all mentor accounts.
 */
export function getMockMentorWorkload(): MentorWorkloadSummary[] {
  const mentors = mockStore.filter((acc) => acc.role === 'mentor');

  return mentors.map((acc) => {
    const mentorProfile = getMockProfile(acc.id)!;
    const activeCohorts = mockCohortMentors.filter((cm) => cm.mentor_id === acc.id && cm.is_active);
    const individualOverrides = mockStudentMentorAssignments.filter(
      (sma) => sma.mentor_id === acc.id && sma.is_active
    );
    const effectiveMentees = getMockEffectiveStudentsForMentor(acc.id);

    const cohortsDetail = activeCohorts.map((cm) => {
      const cohort = getMockCohorts().find((c) => c.id === cm.cohort_id);
      const prog = getMockProgramById(cm.program_id);
      const studentCount = getMockEnrollments({ cohortId: cm.cohort_id, status: 'active' }).length;
      return {
        id: cm.cohort_id,
        name: cohort?.name || 'Cohort',
        code: cohort?.code || 'N/A',
        programName: prog?.name || 'Program',
        studentCount,
      };
    });

    const isEligible = mockApplications.some(
      (a) => a.applicant_id === acc.id && a.application_type === 'mentor' && a.status === 'approved'
    );

    return {
      mentor: mentorProfile,
      activeCohortsCount: activeCohorts.length,
      individualOverridesCount: individualOverrides.length,
      totalEffectiveMenteesCount: effectiveMentees.length,
      cohorts: cohortsDetail,
      isEligible,
    };
  });
}
