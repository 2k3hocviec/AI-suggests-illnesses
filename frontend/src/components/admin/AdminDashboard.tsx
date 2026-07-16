"use client";

import {
  BarChart3,
  Bot,
  MessageSquareText,
  Power,
  RefreshCcw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  AdminOverview,
  AdminUser,
  AdminUsersResponse,
  getAdminOverview,
  listAdminUsers,
  setUserEnabled,
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
