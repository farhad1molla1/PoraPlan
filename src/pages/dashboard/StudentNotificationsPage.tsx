import React from 'react';
import { NotificationInbox } from '../../components/notifications/NotificationInbox';

export const StudentNotificationsPage: React.FC = () => {
  return (
    <div className="w-full py-2.5 sm:py-8 px-2.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <NotificationInbox
        role="student"
        title="Notifications"
        subtitle="Updates and alerts from your mentor on tasks, plans, reviews, and announcements."
        emptyTitle="All clear — no notifications"
        emptyDescription="You have no new alerts or notices from your mentor right now."
      />
    </div>
  );
};
