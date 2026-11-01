"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/admin/actions";

interface NavItem {
  name: string;
  href: string;
  icon?: string;
}

const navItems: NavItem[] = [
  { name: "Menu", href: "/admin/menu" },
  { name: "Analytics", href: "/admin/analytics" },
  { name: "Chat Logs", href: "/admin/logs" },
  { name: "Kitchen", href: "/kitchen" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/admin/menu" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
              🍴
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-none group-hover:text-amber-400 transition-colors">
                Dine-Assist
              </h1>
              <p className="text-[11px] text-slate-400 leading-none mt-1">Admin Portal</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden sm:flex items-center gap-1 border-l border-slate-800 pl-5">
            {navItems.map((item) => {
              const isActive =
                item.href === "/admin/menu"
                  ? pathname === "/admin/menu"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side: Mobile nav pills & Sign Out */}
        <div className="flex items-center gap-3">
          <div className="flex sm:hidden items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/admin/menu"
                  ? pathname === "/admin/menu"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    isActive
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="text-xs sm:text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-rose-950/40 hover:border-rose-800/60 hover:text-rose-200 transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
