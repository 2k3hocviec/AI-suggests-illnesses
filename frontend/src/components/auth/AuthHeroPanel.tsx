import { Activity, Building2 } from "lucide-react";
import Image from "next/image";
import { getPlatformStats } from "@/lib/platform-stats-api";

const heroImageUrl =
  "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1600&q=90";

export async function AuthHeroPanel() {
  const stats = await getPlatformStats();
  const trustedUsers = new Intl.NumberFormat("vi-VN").format(
    stats.trustedUsers,
  );

  return (
    <section className="relative hidden min-h-screen overflow-hidden bg-slate-900 lg:block">
      <Image
        src={heroImageUrl}
        alt="Tòa nhà trung tâm y tế hiện đại"
        fill
        priority
        sizes="60vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/72 via-slate-950/10 to-transparent" />
      <div className="absolute bottom-12 left-12 max-w-xl text-white">
        <div className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Activity className="h-5 w-5" />
          HealthAI Portal
        </div>
        <h1 className="max-w-md text-3xl font-bold leading-tight">
          Model AI gợi ý khám bệnh
        </h1>
        <div className="mt-5 flex items-center gap-3 text-sm text-white/82">
          <div className="flex -space-x-2">
            <span className="h-8 w-8 rounded-full border-2 border-white bg-brand-600" />
            <span className="h-8 w-8 rounded-full border-2 border-white bg-emerald-500" />
            <span className="h-8 w-8 rounded-full border-2 border-white bg-sky-400" />
          </div>
          <span>{trustedUsers} người dùng tin tưởng</span>
        </div>
      </div>
    </section>
  );
}
