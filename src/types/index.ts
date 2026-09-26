export type NavItem = {
  label: string;
  href: string;
  isExternal?: boolean;
};

export type WorkflowStep = {
  stepNumber: string;
  code: string;
  name: string;
  shortDesc: string;
  detail: string;
  iconName: 'calendar' | 'book-open' | 'pen-tool' | 'send' | 'clipboard-check' | 'message-square' | 'trending-up';
};

export type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type CardVariant = 'default' | 'paper' | 'navy' | 'gold' | 'teal';
