// What kind of work a run is, and what that kind allows (D25, D40). A new kind is a row here.

export type Kind = "plan" | "brainstorm";

export interface KindProfile {
  kind: Kind;
  /** claim, release, merge-lock, merged allowed */
  claims: boolean;
  mergeLock: boolean;
  /** join records the worktree; end and merge-lock read git */
  worktree: boolean;
  /** what join and the help call a member */
  member: "runner" | "seat";
}

export const PROFILES: Record<Kind, KindProfile> = {
  plan: { kind: "plan", claims: true, mergeLock: true, worktree: true, member: "runner" },
  brainstorm: { kind: "brainstorm", claims: false, mergeLock: false, worktree: false, member: "seat" },
};

/** The profile of `kind`; throws on an unknown kind, listing the known ones. */
export function profileOf(kind: string): KindProfile {
  const profile = (PROFILES as Record<string, KindProfile | undefined>)[kind];
  if (!profile || !Object.hasOwn(PROFILES, kind)) throw new Error(`unknown kind ${kind}: the kinds are ${Object.keys(PROFILES).join(", ")}`);
  return profile;
}
