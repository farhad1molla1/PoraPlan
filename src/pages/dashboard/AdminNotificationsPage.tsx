import React from 'react';
import { NotificationInbox } from '../../components/notifications/NotificationInbox';

export const AdminNotificationsPage: React.FC = () => {
  return (
    <NotificationInbox
      role="admin"
      title="Admin System Alerts"
      subtitle="Monitor incoming program applications, cohort capacity limits, direct enrollments, and platform directives."
      emptyTitle="All systems normal"
      emptyDescription="No administrative alerts or capacity threshold warnings at this time."
    />
  );
};
