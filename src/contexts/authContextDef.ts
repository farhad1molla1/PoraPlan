import { createContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile, UserRole, AccountStatus } from '../types/database';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  poraplanId: string | null;
  status: AccountStatus | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithPoraPlanId: (
    poraplanId: string,
    password: string
  ) => Promise<{ error: Error | null; role?: UserRole }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; role?: UserRole }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateNewPassword: (newPassword: string) => Promise<{ error: Error | null }>;
  connectEmail: (email: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: UserRole
  ) => Promise<{ error: Error | null; role?: UserRole }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
