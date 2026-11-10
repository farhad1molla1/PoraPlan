import React from 'react';
import { NotificationInbox } from '../../components/notifications/NotificationInbox';

export const AdminNotificationsPage: React.FC = () => {
  return (
    <div className="w-full py-2.5 sm:py-8 px-2.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <NotificationInbox
        role="admin"
        title="Admin System Alerts"
        subtitle="Monitor incoming program applications, cohort capacity limits, direct enrollments, and platform directives."
        emptyTitle="All systems normal"
        emptyDescription="No administrative alerts or capacity threshold warnings at this time."
      />
    </div>
  );
};
