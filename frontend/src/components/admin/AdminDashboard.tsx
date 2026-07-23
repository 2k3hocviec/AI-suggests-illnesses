"use client";

import {
  Activity,
  AlertTriangle,
  CalendarDays,
  BarChart3,
  Bot,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
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
  const [activityStart, setActivityStart] = useState(() => getDefaultActivityStart());
  const [isRefreshingActivity, setIsRefreshingActivity] = useState(false);
  const [confirmingUser, setConfirmingUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    async function verifyAdmin() {
      try {
        const me = await getMe();

        if (me.role !== "ADMIN") {
          router.replace("/chat");
          return;
        }

        setIsAuthorized(true);
        await loadData(activityStart);
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

  async function loadData(nextActivityStart = activityStart, showLoading = true) {
    if (showLoading) {
      setIsLoading(true);
    } else {
      setIsRefreshingActivity(true);
    }
    setError(null);

    try {
      const activityRange = getActivityRange(nextActivityStart);
      const [overviewData, usersData] = await Promise.all([
        getAdminOverview(activityRange),
        listAdminUsers({ page, search }),
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
      if (showLoading) {
        setIsLoading(false);
      } else {
        setIsRefreshingActivity(false);
      }
    }
  }

  function handleActivityNavigate(direction: -1 | 1) {
    const nextStart = addDays(activityStart, direction * 7);
    if (direction > 0 && nextStart > getDefaultActivityStart()) {
      return;
    }

    setActivityStart(nextStart);
    void loadData(nextStart, false);
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
              onClick={() => void loadData(activityStart)}
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

            <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[1.4fr_0.9fr]">
              <ActivityChart
                data={overview.dailyActivity}
                isLoading={isRefreshingActivity}
                onPrevious={() => handleActivityNavigate(-1)}
                onNext={() => handleActivityNavigate(1)}
                canGoNext={activityStart < getDefaultActivityStart()}
              />
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
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Người dùng</th>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3">Đoạn chat</th>
                  <th className="px-4 py-3">Tin nhắn</th>
                  <th className="px-4 py-3">Request</th>
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
                      <TableMetric icon={MessageSquareText} value={user._count.chatSessions} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <TableMetric icon={Activity} value={user._count.chatMessages} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <TableMetric icon={Bot} value={user._count.consultationHistories} />
                    </td>
                    <td className="max-w-[260px] px-4 py-3 text-slate-600">
                      <span
                        className="block max-w-[230px] truncate"
                        title={user.address ?? "Chưa cập nhật"}
                      >
                        {shortAddress(user.address)}
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
                        onClick={() => {
                          if (user.isEnabled) {
                            setConfirmingUser(user);
                            return;
                          }

                          void handleToggleUser(user);
                        }}
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

      {confirmingUser ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disable-user-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 id="disable-user-title" className="text-base font-bold text-slate-900">
                  Vô hiệu hóa tài khoản?
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {confirmingUser.fullName} sẽ không thể đăng nhập hoặc sử dụng hệ thống cho đến khi được kích hoạt lại.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingUser(null)}
                className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const user = confirmingUser;
                  setConfirmingUser(null);
                  void handleToggleUser(user);
                }}
                className="h-9 rounded-md bg-red-600 px-3 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Vô hiệu hóa
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

function TableMetric({
  icon: Icon,
  value,
}: {
  icon: ElementType;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
      <Icon className="h-4 w-4 text-slate-400" />
      {value}
    </span>
  );
}

function AiStatsPanel({ ai }: { ai: AdminOverview["ai"] }) {
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

      <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
        <DonutChart
          title="Tỷ lệ nguồn phân tích"
          items={ai.sourceBreakdown}
          colors={["#1976d2", "#10b981"]}
        />
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
  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="space-y-2">
        {items.length ? (
          items.map((item) => {
            const intensity = item.value / maxValue;
            const backgroundColor = `rgba(25, 118, 210, ${0.05 + intensity * 0.2})`;
            const accentColor = `rgba(25, 118, 210, ${0.25 + intensity * 0.75})`;

            return (
            <div
              key={`${item.label}-${item.detail ?? ""}`}
              className="flex items-center justify-between rounded-md border-l-4 px-3 py-2"
              style={{ backgroundColor, borderLeftColor: accentColor }}
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
                {item.value} ({Math.round(intensity * 100)}%)
              </span>
            </div>
            );
          })
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
  isLoading,
  onPrevious,
  onNext,
  canGoNext,
}: {
  data: AdminOverview["dailyActivity"];
  isLoading: boolean;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-600" />
            <h2 className="text-base font-bold text-slate-900">
              Hoạt động theo ngày
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Theo dõi từng cửa sổ 7 ngày
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            aria-label="Xem 7 ngày trước"
            title="7 ngày trước"
            onClick={onPrevious}
            disabled={isLoading}
            className="flex h-8 w-8 items-center justify-center rounded text-slate-600 transition hover:bg-white hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="inline-flex min-w-28 items-center justify-center gap-1.5 px-2 text-xs font-semibold text-slate-600">
            <CalendarDays className="h-3.5 w-3.5 text-brand-600" />
            {formatActivityRange(data)}
          </span>
          <button
            type="button"
            aria-label="Xem 7 ngày tiếp theo"
            title="7 ngày tiếp theo"
            onClick={onNext}
            disabled={!canGoNext || isLoading}
            className="flex h-8 w-8 items-center justify-center rounded text-slate-600 transition hover:bg-white hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className={`mt-5 grid gap-4 lg:grid-cols-2 ${isLoading ? "opacity-50" : ""}`}>
        <MiniBarChart
          data={data}
          valueKey="messages"
          title="Tin nhắn"
          color="#1976d2"
        />
        <MiniBarChart
          data={data}
          valueKey="users"
          title="Người dùng mới"
          color="#10b981"
        />
      </div>
    </div>
  );
}

function MiniBarChart({
  data,
  valueKey,
  title,
  color,
}: {
  data: AdminOverview["dailyActivity"];
  valueKey: "messages" | "users";
  title: string;
  color: string;
}) {
  const maxValue = Math.max(1, ...data.map((item) => item[valueKey]));

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
        <span>{title}</span>
        <span className="text-xs font-medium text-slate-400">
          Cao nhất: {maxValue}
        </span>
      </div>
      <div className="mt-4 flex h-44 items-end gap-2">
        {data.map((item) => {
          const value = item[valueKey];
          const height = value ? Math.max((value / maxValue) * 100, 5) : 2;

          return (
            <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-500">{value}</span>
              <div className="flex h-32 w-full items-end rounded-t bg-slate-200/70">
                <div
                  className="w-full rounded-t transition-all"
                  style={{ height: `${height}%`, backgroundColor: color }}
                  title={`${value} ${title.toLowerCase()}`}
                />
              </div>
              <span className="text-[10px] text-slate-500">{item.date.slice(5)}</span>
            </div>
          );
        })}
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
      <div className="mt-4 space-y-6">
        <DonutChart
          title="Theo vai trò"
          items={roleBreakdown}
          colors={["#1976d2", "#94a3b8"]}
        />
        <div className="border-t border-slate-100 pt-5">
          <DonutChart
            title="Theo trạng thái"
            items={statusBreakdown}
            colors={["#10b981", "#ef4444"]}
          />
        </div>
      </div>
    </div>
  );
}

function DonutChart({
  title,
  items,
  colors,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  colors: string[];
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const selectedItem = selectedIndex === null ? null : items[selectedIndex];

  return (
    <div>
      <div className="text-xs font-semibold uppercase text-slate-400">{title}</div>
      <div className="mt-3 flex max-w-[430px] items-center gap-4">
        <div
          className="relative h-28 w-28 shrink-0"
          role="group"
          aria-label={`${title}: ${total} tổng số`}
        >
          <svg viewBox="0 0 112 112" className="h-full w-full">
            <circle
              cx="56"
              cy="56"
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="18"
            />
            {items.map((item, index) => {
              const length = total
                ? (item.value / total) * circumference
                : 0;
              const currentOffset = offset;
              offset += length;

              return (
                <circle
                  key={item.label}
                  cx="56"
                  cy="56"
                  r={radius}
                  fill="none"
                  stroke={colors[index % colors.length]}
                  strokeWidth={selectedIndex === index ? "22" : "18"}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-currentOffset}
                  className="cursor-pointer transition-all hover:opacity-80"
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.label}: ${item.value}, ${total ? Math.round((item.value / total) * 100) : 0}%`}
                  onClick={() =>
                    setSelectedIndex((current) =>
                      current === index ? null : index,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedIndex((current) =>
                        current === index ? null : index,
                      );
                    }
                  }}
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white text-center">
            {selectedItem ? (
              <>
                <span className="max-w-[62px] text-[10px] font-semibold leading-3 text-slate-500">
                  {selectedItem.label}
                </span>
                <span className="text-lg font-bold text-slate-900">
                  {selectedItem.value}
                </span>
                <span className="text-[10px] text-slate-400">
                  {total ? Math.round((selectedItem.value / total) * 100) : 0}%
                </span>
              </>
            ) : (
              <>
                <span className="text-lg font-bold text-slate-900">{total}</span>
                <span className="text-[10px] text-slate-400">tổng</span>
              </>
            )}
          </div>
        </div>
        <div className="min-w-[150px] flex-1 space-y-2">
          {items.map((item, index) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={selectedIndex === index}
              onClick={() =>
                setSelectedIndex((current) =>
                  current === index ? null : index,
                )
              }
              className={`flex w-full items-start justify-between gap-2 rounded-md px-1.5 py-1 text-left text-xs transition hover:bg-slate-50 ${selectedIndex === index ? "bg-slate-50 ring-1 ring-slate-200" : ""}`}
            >
              <span className="flex min-w-0 items-start gap-1.5 leading-4 text-slate-600">
                <span
                  className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="break-words">{item.label}</span>
              </span>
              <span className="shrink-0 font-semibold text-slate-700">
                {item.value} · {total ? Math.round((item.value / total) * 100) : 0}%
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function getDefaultActivityStart() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 6);
  return start;
}

function getActivityRange(start: Date) {
  return {
    from: formatDateOnly(start),
    to: formatDateOnly(addDays(start, 6)),
  };
}

function addDays(value: Date, amount: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatActivityRange(data: AdminOverview["dailyActivity"]) {
  if (!data.length) {
    return "Không có dữ liệu";
  }

  return `${data[0].date.slice(5)} – ${data[data.length - 1].date.slice(5)}`;
}

function shortAddress(address: string | null) {
  if (!address) {
    return "Chưa cập nhật";
  }

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 2 ? parts.slice(-2).join(", ") : address;
}
