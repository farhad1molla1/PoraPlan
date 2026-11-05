import React from 'react';
import type { NotificationType } from '../types/database';
import type { BadgeVariant } from '../components/common/Badge';
import {
  Bell,
  CheckCircle2,
  ListTodo,
  FileText,
  FileCheck,
  Calendar,
  HelpCircle,
  Megaphone,
  BookMarked,
  Compass,
  Clock,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';

export interface NotificationTypeMeta {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeVariant: BadgeVariant;
  actionText: string;
}

/**
 * Resolver for human-readable notification metadata, visual badge variants,
 * icons, and contextual action CTA text across all member roles.
 * Strictly emoji-free, adhering to PoraPlan's design system.
 */
export function getNotificationTypeMeta(
  type: NotificationType,
  role?: 'student' | 'mentor' | 'admin'
): NotificationTypeMeta {
  switch (type) {
    case 'submission_created':
      return {
        label: 'Submission',
        icon: FileCheck,
        badgeVariant: 'teal',
        actionText: role === 'student' ? 'View Submission' : 'Review Submission',
      };
    case 'submission_reviewed':
      return {
        label: 'Review',
        icon: CheckCircle2,
        badgeVariant: 'gold',
        actionText: 'View Feedback',
      };
    case 'assignment_deadline_reminder':
      return {
        label: 'Deadline Reminder',
        icon: Clock,
        badgeVariant: 'danger',
        actionText: 'View Assignment',
      };
    case 'assignment_created':
    case 'assignment_updated':
      return {
        label: 'Assignment',
        icon: FileText,
        badgeVariant: 'gold',
        actionText: 'View Assignment',
      };
    case 'doubt_created':
      return {
        label: 'New Doubt',
        icon: HelpCircle,
        badgeVariant: 'gold',
        actionText: 'Open Doubt',
      };
    case 'doubt_replied':
      return {
        label: 'Doubt Reply',
        icon: HelpCircle,
        badgeVariant: 'teal',
        actionText: 'View Response',
      };
    case 'application_submitted':
      return {
        label: 'Application',
        icon: ClipboardList,
        badgeVariant: 'navy',
        actionText: role === 'student' ? 'View Application' : 'Review Application',
      };
    case 'capacity_alert':
      return {
        label: 'Capacity Alert',
        icon: AlertTriangle,
        badgeVariant: 'danger',
        actionText: role === 'student' ? 'View Details' : 'View Cohorts',
      };
    case 'task_created':
    case 'task_updated':
      return {
        label: 'Target Task',
        icon: ListTodo,
        badgeVariant: 'teal',
        actionText: 'View Tasks',
      };
    case 'evaluation_published':
      return {
        label: 'Evaluation',
        icon: Calendar,
        badgeVariant: 'gold',
        actionText: 'View Evaluation',
      };
    case 'announcement_published':
      return {
        label: 'Announcement',
        icon: Megaphone,
        badgeVariant: 'danger',
        actionText: 'Read Notice',
      };
    case 'plan_updated':
      return {
        label: 'Study Plan',
        icon: Compass,
        badgeVariant: 'teal',
        actionText: 'View Plan',
      };
    case 'resource_published':
      return {
        label: 'Resource',
        icon: BookMarked,
        badgeVariant: 'navy',
        actionText: 'View Resource',
      };
    case 'system':
    default:
      return {
        label: 'System',
        icon: Bell,
        badgeVariant: 'muted',
        actionText: 'Open Link',
      };
  }
}
