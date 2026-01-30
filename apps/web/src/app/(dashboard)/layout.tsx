import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <DashboardShell
      userName={session.user?.name}
      userEmail={session.user?.email}
      userImage={session.user?.image}
    >
      {children}
    </DashboardShell>
  );
}
