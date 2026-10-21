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
  created_at?: string;
  updated_at?: string;
};

export type MentorStudent = {
  mentor_id: string;
  student_id: string;
  status?: string;
  created_at?: string;
};

export type SubjectStatus = 'active' | 'archived';

export type Subject = {
  id: string;
  student_id: string;
  created_by?: string | null;
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
          created_at?: string;
        };
        Update: {
          mentor_id?: string;
          student_id?: string;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
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
