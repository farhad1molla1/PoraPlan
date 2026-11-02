import React from 'react';
import { NotificationInbox } from '../../components/notifications/NotificationInbox';

export const MentorNotificationsPage: React.FC = () => {
  return (
    <NotificationInbox
      role="mentor"
      title="Mentor Notification Inbox"
      subtitle="Track scholar submissions, student doubts, milestone evaluations, and platform directives."
      emptyTitle="Inbox is clear"
      emptyDescription="No pending mentor notifications or new scholar inquiries right now."
    />
  );
};
