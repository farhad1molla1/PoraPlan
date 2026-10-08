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
