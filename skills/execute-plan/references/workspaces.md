# Workspaces

Read when the plan forks. A **workspace** is one slice's isolated checkout.

## Setting up

- **One workspace per slice**; two agents in one checkout collide where git cannot see it.
- **Locally a workspace is a git worktree**, `isolation: "worktree"` on the Agent tool; on another machine, a clone.
- **Name the base branch in the brief and check it in the return**; tools default to the repository's default branch.
- **Each workspace gets its own install**; with a shared package store it is seconds.
- **Keep the path short and ignore the directory in the repository.**
- **On Windows, `git config core.longpaths true` in the repository before the first removal**; a worktree prefix pushes a dependency tree past the 260-character limit, and Node creates what git then cannot delete.
- **One orchestrator per plan**; aiview does not lock the document.

## Joining

- **A merge conflict means the fork was wrong.** Report both sides and redraw it.
- **Removing each workspace and its branch is a step of the join.** A removal that fails is reported, never skipped; an orphaned workspace still holds a branch.
- **Remove it from the main checkout, never from inside it**; Windows refuses to delete any process's working directory, and a shell that ran anything in there is that process.
- **Check that the path is gone, not that `git worktree list` is short**; a failed removal can unregister the worktree and leave the directory holding the branch.
