import { ConsultationChat } from '@/components/dashboard/ConsultationChat';
import { ConsultationHeader } from '@/components/dashboard/ConsultationHeader';
import { UserAppShell } from '@/components/dashboard/UserAppShell';

export default function DashboardPage() {
  return (
    <UserAppShell>
      <ConsultationHeader />
      <ConsultationChat />
    </UserAppShell>
  );
}
