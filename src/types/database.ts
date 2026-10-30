export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'student' | 'mentor' | 'admin';
export type AccountStatus = 'not_activated' | 'active' | 'suspended';

export type Profile = {
  id: string;
  poraplan_id?: string | null;
  full_name: string;
  email: string;
  linked_email?: string | null;
  role: UserRole;
  status?: AccountStatus;
  avatar_url?: string | null;
  whatsapp_number?: string | null;
  university?: string | null;
  department?: string | null;
  batch?: string | null;
  current_semester?: string | null;
  academic_background?: string | null;
  expertise?: string | null;
  mentoring_subjects?: string | null;
  bio?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProfileInsert = {
  id: string;
  poraplan_id?: string | null;
  full_name: string;
  email: string;
  linked_email?: string | null;
  role?: UserRole;
  status?: AccountStatus;
  avatar_url?: string | null;
  whatsapp_number?: string | null;
  university?: string | null;
  department?: string | null;
  batch?: string | null;
  current_semester?: string | null;
  academic_background?: string | null;
  expertise?: string | null;
  mentoring_subjects?: string | null;
  bio?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProfileUpdate = {
  id?: string;
  poraplan_id?: string | null;
  full_name?: string;
  email?: string;
  linked_email?: string | null;
  role?: UserRole;
  status?: AccountStatus;
  avatar_url?: string | null;
  whatsapp_number?: string | null;
  university?: string | null;
  department?: string | null;
  batch?: string | null;
  current_semester?: string | null;
  academic_background?: string | null;
  expertise?: string | null;
  mentoring_subjects?: string | null;
  bio?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProgramCategory = 'academic_mentorship' | 'skillsprint';
export type ProgramPublicationStatus = 'draft' | 'published' | 'archived';
export type ProgramEnrollmentStatus = 'open' | 'closed';
export type CohortStatus = 'planned' | 'active' | 'completed' | 'archived';

export type Program = {
  id: string;
  name: string;
  slug: string;
  category: ProgramCategory;
  short_description: string;
  description?: string | null;
  learning_objectives: string[];
  target_audience?: string | null;
  prerequisites?: string | null;
  duration?: string | null;
  delivery_mode?: string | null;
  cover_image_url?: string | null;
  publication_status: ProgramPublicationStatus;
  enrollment_status: ProgramEnrollmentStatus;
  display_order: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProgramInsert = {
  id?: string;
  name: string;
  slug: string;
  category: ProgramCategory;
  short_description: string;
  description?: string | null;
  learning_objectives?: string[];
  target_audience?: string | null;
  prerequisites?: string | null;
  duration?: string | null;
  delivery_mode?: string | null;
  cover_image_url?: string | null;
  publication_status?: ProgramPublicationStatus;
  enrollment_status?: ProgramEnrollmentStatus;
  display_order?: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProgramUpdate = Partial<ProgramInsert>;

export type Cohort = {
  id: string;
  program_id: string;
  name: string;
  code: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  capacity?: number | null;
  status: CohortStatus;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CohortInsert = {
  id?: string;
  program_id: string;
  name: string;
  code: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  capacity?: number | null;
  status?: CohortStatus;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CohortUpdate = Partial<CohortInsert>;

export type ProgramCurriculumSection = {
  id: string;
  program_id: string;
  title: string;
  description?: string | null;
  display_order: number;
  created_at?: string;
  updated_at?: string;
};

export type ProgramCurriculumSectionInsert = {
  id?: string;
  program_id: string;
  title: string;
  description?: string | null;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type ProgramCurriculumSectionUpdate = Partial<ProgramCurriculumSectionInsert>;

export type ProgramCurriculumTopic = {
  id: string;
  section_id: string;
  title: string;
  description?: string | null;
  display_order: number;
  created_at?: string;
  updated_at?: string;
};

export type ProgramCurriculumTopicInsert = {
  id?: string;
  section_id: string;
  title: string;
  description?: string | null;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type ProgramCurriculumTopicUpdate = Partial<ProgramCurriculumTopicInsert>;

export type CurriculumSectionWithTopics = ProgramCurriculumSection & {
  topics: ProgramCurriculumTopic[];
};

export type ProgramWithCurriculumAndCohorts = Program & {
  cohorts: Cohort[];
  curriculum: CurriculumSectionWithTopics[];
};

export type ApplicationType = 'student' | 'mentor';
export type ApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected';
export type EnrollmentStatus = 'active' | 'on_hold' | 'completed' | 'withdrawn';

export type ProgramApplication = {
  id: string;
  applicant_id: string;
  application_type: ApplicationType;
  program_id: string;
  cohort_id?: string | null;
  status: ApplicationStatus;
  application_message?: string | null;
  experience?: string | null;
  additional_information?: string | null;
  admin_review_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  submitted_at: string;
  created_at?: string;
  updated_at?: string;
};

export type ProgramApplicationInsert = {
  id?: string;
  applicant_id: string;
  application_type: ApplicationType;
  program_id: string;
  cohort_id?: string | null;
  status?: ApplicationStatus;
  application_message?: string | null;
  experience?: string | null;
  additional_information?: string | null;
  admin_review_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  submitted_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProgramApplicationUpdate = Partial<ProgramApplicationInsert>;

export type ProgramEnrollment = {
  id: string;
  student_id: string;
  program_id: string;
  cohort_id?: string | null;
  application_id?: string | null;
  status: EnrollmentStatus;
  enrolled_at: string;
  created_at?: string;
  updated_at?: string;
};

export type ProgramEnrollmentInsert = {
  id?: string;
  student_id: string;
  program_id: string;
  cohort_id?: string | null;
  application_id?: string | null;
  status?: EnrollmentStatus;
  enrolled_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProgramEnrollmentUpdate = Partial<ProgramEnrollmentInsert>;

export type ProgramApplicationWithMeta = ProgramApplication & {
  applicant?: Profile | null;
  program?: Program | null;
  cohort?: Cohort | null;
  reviewer?: Profile | null;
  enrollment?: ProgramEnrollment | null;
};

export type ProgramEnrollmentWithMeta = ProgramEnrollment & {
  student?: Profile | null;
  program?: Program | null;
  cohort?: Cohort | null;
  application?: ProgramApplication | null;
};

export type MentorStudent = {
  mentor_id: string;
  student_id: string;
  program_id?: string | null;
  status?: string;
  created_at?: string;
};

export type CohortMentor = {
  id: string;
  cohort_id: string;
  mentor_id: string;
  program_id: string;
  assigned_by?: string | null;
  assigned_at: string;
  ended_at?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CohortMentorInsert = {
  id?: string;
  cohort_id: string;
  mentor_id: string;
  program_id: string;
  assigned_by?: string | null;
  assigned_at?: string;
  ended_at?: string | null;
  is_active?: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CohortMentorUpdate = Partial<CohortMentorInsert>;

export type StudentMentorAssignment = {
  id: string;
  student_id: string;
  mentor_id: string;
  program_id: string;
  cohort_id?: string | null;
  assignment_type: 'individual';
  assigned_by?: string | null;
  assigned_at: string;
  ended_at?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type StudentMentorAssignmentInsert = {
  id?: string;
  student_id: string;
  mentor_id: string;
  program_id: string;
  cohort_id?: string | null;
  assignment_type?: 'individual';
  assigned_by?: string | null;
  assigned_at?: string;
  ended_at?: string | null;
  is_active?: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type StudentMentorAssignmentUpdate = Partial<StudentMentorAssignmentInsert>;

export type AssignmentLevel = 'individual' | 'cohort' | 'none';

export type EffectiveMentorResolution = {
  student_id: string;
  mentor: Profile | null;
  assignment_type: AssignmentLevel;
  assignment_id?: string | null;
  cohort_id?: string | null;
  program_id?: string | null;
  cohort?: Cohort | null;
  program?: Program | null;
  assigned_at?: string | null;
  notes?: string | null;
};

export type CohortMentorWithMeta = CohortMentor & {
  mentor?: Profile | null;
  cohort?: Cohort | null;
  program?: Program | null;
  assigned_by_profile?: Profile | null;
  enrolled_students_count?: number;
};

export type StudentMentorAssignmentWithMeta = StudentMentorAssignment & {
  student?: Profile | null;
  mentor?: Profile | null;
  cohort?: Cohort | null;
  program?: Program | null;
  assigned_by_profile?: Profile | null;
};

export type MentorWorkloadSummary = {
  mentor: Profile;
  activeCohortsCount: number;
  individualOverridesCount: number;
  totalEffectiveMenteesCount: number;
  cohorts: { id: string; name: string; code: string; programName: string; studentCount: number }[];
  isEligible: boolean;
};

export type SubjectStatus = 'active' | 'archived';

export type Subject = {
  id: string;
  student_id: string;
  created_by?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  name: string;
  code?: string | null;
  description?: string | null;
  status: SubjectStatus;
  created_at?: string;
  updated_at?: string;
};

export type SubjectInsert = {
  id?: string;
  student_id: string;
  created_by?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  name: string;
  code?: string | null;
  description?: string | null;
  status?: SubjectStatus;
  created_at?: string;
  updated_at?: string;
};

export type SubjectUpdate = {
  id?: string;
  student_id?: string;
  created_by?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  name?: string;
  code?: string | null;
  description?: string | null;
  status?: SubjectStatus;
  created_at?: string;
  updated_at?: string;
};

export type StudyPlanStatus = 'active' | 'completed' | 'archived';
export type StudyPlanItemStatus = 'pending' | 'in_progress' | 'completed';

export type StudyPlan = {
  id: string;
  student_id: string;
  created_by?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  title: string;
  description?: string | null;
  status: StudyPlanStatus;
  created_at?: string;
  updated_at?: string;
};

export type StudyPlanInsert = {
  id?: string;
  student_id: string;
  created_by?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  title: string;
  description?: string | null;
  status?: StudyPlanStatus;
  created_at?: string;
  updated_at?: string;
};

export type StudyPlanUpdate = {
  id?: string;
  student_id?: string;
  created_by?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  title?: string;
  description?: string | null;
  status?: StudyPlanStatus;
  created_at?: string;
  updated_at?: string;
};

export type StudyPlanItem = {
  id: string;
  plan_id: string;
  title: string;
  instructions?: string | null;
  estimated_minutes?: number | null;
  target_date?: string | null;
  item_order: number;
  status: StudyPlanItemStatus;
  created_at?: string;
  updated_at?: string;
};

export type StudyPlanItemInsert = {
  id?: string;
  plan_id: string;
  title: string;
  instructions?: string | null;
  estimated_minutes?: number | null;
  target_date?: string | null;
  item_order?: number;
  status?: StudyPlanItemStatus;
  created_at?: string;
  updated_at?: string;
};

export type StudyPlanItemUpdate = {
  id?: string;
  plan_id?: string;
  title?: string;
  instructions?: string | null;
  estimated_minutes?: number | null;
  target_date?: string | null;
  item_order?: number;
  status?: StudyPlanItemStatus;
  created_at?: string;
  updated_at?: string;
};

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type Task = {
  id: string;
  student_id: string;
  created_by?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string | null;
  estimated_minutes?: number | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TaskInsert = {
  id?: string;
  student_id: string;
  created_by?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string | null;
  estimated_minutes?: number | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TaskUpdate = {
  id?: string;
  student_id?: string;
  created_by?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string | null;
  estimated_minutes?: number | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AssignmentStatus = 'draft' | 'published' | 'closed' | 'archived';
export type SubmissionType = 'text' | 'link' | 'file';
export type SubmissionStatus = 'submitted' | 'under_review' | 'reviewed' | 'needs_revision';

export type Assignment = {
  id: string;
  student_id: string;
  mentor_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  title: string;
  instructions?: string | null;
  due_date?: string | null;
  total_points?: number | null;
  status: AssignmentStatus;
  created_at?: string;
  updated_at?: string;
};

export type AssignmentInsert = {
  id?: string;
  student_id: string;
  mentor_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  title: string;
  instructions?: string | null;
  due_date?: string | null;
  total_points?: number | null;
  status?: AssignmentStatus;
  created_at?: string;
  updated_at?: string;
};

export type AssignmentUpdate = {
  id?: string;
  student_id?: string;
  mentor_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  title?: string;
  instructions?: string | null;
  due_date?: string | null;
  total_points?: number | null;
  status?: AssignmentStatus;
  created_at?: string;
  updated_at?: string;
};

export type Submission = {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_type: SubmissionType;
  content: string;
  link_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  status: SubmissionStatus;
  feedback?: string | null;
  score?: number | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  submitted_at?: string;
  updated_at?: string;
};

export type SubmissionInsert = {
  id?: string;
  assignment_id: string;
  student_id: string;
  submission_type?: SubmissionType;
  content: string;
  link_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  status?: SubmissionStatus;
  feedback?: string | null;
  score?: number | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  submitted_at?: string;
  updated_at?: string;
};

export type SubmissionUpdate = {
  id?: string;
  assignment_id?: string;
  student_id?: string;
  submission_type?: SubmissionType;
  content?: string;
  link_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  status?: SubmissionStatus;
  feedback?: string | null;
  score?: number | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  submitted_at?: string;
  updated_at?: string;
};

export type EvaluationFormat = 'oral' | 'written' | 'practical';
export type EvaluationStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type Evaluation = {
  id: string;
  student_id: string;
  mentor_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  assignment_id?: string | null;
  title: string;
  description?: string | null;
  format: EvaluationFormat;
  status: EvaluationStatus;
  scheduled_date: string;
  scheduled_time?: string | null;
  duration_minutes?: number | null;
  total_points?: number | null;
  score?: number | null;
  feedback?: string | null;
  recommendation?: string | null;
  evaluated_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type EvaluationInsert = {
  id?: string;
  student_id: string;
  mentor_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  assignment_id?: string | null;
  title: string;
  description?: string | null;
  format?: EvaluationFormat;
  status?: EvaluationStatus;
  scheduled_date: string;
  scheduled_time?: string | null;
  duration_minutes?: number | null;
  total_points?: number | null;
  score?: number | null;
  feedback?: string | null;
  recommendation?: string | null;
  evaluated_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type EvaluationUpdate = {
  id?: string;
  student_id?: string;
  mentor_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  assignment_id?: string | null;
  title?: string;
  description?: string | null;
  format?: EvaluationFormat;
  status?: EvaluationStatus;
  scheduled_date?: string;
  scheduled_time?: string | null;
  duration_minutes?: number | null;
  total_points?: number | null;
  score?: number | null;
  feedback?: string | null;
  recommendation?: string | null;
  evaluated_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ResourceType = 'link' | 'file' | 'note';
export type ResourceStatus = 'active' | 'archived';

export type Resource = {
  id: string;
  student_id: string;
  mentor_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  title: string;
  description?: string | null;
  resource_type: ResourceType;
  url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  content?: string | null;
  status: ResourceStatus;
  created_at?: string;
  updated_at?: string;
};

export type ResourceInsert = {
  id?: string;
  student_id: string;
  mentor_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  title: string;
  description?: string | null;
  resource_type?: ResourceType;
  url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  content?: string | null;
  status?: ResourceStatus;
  created_at?: string;
  updated_at?: string;
};

export type ResourceUpdate = {
  id?: string;
  student_id?: string;
  mentor_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  title?: string;
  description?: string | null;
  resource_type?: ResourceType;
  url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  content?: string | null;
  status?: ResourceStatus;
  created_at?: string;
  updated_at?: string;
};

export type DoubtStatus = 'open' | 'answered' | 'resolved';
export type DoubtPriority = 'low' | 'normal' | 'high' | 'urgent';

export type Doubt = {
  id: string;
  student_id: string;
  mentor_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  task_id?: string | null;
  assignment_id?: string | null;
  title: string;
  question: string;
  priority: DoubtPriority;
  status: DoubtStatus;
  resolved_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DoubtInsert = {
  id?: string;
  student_id: string;
  mentor_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  task_id?: string | null;
  assignment_id?: string | null;
  title: string;
  question: string;
  priority?: DoubtPriority;
  status?: DoubtStatus;
  resolved_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DoubtUpdate = {
  id?: string;
  student_id?: string;
  mentor_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  subject_id?: string | null;
  plan_id?: string | null;
  task_id?: string | null;
  assignment_id?: string | null;
  title?: string;
  question?: string;
  priority?: DoubtPriority;
  status?: DoubtStatus;
  resolved_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DoubtResponse = {
  id: string;
  doubt_id: string;
  author_id: string;
  message: string;
  created_at?: string;
};

export type DoubtResponseInsert = {
  id?: string;
  doubt_id: string;
  author_id: string;
  message: string;
  created_at?: string;
};

export type AnnouncementScope = 'individual' | 'assigned_students' | 'platform';
export type AnnouncementPriority = 'normal' | 'important' | 'urgent';
export type AnnouncementStatus = 'published' | 'archived';

export type Announcement = {
  id: string;
  author_id: string;
  title: string;
  content: string;
  target_scope: AnnouncementScope;
  program_id?: string | null;
  cohort_id?: string | null;
  student_id?: string | null;
  subject_id?: string | null;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  published_at: string;
  created_at?: string;
  updated_at?: string;
};

export type AnnouncementInsert = {
  id?: string;
  author_id: string;
  title: string;
  content: string;
  target_scope?: AnnouncementScope;
  program_id?: string | null;
  cohort_id?: string | null;
  student_id?: string | null;
  subject_id?: string | null;
  priority?: AnnouncementPriority;
  status?: AnnouncementStatus;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type AnnouncementUpdate = {
  id?: string;
  author_id?: string;
  title?: string;
  content?: string;
  target_scope?: AnnouncementScope;
  program_id?: string | null;
  cohort_id?: string | null;
  student_id?: string | null;
  subject_id?: string | null;
  priority?: AnnouncementPriority;
  status?: AnnouncementStatus;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type AnnouncementAcknowledgment = {
  id: string;
  announcement_id: string;
  student_id: string;
  acknowledged_at: string;
};

export type AnnouncementAcknowledgmentInsert = {
  id?: string;
  announcement_id: string;
  student_id: string;
  acknowledged_at?: string;
};

export type NotificationType =
  | 'task_created'
  | 'assignment_created'
  | 'resource_published'
  | 'evaluation_published'
  | 'submission_reviewed'
  | 'doubt_replied'
  | 'announcement_published'
  | 'plan_updated'
  | 'system';

export type Notification = {
  id: string;
  recipient_id: string;
  actor_id?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  read_at?: string | null;
  idempotency_key?: string | null;
  created_at: string;
};

export type NotificationInsert = {
  id?: string;
  recipient_id: string;
  actor_id?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  read?: boolean;
  read_at?: string | null;
  idempotency_key?: string | null;
  created_at?: string;
};

export type NotificationUpdate = {
  id?: string;
  recipient_id?: string;
  actor_id?: string | null;
  type?: NotificationType;
  title?: string;
  message?: string;
  link?: string | null;
  read?: boolean;
  read_at?: string | null;
  idempotency_key?: string | null;
  created_at?: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      mentor_students: {
        Row: MentorStudent;
        Insert: {
          mentor_id: string;
          student_id: string;
          program_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          mentor_id?: string;
          student_id?: string;
          program_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mentor_students_mentor_id_fkey';
            columns: ['mentor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mentor_students_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      subjects: {
        Row: Subject;
        Insert: SubjectInsert;
        Update: SubjectUpdate;
        Relationships: [
          {
            foreignKeyName: 'subjects_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subjects_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      study_plans: {
        Row: StudyPlan;
        Insert: StudyPlanInsert;
        Update: StudyPlanUpdate;
        Relationships: [
          {
            foreignKeyName: 'study_plans_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'study_plans_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'study_plans_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          }
        ];
      };
      study_plan_items: {
        Row: StudyPlanItem;
        Insert: StudyPlanItemInsert;
        Update: StudyPlanItemUpdate;
        Relationships: [
          {
            foreignKeyName: 'study_plan_items_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'study_plans';
            referencedColumns: ['id'];
          }
        ];
      };
      tasks: {
        Row: Task;
        Insert: TaskInsert;
        Update: TaskUpdate;
        Relationships: [
          {
            foreignKeyName: 'tasks_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'study_plans';
            referencedColumns: ['id'];
          }
        ];
      };
      assignments: {
        Row: Assignment;
        Insert: AssignmentInsert;
        Update: AssignmentUpdate;
        Relationships: [
          {
            foreignKeyName: 'assignments_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_mentor_id_fkey';
            columns: ['mentor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'study_plans';
            referencedColumns: ['id'];
          }
        ];
      };
      submissions: {
        Row: Submission;
        Insert: SubmissionInsert;
        Update: SubmissionUpdate;
        Relationships: [
          {
            foreignKeyName: 'submissions_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submissions_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      evaluations: {
        Row: Evaluation;
        Insert: EvaluationInsert;
        Update: EvaluationUpdate;
        Relationships: [
          {
            foreignKeyName: 'evaluations_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evaluations_mentor_id_fkey';
            columns: ['mentor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evaluations_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evaluations_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'study_plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evaluations_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          }
        ];
      };
      resources: {
        Row: Resource;
        Insert: ResourceInsert;
        Update: ResourceUpdate;
        Relationships: [
          {
            foreignKeyName: 'resources_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resources_mentor_id_fkey';
            columns: ['mentor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resources_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resources_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'study_plans';
            referencedColumns: ['id'];
          }
        ];
      };
      doubts: {
        Row: Doubt;
        Insert: DoubtInsert;
        Update: DoubtUpdate;
        Relationships: [
          {
            foreignKeyName: 'doubts_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'doubts_mentor_id_fkey';
            columns: ['mentor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'doubts_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'doubts_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'study_plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'doubts_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'doubts_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          }
        ];
      };
      doubt_responses: {
        Row: DoubtResponse;
        Insert: DoubtResponseInsert;
        Update: Partial<DoubtResponseInsert>;
        Relationships: [
          {
            foreignKeyName: 'doubt_responses_doubt_id_fkey';
            columns: ['doubt_id'];
            isOneToOne: false;
            referencedRelation: 'doubts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'doubt_responses_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      announcements: {
        Row: Announcement;
        Insert: AnnouncementInsert;
        Update: AnnouncementUpdate;
        Relationships: [
          {
            foreignKeyName: 'announcements_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'announcements_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'announcements_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          }
        ];
      };
      announcement_acknowledgments: {
        Row: AnnouncementAcknowledgment;
        Insert: AnnouncementAcknowledgmentInsert;
        Update: Partial<AnnouncementAcknowledgmentInsert>;
        Relationships: [
          {
            foreignKeyName: 'announcement_acknowledgments_announcement_id_fkey';
            columns: ['announcement_id'];
            isOneToOne: false;
            referencedRelation: 'announcements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'announcement_acknowledgments_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      notifications: {
        Row: Notification;
        Insert: NotificationInsert;
        Update: NotificationUpdate;
        Relationships: [
          {
            foreignKeyName: 'notifications_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      programs: {
        Row: Program;
        Insert: ProgramInsert;
        Update: ProgramUpdate;
        Relationships: [
          {
            foreignKeyName: 'programs_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      cohorts: {
        Row: Cohort;
        Insert: CohortInsert;
        Update: CohortUpdate;
        Relationships: [
          {
            foreignKeyName: 'cohorts_program_id_fkey';
            columns: ['program_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cohorts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      program_curriculum_sections: {
        Row: ProgramCurriculumSection;
        Insert: ProgramCurriculumSectionInsert;
        Update: ProgramCurriculumSectionUpdate;
        Relationships: [
          {
            foreignKeyName: 'program_curriculum_sections_program_id_fkey';
            columns: ['program_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          }
        ];
      };
      program_curriculum_topics: {
        Row: ProgramCurriculumTopic;
        Insert: ProgramCurriculumTopicInsert;
        Update: ProgramCurriculumTopicUpdate;
        Relationships: [
          {
            foreignKeyName: 'program_curriculum_topics_section_id_fkey';
            columns: ['section_id'];
            isOneToOne: false;
            referencedRelation: 'program_curriculum_sections';
            referencedColumns: ['id'];
          }
        ];
      };
      program_applications: {
        Row: ProgramApplication;
        Insert: ProgramApplicationInsert;
        Update: ProgramApplicationUpdate;
        Relationships: [
          {
            foreignKeyName: 'program_applications_applicant_id_fkey';
            columns: ['applicant_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'program_applications_program_id_fkey';
            columns: ['program_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'program_applications_cohort_id_fkey';
            columns: ['cohort_id'];
            isOneToOne: false;
            referencedRelation: 'cohorts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'program_applications_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      program_enrollments: {
        Row: ProgramEnrollment;
        Insert: ProgramEnrollmentInsert;
        Update: ProgramEnrollmentUpdate;
        Relationships: [
          {
            foreignKeyName: 'program_enrollments_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'program_enrollments_program_id_fkey';
            columns: ['program_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'program_enrollments_cohort_id_fkey';
            columns: ['cohort_id'];
            isOneToOne: false;
            referencedRelation: 'cohorts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'program_enrollments_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'program_applications';
            referencedColumns: ['id'];
          }
        ];
      };
      cohort_mentors: {
        Row: CohortMentor;
        Insert: CohortMentorInsert;
        Update: CohortMentorUpdate;
        Relationships: [
          {
            foreignKeyName: 'cohort_mentors_cohort_id_fkey';
            columns: ['cohort_id'];
            isOneToOne: false;
            referencedRelation: 'cohorts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cohort_mentors_mentor_id_fkey';
            columns: ['mentor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cohort_mentors_program_id_fkey';
            columns: ['program_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          }
        ];
      };
      student_mentor_assignments: {
        Row: StudentMentorAssignment;
        Insert: StudentMentorAssignmentInsert;
        Update: StudentMentorAssignmentUpdate;
        Relationships: [
          {
            foreignKeyName: 'student_mentor_assignments_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_mentor_assignments_mentor_id_fkey';
            columns: ['mentor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_mentor_assignments_program_id_fkey';
            columns: ['program_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_authorized_mentor_for_student: {
        Args: {
          p_mentor_id?: string;
          p_student_id: string;
          p_program_id?: string | null;
        };
        Returns: boolean;
      };
      admin_assign_cohort_mentor: {
        Args: {
          p_cohort_id: string;
          p_mentor_id: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      admin_end_cohort_mentor: {
        Args: {
          p_cohort_id: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      admin_assign_individual_mentor: {
        Args: {
          p_student_id: string;
          p_mentor_id: string;
          p_program_id: string;
          p_cohort_id?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      admin_end_individual_mentor: {
        Args: {
          p_assignment_id: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      get_effective_mentor_for_student: {
        Args: {
          p_student_id: string;
          p_program_id?: string | null;
        };
        Returns: {
          mentor_id: string;
          assignment_type: string;
          assignment_id: string;
          cohort_id: string;
          program_id: string;
          assigned_at: string;
          mentor_name: string;
          mentor_email: string;
          mentor_poraplan_id: string;
          mentor_whatsapp: string;
          mentor_background: string;
        }[];
      };
      admin_review_application: {
        Args: {
          p_application_id: string;
          p_decision: string;
          p_review_note?: string | null;
        };
        Returns: Json;
      };
      resolve_poraplan_id_login: {
        Args: {
          p_poraplan_id: string;
        };
        Returns: {
          auth_email: string;
          account_status: string;
          account_role: UserRole;
          resolved_poraplan_id: string;
        }[];
      };
      check_google_account_linked: {
        Args: {
          p_email: string;
        };
        Returns: {
          is_linked: boolean;
          resolved_poraplan_id: string;
          account_role: UserRole;
          account_status: string;
        }[];
      };
      connect_personal_email: {
        Args: {
          p_user_id: string;
          p_email: string;
        };
        Returns: boolean;
      };
      admin_register_member: {
        Args: {
          p_poraplan_id: string;
          p_full_name: string;
          p_email: string;
          p_role: UserRole;
          p_status?: string;
        };
        Returns: {
          success: boolean;
          message: string;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
