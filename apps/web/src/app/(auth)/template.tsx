'use client';

import { PageTransition } from '@/components/transitions/PageTransition';

export default function AuthTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
