"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Check,
  Trash2,
  Clock,
  Infinity as InfinityIcon,
} from "lucide-react";

export type Access = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  trialSecondsTotal: number | null; // null = permanente
  trialSecondsUsed: number;
  lastSeenAt: string | null;
};

type Props = {
  initialAccesses: Access[];
  currentUserId: string;
};

const TEST_OPTIONS = [5, 10, 15, 30, 60];
const ONLINE_WINDOW_MS = 60_000; // visto nos últimos 60s = "assistindo agora"

function fmtMin(totalSec: number): string {
  if (totalSec < 60) return `${Math.max(0, Math.floor(totalSec))}s`;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return s > 0 && m < 10 ? `${m}min ${s}s` : `${m}min`;
}

function fmtAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return "há poucos segundos";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function AccessManager({
  initialAccesses,
  currentUserId,
}: Props) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isTest, setIsTest] = useState(false);
  const [minutes, setMinutes] = useState(10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // "Relógio" que atualiza o status online e o tempo de teste na lista.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCreated(null);
    setCopied(false);

    const res = await fetch("/api/admin/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || undefined,
        email: email.trim(),
        password,
        testMinutes: isTest ? minutes : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Não foi possível criar o acesso.");
      return;
    }

    setCreated({ email: email.trim().toLowerCase(), password });
    setName("");
    setEmail("");
    setPassword("");
    setIsTest(false);
    setMinutes(10);
    router.refresh();
  }

  async function copyCreated() {
    if (!created) return;
    const text = `Login: ${created.email}\nSenha: ${created.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não consegui copiar automaticamente. Copie manualmente.");
    }
  }

  async function onDelete(id: string, label: string) {
    if (!confirm(`Excluir o acesso de "${label}"? Isso é permanente.`)) return;
    const res = await fetch(`/api/admin/access?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Não foi possível excluir.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Formulário de criação */}
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-1 text-lg font-semibold">Criar novo acesso</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Defina um login (e-mail) e uma senha e envie para a pessoa. Marque
          &quot;acesso de teste&quot; para dar um tempo limitado que só corre
          enquanto a pessoa está assistindo.
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {created && (
            <div className="rounded-md bg-emerald-500/15 px-3 py-3 text-sm text-emerald-200">
              <p className="mb-2 font-medium">
                Acesso criado. Envie para a pessoa:
              </p>
              <div className="flex flex-col gap-1 font-mono text-xs">
                <span>Login: {created.email}</span>
                <span>Senha: {created.password}</span>
              </div>
              <button
                type="button"
                onClick={copyCreated}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copiar login e senha
                  </>
                )}
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Nome (opcional)
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: João"
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Login (e-mail)
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@exemplo.com"
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-brand"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            Senha
            <input
              type="text"
              required
              minLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 4 caracteres"
              className="rounded-md border border-white/10 bg-white/5 px-3 py-2 font-mono outline-none focus:border-brand"
            />
            <span className="text-xs text-zinc-500">
              A senha fica visível para você copiar e enviar.
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isTest}
              onChange={(e) => setIsTest(e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            Acesso de teste (conta só o tempo assistindo)
          </label>

          {isTest && (
            <label className="flex flex-col gap-1 text-sm">
              Tempo de teste (só corre enquanto assiste)
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-fit rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-brand"
              >
                {TEST_OPTIONS.map((m) => (
                  <option key={m} value={m} className="bg-zinc-900">
                    {m} minutos
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-fit rounded-md bg-brand px-5 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar acesso"}
          </button>
        </form>
      </section>

      {/* Lista de acessos */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Acessos ({initialAccesses.length})
        </h2>
        <div className="flex flex-col divide-y divide-white/10 rounded-lg border border-white/10">
          {initialAccesses.map((a) => {
            const isAdmin = a.role === "ADMIN";
            const isSelf = a.id === currentUserId;
            const isTrial = a.trialSecondsTotal != null;
            const totalSec = a.trialSecondsTotal ?? 0;
            const usedSec = a.trialSecondsUsed;
            const remainingSec = Math.max(0, totalSec - usedSec);
            const exhausted = isTrial && usedSec >= totalSec;
            const lastMs = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : null;
            const onlineNow = lastMs != null && now - lastMs < ONLINE_WINDOW_MS;

            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{a.email}</span>
                    {isAdmin && (
                      <span className="rounded bg-brand/20 px-2 py-0.5 text-xs text-brand">
                        admin
                      </span>
                    )}
                    {onlineNow && !isAdmin && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        assistindo agora
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-400">
                    {a.name && <span>{a.name}</span>}
                    {a.name && <span aria-hidden>·</span>}

                    {!isTrial ? (
                      <span className="inline-flex items-center gap-1">
                        <InfinityIcon className="h-3 w-3" /> permanente
                      </span>
                    ) : exhausted ? (
                      <span className="text-red-400">
                        teste esgotado (assistiu {fmtMin(usedSec)})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <Clock className="h-3 w-3" /> teste · assistiu{" "}
                        {fmtMin(usedSec)} de {fmtMin(totalSec)} (restam{" "}
                        {fmtMin(remainingSec)})
                      </span>
                    )}

                    {!isAdmin && (
                      <>
                        <span aria-hidden>·</span>
                        <span>
                          {lastMs == null
                            ? "nunca acessou"
                            : onlineNow
                              ? "online"
                              : `visto ${fmtAgo(now - lastMs)}`}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {!isAdmin && !isSelf && (
                  <button
                    onClick={() => onDelete(a.id, a.email)}
                    aria-label={`Excluir acesso de ${a.email}`}
                    className="shrink-0 rounded-md p-2 text-zinc-400 hover:bg-red-500/15 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
