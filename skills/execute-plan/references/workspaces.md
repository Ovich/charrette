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
- Keep the path short and ignore the directory in the repository. Unignored, every tool
  that walks the tree reads two checkouts.
- **On Windows, `git config core.longpaths true` before the first removal.** A worktree
  prefix pushes a dependency tree over the 260-character limit that the main checkout
  sits under, and git without that setting cannot delete those files at all, while Node
  creates them happily: the install succeeds and only the removal fails. Set it in the
  repository, which needs no administrator. Shortening the path buys a few characters and
  the next deep dependency spends them; this setting is the fix.
- A merge conflict means the fork was wrong. Report both sides and redraw it. Resolving
  it puts the orchestrator in the diffs.
- Removing each workspace and its branch is a step of the join. Only untouched ones go
  by themselves, and a removal that fails is reported, not skipped: an orphaned workspace
  still holds a branch.
- **Remove it from the main checkout, never from inside it.** Windows refuses to delete a
  directory that is any process's working directory, so a removal run while a shell still
  sits in the worktree fails with `Permission denied` even once the directory is empty.
  An orchestrator that ran anything in there is that shell.
- **A failed removal can still unregister the worktree.** git deletes what it can, drops
  the worktree from its metadata, and leaves the directory: `git worktree list` then looks
  clean while a directory on disk still holds the branch. So check that the path is gone,
  not that the list is short. This is the state that produces branches nobody can account
  for a week later.
- One orchestrator per plan. aiview does not lock the document.
