import React from 'react';
import { NotificationInbox } from '../../components/notifications/NotificationInbox';

export const MentorNotificationsPage: React.FC = () => {
  return (
    <div className="w-full py-2.5 sm:py-8 px-2.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <NotificationInbox
        role="mentor"
        title="Mentor Notification Inbox"
        subtitle="Track scholar submissions, student doubts, milestone evaluations, and platform directives."
        emptyTitle="Inbox is clear"
        emptyDescription="No pending mentor notifications or new scholar inquiries right now."
      />
    </div>
  );
};
