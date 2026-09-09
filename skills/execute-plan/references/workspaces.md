# Workspaces

Read when the plan forks: two or more slices run at once.

- One workspace per slice. Two agents in one checkout collide where git cannot see it:
  one leaves a file unformatted, the other's check fails on files it never touched.
- Locally a workspace is a git worktree, `isolation: "worktree"` on the Agent tool. On
  another machine it is a clone. The rule is the isolation, not the mechanism.
- Name the base branch in the brief and check it in the return. Tools default to the
  repository's default branch, and a slice built from the wrong base fails at the merge.
- A workspace needs its own install. Measure before calling it a cost: with a shared
  package store it is seconds.
- Keep the path short and ignore the directory in the repository. On Windows a deep path
  plus `node_modules` breaks removal. Unignored, every tool that walks the tree reads two
  checkouts.
- A merge conflict means the fork was wrong. Report both sides and redraw it. Resolving
  it puts the orchestrator in the diffs.
- Removing each workspace and its branch is a step of the join. Only untouched ones go
  by themselves, and a removal that fails is reported, not skipped: an orphaned workspace
  still holds a branch.
- One orchestrator per plan. aiview does not lock the document.
