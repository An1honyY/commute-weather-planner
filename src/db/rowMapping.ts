// Small helpers shared by every repository — SQLite has no boolean or array
// type, so every repo maps 0/1 <-> boolean and JSON text <-> array/object
// at the boundary rather than leaking that representation into callers.
export function toSqlBool(value: boolean | undefined): number | null {
  if (value === undefined) return null;
  return value ? 1 : 0;
}

export function fromSqlBool(value: number | null): boolean {
  return value === 1;
}

export function fromSqlBoolOptional(value: number | null): boolean | undefined {
  return value === null ? undefined : value === 1;
}

export function toSqlJson<T>(value: T | undefined): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

export function fromSqlJson<T>(value: string | null): T | undefined {
  return value === null ? undefined : (JSON.parse(value) as T);
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
