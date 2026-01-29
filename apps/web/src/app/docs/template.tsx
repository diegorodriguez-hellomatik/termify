'use client';

import { PageTransition } from '@/components/transitions/PageTransition';

export default function DocsTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
