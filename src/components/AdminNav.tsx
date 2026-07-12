"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, Users } from "lucide-react";

const tabs = [
  { href: "/admin", label: "Séries", Icon: Film },
  { href: "/admin/acessos", label: "Acessos", Icon: Users },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto mb-6 flex max-w-4xl gap-2 px-4 pt-6 md:px-8">
      {tabs.map(({ href, label, Icon }) => {
        // "Séries" fica ativa também nas telas de detalhe (/admin/serie/...).
        const active =
          href === "/admin"
            ? pathname === "/admin" || pathname.startsWith("/admin/serie")
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-brand text-white"
                : "bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
