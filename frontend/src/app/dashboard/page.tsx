import { ChatComposer } from '@/components/dashboard/ChatComposer';
import { ConsultationHeader } from '@/components/dashboard/ConsultationHeader';
import { ConsultationThread } from '@/components/dashboard/ConsultationThread';
import { UserAppShell } from '@/components/dashboard/UserAppShell';

export default function DashboardPage() {
  return (
    <UserAppShell>
      <ConsultationHeader />
      <ConsultationThread />
      <ChatComposer />
    </UserAppShell>
  );
}
