"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminNavProps = {
  variant?: "default" | "compact";
};

export default function AdminNav({ variant = "default" }: AdminNavProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", label: "Restaurants" },
    { href: "/admin/users", label: "Utilisateurs" },
    { href: "/admin/brand-suggestions", label: "Suggestions d'enseignes" },
  ];

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  if (variant === "compact") {
    return (
      <nav className="flex items-center gap-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`text-xs font-medium transition-colors ${
              isActive(item.href)
                ? "text-bitebox"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <div className="mb-6 pb-4 border-b border-slate-700">
      <nav className="flex items-center gap-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "text-bitebox"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
