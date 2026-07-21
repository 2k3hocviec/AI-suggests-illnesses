"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  BrainCircuit,
  FlaskConical,
  MessageSquareText,
  Power,
  RefreshCcw,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  AdminOverview,
  AdminModelTestResponse,
  AdminUser,
  AdminUsersResponse,
  getAdminOverview,
  listAdminUsers,
  setUserEnabled,
  testAdminModel,
} from "@/lib/admin-api";
import { getMe, logout } from "@/lib/auth-api";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { useRouter } from "next/navigation";

export function AdminDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUsersResponse | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [modelInput, setModelInput] = useState("");
  const [modelResult, setModelResult] =
    useState<AdminModelTestResponse | null>(null);
  const [isTestingModel, setIsTestingModel] = useState(false);

  useEffect(() => {
    async function verifyAdmin() {
      try {
        const me = await getMe();

        if (me.role !== "ADMIN") {
          router.replace("/chat");
          return;
        }

        setIsAuthorized(true);
        await loadData();
      } catch {
        localStorage.removeItem("accessToken");
        router.replace("/login");
      }
    }

    void verifyAdmin();
  }, [router]);

  useEffect(() => {
    if (!isAuthorized) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadUsers(1, search);
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [isAuthorized, search]);

  async function loadData() {
    setIsLoading(true);
    setError(null);

    try {
      const [overviewData, usersData] = await Promise.all([
        getAdminOverview(),
        listAdminUsers({ page }),
      ]);
      setOverview(overviewData);
      setUsers(usersData);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải dữ liệu quản trị.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadUsers(nextPage: number, nextSearch = search) {
    try {
      const usersData = await listAdminUsers({
        page: nextPage,
        search: nextSearch,
      });
      setUsers(usersData);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách người dùng.",
      );
    }
  }

  async function handleToggleUser(user: AdminUser) {
    setUpdatingUserId(user.id);
    setError(null);

    try {
      await setUserEnabled(user.id, !user.isEnabled);
      const [overviewData, usersData] = await Promise.all([
        getAdminOverview(),
        listAdminUsers({ page, search }),
      ]);
      setOverview(overviewData);
      setUsers(usersData);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Không thể cập nhật trạng thái người dùng.",
      );
    } finally {
      setUpdatingUserId(null);
    }
  }

  function handleLogout() {
    setIsLoggingOut(true);
    localStorage.removeItem("accessToken");
    void logout().catch(() => null);
    window.location.replace("/login");
  }

  async function handleTestModel() {
    const message = modelInput.trim();
    if (!message) {
      setError("Nhập một câu triệu chứng để kiểm tra model.");
      return;
    }

    setIsTestingModel(true);
    setError(null);

    try {
      setModelResult(await testAdminModel(message));
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : "Không thể kiểm tra model.",
      );
    } finally {
      setIsTestingModel(false);
    }
  }

  const modelRequestShare = useMemo(() => {
    if (!overview || overview.totals.messages === 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (overview.totals.modelRequests / overview.totals.messages) * 100,
      ),
    );
  }, [overview]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf9] text-slate-600">
        Đang tải trang quản trị...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfaf9] text-slate-900">
      <LoadingOverlay show={isLoggingOut} message="Đang đăng xuất..." />
      <header className="border-b border-slate-200 bg-white px-5 py-4 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-600">
              <ShieldCheck className="h-4 w-4" />
              Admin
            </div>
            <h1 className="mt-1 text-2xl font-bold text-[#073b83]">
              Quản lí người dùng
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Làm mới
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <section className="px-5 py-5 lg:px-8">
        {error ? (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}

        {overview ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={Users}
                label="Người dùng"
                value={overview.totals.users}
                detail={`${overview.totals.enabledUsers} đang hoạt động`}
              />
              <StatCard
                icon={MessageSquareText}
                label="Đoạn chat"
                value={overview.totals.chatSessions}
                detail={`${overview.totals.messages} tin nhắn`}
              />
              <StatCard
                icon={Bot}
                label="Request đến model"
                value={overview.totals.modelRequests}
                detail={`${modelRequestShare}% so với tin nhắn`}
              />
              <StatCard
                icon={Power}
                label="Tài khoản vô hiệu"
                value={overview.totals.disabledUsers}
                detail="Không thể truy cập hệ thống"
              />
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
              <ActivityChart data={overview.dailyActivity} />
              <BreakdownPanel
                roleBreakdown={overview.roleBreakdown}
                statusBreakdown={overview.statusBreakdown}
              />
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <AiStatsPanel ai={overview.ai} />
              <ModelTestPanel
                value={modelInput}
                result={modelResult}
                isLoading={isTestingModel}
                onChange={setModelInput}
                onSubmit={() => void handleTestModel()}
              />
            </div>
          </>
        ) : null}

        <div className="mt-5 rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Toàn bộ người dùng
              </h2>
              <p className="text-xs text-slate-500">
                Bật/tắt trạng thái truy cập của từng tài khoản.
              </p>
            </div>
            <label className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 lg:w-80">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên, email, số điện thoại"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Người dùng</th>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3">Hoạt động</th>
                  <th className="px-4 py-3">Địa chỉ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users?.items.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {user.fullName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {user.email}
                      </div>
                      <div className="text-xs text-slate-400">
                        {user.phoneNumber ?? "Chưa cập nhật SĐT"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{user._count.chatSessions} đoạn chat</div>
                      <div>{user._count.chatMessages} tin nhắn</div>
                      <div>{user._count.consultationHistories} request</div>
                    </td>
                    <td className="max-w-sm px-4 py-3 text-slate-600">
                      <span className="block truncate">
                        {user.address ?? "Chưa cập nhật"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          user.isEnabled
                            ? "rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                            : "rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600"
                        }
                      >
                        {user.isEnabled ? "Enable" : "Disable"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={updatingUserId === user.id}
                        onClick={() => void handleToggleUser(user)}
                        className={
                          user.isEnabled
                            ? "h-8 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            : "h-8 rounded-md border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                        }
                      >
                        {updatingUserId === user.id
                          ? "Đang cập nhật..."
                          : user.isEnabled
                            ? "Vô hiệu"
                            : "Kích hoạt"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span>
              Tổng {users?.total ?? 0} người dùng, trang {users?.page ?? 1}/
              {users?.totalPages ?? 1}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!users || users.page <= 1}
                onClick={() => {
                  const nextPage = Math.max(page - 1, 1);
                  setPage(nextPage);
                  void loadUsers(nextPage);
                }}
                className="h-8 rounded-md border border-slate-200 px-3 font-semibold disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={!users || users.page >= users.totalPages}
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  void loadUsers(nextPage);
                }}
                className="h-8 rounded-md border border-slate-200 px-3 font-semibold disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ElementType;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <Icon className="h-5 w-5 text-brand-600" />
      </div>
      <div className="mt-3 text-3xl font-bold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function AiStatsPanel({ ai }: { ai: AdminOverview["ai"] }) {
  const sourceTotal = Math.max(
    1,
    ai.sourceBreakdown.reduce((sum, item) => sum + item.value, 0),
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <BrainCircuit className="h-5 w-5 text-brand-600" />
        <h2 className="text-base font-bold text-slate-900">Thống kê AI</h2>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniMetric
          icon={MessageSquareText}
          label="Lượt tư vấn"
          value={ai.totalConsultations}
        />
        <MiniMetric
          icon={AlertTriangle}
          label="Không nhận diện"
          value={ai.unrecognizedCases}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <RankList
          icon={Activity}
          title="Top triệu chứng"
          emptyText="Chưa có dữ liệu triệu chứng"
          items={ai.topSymptoms.map((item) => ({
            label: item.name,
            value: item.count,
          }))}
        />
        <RankList
          icon={Stethoscope}
          title="Top chuyên khoa"
          emptyText="Chưa có dữ liệu chuyên khoa"
          items={ai.topSpecialties.map((item) => ({
            label: item.name,
            value: item.count,
            detail: item.code,
          }))}
        />
      </div>

      <div className="mt-5">
        <div className="text-xs font-semibold uppercase text-slate-400">
          Tỷ lệ nguồn phân tích
        </div>
        <div className="mt-3 space-y-3">
          {ai.sourceBreakdown.map((item) => {
            const percent = Math.round((item.value / sourceTotal) * 100);

            return (
              <div key={item.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-slate-700">
                    {item.label}
                  </span>
                  <span className="text-slate-500">
                    {item.value} lượt · {percent}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className={
                      item.label === "NER"
                        ? "h-2 rounded-full bg-brand-500"
                        : "h-2 rounded-full bg-emerald-500"
                    }
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ModelTestPanel({
  value,
  result,
  isLoading,
  onChange,
  onSubmit,
}: {
  value: string;
  result: AdminModelTestResponse | null;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-brand-600" />
        <h2 className="text-base font-bold text-slate-900">Kiểm tra model</h2>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ví dụ: Tôi bị đau đầu, sốt cao và đau họng"
        className="mt-4 min-h-28 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading}
        className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-[#073f87] px-3 text-sm font-semibold text-white transition hover:bg-[#052f66] disabled:opacity-50"
      >
        <Bot className="h-4 w-4" />
        {isLoading ? "Đang kiểm tra..." : "Phân tích thử"}
      </button>

      {result ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <ResultBadge label="Intent" value={result.intent} />
            <ResultBadge label="Action" value={result.action} />
            <ResultBadge
              label="Source"
              value={result.analysisSource ?? "Unknown"}
            />
          </div>

          <div className="rounded-md border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
              Raw symptoms
            </div>
            <div className="max-h-72 overflow-auto p-3">
              {result.symptoms.length ? (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th className="pb-2">Triệu chứng</th>
                      <th className="pb-2">Confidence</th>
                      <th className="pb-2">Specialty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.symptoms.map((symptom, index) => (
                      <tr
                        key={`${symptom.name}-${index}`}
                        className="border-t border-slate-100"
                      >
                        <td className="py-2 font-medium text-slate-800">
                          {symptom.name}
                        </td>
                        <td className="py-2 text-slate-600">
                          {Math.round(symptom.confidence * 100)}%
                        </td>
                        <td className="py-2">
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            {symptom.specialty_code}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-500">
                  Model không trích xuất triệu chứng rõ ràng.
                </p>
              )}
            </div>
          </div>

          <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-brand-600" />
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

function RankList({
  icon: Icon,
  title,
  emptyText,
  items,
}: {
  icon: ElementType;
  title: string;
  emptyText: string;
  items: Array<{ label: string; value: number; detail?: string }>;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="space-y-2">
        {items.length ? (
          items.map((item) => (
            <div
              key={`${item.label}-${item.detail ?? ""}`}
              className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {item.label}
                </p>
                {item.detail ? (
                  <p className="text-xs text-slate-400">{item.detail}</p>
                ) : null}
              </div>
              <span className="ml-3 rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                {item.value}
              </span>
            </div>
          ))
        ) : (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
            {emptyText}
          </p>
        )}
      </div>
    </div>
  );
}

function ResultBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function ActivityChart({
  data,
}: {
  data: AdminOverview["dailyActivity"];
}) {
  const maxValue = Math.max(
    1,
    ...data.map((item) => Math.max(item.users, item.messages)),
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-brand-600" />
        <h2 className="text-base font-bold text-slate-900">
          Hoạt động 7 ngày
        </h2>
      </div>
      <div className="mt-5 flex h-56 items-end gap-3">
        {data.map((item) => (
          <div key={item.date} className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex h-44 items-end gap-1">
              <div
                className="w-full rounded-t bg-brand-500"
                style={{ height: `${(item.messages / maxValue) * 100}%` }}
                title={`${item.messages} tin nhắn`}
              />
              <div
                className="w-full rounded-t bg-emerald-500"
                style={{ height: `${(item.users / maxValue) * 100}%` }}
                title={`${item.users} người dùng mới`}
              />
            </div>
            <span className="truncate text-center text-[11px] text-slate-500">
              {item.date.slice(5)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-brand-500" />
          Tin nhắn
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" />
          Người dùng mới
        </span>
      </div>
    </div>
  );
}

function BreakdownPanel({
  roleBreakdown,
  statusBreakdown,
}: {
  roleBreakdown: AdminOverview["roleBreakdown"];
  statusBreakdown: AdminOverview["statusBreakdown"];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-base font-bold text-slate-900">Cơ cấu tài khoản</h2>
      <BreakdownList title="Vai trò" items={roleBreakdown} />
      <BreakdownList title="Trạng thái" items={statusBreakdown} />
    </div>
  );
}

function BreakdownList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
}) {
  const total = Math.max(
    1,
    items.reduce((sum, item) => sum + item.value, 0),
  );

  return (
    <div className="mt-4">
      <div className="text-xs font-semibold uppercase text-slate-400">
        {title}
      </div>
      <div className="mt-2 space-y-3">
        {items.map((item, index) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium text-slate-700">{item.label}</span>
              <span className="text-slate-500">{item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className={
                  index === 0
                    ? "h-2 rounded-full bg-brand-500"
                    : "h-2 rounded-full bg-emerald-500"
                }
                style={{ width: `${(item.value / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
