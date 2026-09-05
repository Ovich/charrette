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
cd skills/aiview && npm install && npm run build && npm test && cd ../..   # refresh dist/ + dist-cli/
node --test skills/pr-review/scripts/scope.test.mjs           # the review scope script
node --test skills/project-conventions/scripts/rules.test.mjs # the conventions rules script
# bump "version" to the SAME value in both:
#   .claude-plugin/plugin.json
#   .claude-plugin/marketplace.json
claude plugin validate .                        # manifests, skills, commands
git add -A && git commit -m "release: v<version>"
git push                                        # the tag is created for you
```

The tag is not yours to make. `.github/workflows/tag-release.yml` watches the two
manifests on `main`; when the version they agree on has no `charrette--v<version>` tag,
it creates and pushes one. A push that touches those files without changing the version
is a no-op, so editing a description or a keyword costs nothing. The workflow fails loudly
on the one case that would otherwise ship silently wrong — the two manifests disagreeing,
where `plugin.json` wins at install time while the catalogue advertises the other number.

`claude plugin tag --push -m "charrette %s"` does the same thing locally and remains the
fallback when Actions is unavailable. Neither it nor the workflow can tell that you failed
to bump the version at all; that part stays yours.

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

- `aiview mermaid-check` is its own bundle, `dist-cli/mermaid-check.mjs`, about 3.5 MB,
  built by `npm run build` with the CLI. It is versioned like the CLI bundle, for the
  same reason.
- The data home (`$CHARRETTE_HOME`, or `charrette_appdata` in the OS home) is never
  touched by an update. Documents and the index survive every release.
- Dropping `version` from both manifests is the alternative delivery model: git sources
  then resolve to the commit SHA and every push becomes an update. It removes the bump
  from this procedure and removes release points along with it.
