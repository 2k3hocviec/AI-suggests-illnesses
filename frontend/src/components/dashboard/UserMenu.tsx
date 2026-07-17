"use client";

import { LayoutDashboard, LogOut, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getMe, logout } from "@/lib/auth-api";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { ProfileDialog } from "./ProfileDialog";

export function UserMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMe()
      .then((user) => setIsAdmin(user.role === "ADMIN"))
      .catch(() => setIsAdmin(false));
  }, []);

  function handleLogout() {
    setIsLoggingOut(true);
    localStorage.removeItem("accessToken");
    void logout().catch(() => null);
    window.location.replace("/login");
  }

  return (
    <div className="relative" ref={menuRef}>
      <LoadingOverlay show={isLoggingOut} message="Đang đăng xuất..." />
      <button
        type="button"
        aria-label="Mở menu tài khoản"
        title="Tài khoản"
        onClick={() => setIsOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#073b83] shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
      >
        <UserCircle className="h-6 w-6" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-20 w-56 rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsProfileOpen(true);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <UserCircle className="h-4 w-4" />
            Thông tin người dùng
          </button>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push("/admin");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <LayoutDashboard className="h-4 w-4" />
              Trang quản trị
            </button>
          ) : null}
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? "Đang thoát..." : "Đăng xuất"}
          </button>
        </div>
      ) : null}

      <ProfileDialog
        open={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
}
