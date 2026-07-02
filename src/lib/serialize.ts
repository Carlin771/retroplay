/**
 * Utilitários de serialização.
 *
 * O SQLite guarda alguns campos como BigInt (ex.: tamanho de arquivo). BigInt não
 * pode ser enviado direto para componentes de cliente nem serializado em JSON, então
 * convertemos para string/number nesses limites.
 */

export function bigIntToNumber(value: bigint | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

/** Remove BigInt de um objeto qualquer, convertendo para string. */
export function toPlain<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  ) as T;
}
