"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Search, Shield } from "lucide-react";
import { SITE_NAME } from "@/lib/site";

type Props = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  } | null;
};

export default function Header({ user }: Props) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-gradient-to-b from-black/90 to-black/30 px-4 py-3 backdrop-blur md:px-8">
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="text-2xl font-extrabold tracking-tight text-brand"
        >
          {SITE_NAME}
        </Link>
        <nav className="hidden gap-4 text-sm text-zinc-300 md:flex">
          <Link href="/" className="hover:text-white">
            Início
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <form
          action="/busca"
          className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 sm:flex"
        >
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            name="q"
            placeholder="Buscar série"
            aria-label="Buscar série"
            className="w-36 bg-transparent text-sm outline-none placeholder:text-zinc-500"
          />
        </form>

        {user ? (
          <>
            {user.role === "ADMIN" && (
              <Link
                href="/admin"
                className="flex items-center gap-1 text-sm text-zinc-300 hover:text-white"
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}
