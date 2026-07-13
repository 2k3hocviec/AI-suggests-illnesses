interface AuthCardProps {
  children: React.ReactNode;
}

export function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="w-full rounded-lg bg-white px-6 py-6 shadow-auth ring-1 ring-slate-200/75 lg:px-8 lg:py-8">
      {children}
    </div>
  );
}
