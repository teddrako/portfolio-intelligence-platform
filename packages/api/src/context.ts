export interface Context {
  userId: string | null;
}

export function createContext(ctx: Partial<Context> = {}): Context {
  return { userId: ctx.userId ?? null };
}
