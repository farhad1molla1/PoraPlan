import type { NavItem, WorkflowStep } from '../types';

export const APP_CONFIG = {
  name: 'PoraPlan',
  tagline: 'You study. We organize how, what and when.',
  descriptor: 'Personal Study Assistance & Mentorship Platform',
  version: '0.1 MVP',
  codePrefix: 'PP-SYS',
};

export const NAV_LINKS: NavItem[] = [
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'About', href: '/about' },
];

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    stepNumber: '01',
    code: 'PLN-01',
    name: 'Plan',
    shortDesc: 'Structured syllabus roadmaps and daily target milestones.',
    detail: 'Break large academic goals into actionable study blocks with realistic timelines.',
    iconName: 'calendar',
  },
  {
    stepNumber: '02',
    code: 'STD-02',
    name: 'Study',
    shortDesc: 'Focused study sessions backed by organized curated materials.',
    detail: 'Concentrate on high-priority topics without getting lost in resource overload.',
    iconName: 'book-open',
  },
  {
    stepNumber: '03',
    code: 'PRC-03',
    name: 'Practice',
    shortDesc: 'Targeted exercises and problem sets designed to test recall.',
    detail: 'Reinforce theoretical knowledge through disciplined chapter-wise assignments.',
    iconName: 'pen-tool',
  },
  {
    stepNumber: '04',
    code: 'SBM-04',
    name: 'Submit',
    shortDesc: 'Timely submission of completed coursework and tasks.',
    detail: 'Maintain accountable study habits with transparent submission records.',
    iconName: 'send',
  },
  {
    stepNumber: '05',
    code: 'REV-05',
    name: 'Review',
    shortDesc: 'Mentor and peer evaluation of submitted work against standards.',
    detail: 'Objective assessment pinpointing conceptual gaps and accuracy.',
    iconName: 'clipboard-check',
  },
  {
    stepNumber: '06',
    code: 'FDB-06',
    name: 'Feedback',
    shortDesc: 'Actionable guidance and tailored corrections from mentors.',
    detail: 'Receive direct, qualitative commentary to immediately remedy mistakes.',
    iconName: 'message-square',
  },
  {
    stepNumber: '07',
    code: 'PRG-07',
    name: 'Progress',
    shortDesc: 'Continuous mastery tracking across every subject and cycle.',
    detail: 'Visualize clear syllabus coverage and readiness for upcoming milestones.',
    iconName: 'trending-up',
  },
];
