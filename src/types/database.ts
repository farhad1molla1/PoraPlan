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
