/**
 * Registro em memória dos trabalhos de importação de canais.
 * Permite mostrar o progresso da importação no painel admin.
 * (Reinicia junto com o servidor; re-importar é seguro por causa da deduplicação.)
 */
export type IndexJob = {
  id: string;
  identifier: string;
  status: "running" | "done" | "error";
  imported: number;
  total: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
};

const jobs = new Map<string, IndexJob>();

export function createJob(id: string, identifier: string): IndexJob {
  const job: IndexJob = {
    id,
    identifier,
    status: "running",
    imported: 0,
    total: 0,
    startedAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function updateJob(id: string, patch: Partial<IndexJob>): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, patch);
}

export function listJobs(): IndexJob[] {
  return [...jobs.values()]
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 100);
}
