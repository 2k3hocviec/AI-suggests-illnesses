"use client";

interface LoadingOverlayProps {
  show: boolean;
  message: string;
}

export function LoadingOverlay({ show, message }: LoadingOverlayProps) {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 px-4">
      <div className="flex min-w-64 flex-col items-center rounded-lg border border-slate-200 bg-white px-6 py-5 text-center shadow-2xl">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
        <p className="mt-4 text-sm font-semibold text-slate-800">{message}</p>
      </div>
    </div>
  );
}
