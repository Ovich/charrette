# Releasing Charrette

Charrette reaches its users as a Claude Code plugin, installed from this repository
acting as its own marketplace. Two properties of that channel decide whether a change
you push actually arrives, and both are easy to get wrong silently.

## The version is the delivery

Claude Code caches an installed plugin by its *resolved version*, under
`~/.claude/plugins/cache/charrette/charrette/<version>/`. On update it compares the
version the marketplace declares against the one the user already has, and **skips the
plugin when they match** — no diff is consulted, no commit SHA is compared.

`version` is declared twice, and `.claude-plugin/plugin.json` silently wins over
`.claude-plugin/marketplace.json`. A bump in the marketplace entry alone changes
nothing.

So: **push without bumping `version` and no existing user receives the change.** They
will run `/plugin marketplace update`, watch it succeed, and keep running the old code.
Everyone who installs fresh gets the new code, which makes the failure invisible from
the maintainer's side — the bug reports come only from people who installed early.

Bump `version` in both manifests, to the same value, on every release. Not on every
commit — on every release.

## The build output is versioned on purpose

`skills/aiview/dist/` (the UI, ~5 MB) and `skills/aiview/dist-cli/cli.mjs` (the CLI and
server, ~44 KB, bundled by esbuild with no runtime dependencies) are committed.

They have to be. An update installs into a *new, empty* cache directory; nothing carries
over from the previous version. Anything not in git is therefore rebuilt by every user
on every release — a 347 MB `npm install` and a Vite build, needing network and a
toolchain, to produce 5 MB of static files you already built here. Committed, the whole
runtime requirement is Node ≥ 22.5.

The consequence: **a release that changes aiview's source but not its build output ships
the old viewer.** Run the build before tagging, every time, and commit what it produces.

## The sequence

```bash
cd skills/aiview && npm install && npm run build && cd ../..   # refresh dist/ + dist-cli/
# bump "version" to the SAME value in both:
#   .claude-plugin/plugin.json
#   .claude-plugin/marketplace.json
claude plugin validate .                        # manifests, skills, commands
git add -A && git commit -m "release: v<version>"
claude plugin tag --push -m "charrette %s"      # tags charrette--v<version>, pushes the tag
git push
```

`claude plugin tag` refuses to run when the two manifests disagree on the version, or on
a dirty tree — that check is the reason to use it rather than `git tag`. It does not and
cannot check that you bumped the version at all; that part is yours.

Verify against a real install rather than trusting the push:

```bash
claude plugin marketplace update charrette
claude plugin update charrette@charrette        # says "up to date" if you forgot the bump
```

## What users run

```
/plugin marketplace update charrette
/plugin update charrette@charrette
```

then **restart Claude Code** — an update applies only to sessions started afterwards.
Users with background marketplace refresh still need the second command and the restart.

## Notes

- `skills/aiview/mmdcheck.mjs` imports `jsdom` and `mermaid` as bare specifiers, so it
  needs `node_modules` and does not work from an installed plugin. Nothing references
  it; it is a maintainer's tool. Bundle it into `dist-cli/` before putting it on any
  user-facing path.
- The data home (`$CHARRETTE_HOME`, or `charrette_appdata` in the OS home) is never
  touched by an update. Documents and the index survive every release.
- Dropping `version` from both manifests is the alternative delivery model: git sources
  then resolve to the commit SHA and every push becomes an update. It removes the bump
  from this procedure and removes release points along with it.
