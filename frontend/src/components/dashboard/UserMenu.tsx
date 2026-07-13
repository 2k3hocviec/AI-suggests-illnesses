"use client";

import { LogOut, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { logout } from "@/lib/auth-api";

export function UserMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      localStorage.removeItem("accessToken");
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="relative" ref={menuRef}>
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
            disabled={isLoggingOut}
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? "Đang thoát..." : "Đăng xuất"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
