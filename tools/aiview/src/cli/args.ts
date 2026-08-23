// Centralized flag parsing — one place knows which flags take values.
const VALUE_FLAGS = new Set(["--port", "--tag", "--untag", "--kind", "--started", "--group", "--group-title"]);

export interface ParsedArgs {
  verb: string | undefined;
  rest: string[];
  positional: string[];
  flag(name: string): string | undefined;
  flags(name: string): string[];
  has(name: string): boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [verb, ...rest] = argv;
  return {
    verb,
    rest,
    positional: rest.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(rest[i - 1] ?? "")),
    flag: (name) => {
      const i = rest.indexOf(name);
      return i >= 0 ? rest[i + 1] : undefined;
    },
    flags: (name) => rest.flatMap((a, i) => (a === name && rest[i + 1] ? [rest[i + 1]] : [])),
    has: (name) => rest.includes(name),
  };
}
