import React from 'react';
import { NotificationInbox } from '../../components/notifications/NotificationInbox';

export const StudentNotificationsPage: React.FC = () => {
  return (
    <NotificationInbox
      role="student"
      title="Notifications"
      subtitle="Updates and alerts from your mentor on tasks, plans, reviews, and announcements."
      emptyTitle="All clear — no notifications"
      emptyDescription="You have no new alerts or notices from your mentor right now."
    />
  );
};
