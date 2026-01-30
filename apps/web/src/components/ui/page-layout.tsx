'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: ReactNode;
  /** Maximum width: 'sm' | 'md' | 'lg' | 'xl' | 'full' (default: full) */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

interface PageHeaderProps {
  title: string | ReactNode;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

interface PageContentProps {
  children: ReactNode;
  className?: string;
}

const maxWidthClasses = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  full: '',
};

export function PageLayout({ children, maxWidth = 'full', className }: PageLayoutProps) {
  return (
    <div className={cn('p-8', maxWidthClasses[maxWidth], className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, badge, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          {title}
          {badge && <span className="text-lg font-normal text-muted-foreground">{badge}</span>}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

export function PageContent({ children, className }: PageContentProps) {
  return (
    <div className={cn('', className)}>
      {children}
    </div>
  );
}
