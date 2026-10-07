# Module blocks, one per state

## Contents

- Module blocks, by state
  - new
  - deepened
  - interface change
  - wiring
  - ui
  - ui, a component tree
  - schema

Each block below is the whole of what a slice document carries for that concern: shallow
code for the contract, a line each for what the code cannot say, nothing a body would
say. The names are one project's; the shape is every project's.

## Module blocks, by state

### new

```ts
// tests/support/sign-in · new
export type Identity = { subject: string; name: string; email: string; emailVerified: boolean };
export const signInThrough: (provider: Provider, who: Identity) => Promise<Response>;
export const signedInAs: (response: Response) => Promise<User | null>;
export const landingOf: (response: Response) => URL;
```

- hides: the library's two routes, the `state` parameter, the cookie plumbing
- accepts: the auth instance and the app URL; reads no environment
- errors: a provider door not stood in for throws, naming the address
- invariant: `signInThrough` leaves the browser where the callback sent it, never further

### deepened

```ts
// lib/auth · deepened
export const auth: BetterAuth;   // unchanged
```

- behind it: Microsoft at the `common` tenant, LinkedIn at the default scopes
- configuration: `MICROSOFT_*`, `LINKEDIN_*` through `env.ts`; absent in the cloud until S5.2, and the provider is then not mounted
- a new export here would make this an interface change, and the row would say so

### interface change

```ts
// env.ts · interface change
// before
export const env: { APP_URL: string; GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string; … };
// after
export const env: { …before; MICROSOFT_CLIENT_ID: string; MICROSOFT_CLIENT_SECRET: string;
                    LINKEDIN_CLIENT_ID: string; LINKEDIN_CLIENT_SECRET: string };
```

- callers: `lib/auth`, reads the four; the dev script, loads the file they come from
- error mode: a missing value fails the start naming the field, both branches

### wiring

```ts
// app.ts · wiring
app.all("/api/auth/*", (c) => auth.handler(c.req.raw));
```

- from `app.ts` to `lib/auth`'s `handler`; no logic on the line
- proved through the seam of `lib/auth`: get-session answers empty with no cookie, the user with one

### ui

```ts
// auth/sign-in · ui
inputs   none
outputs  none; the press leaves the page
states   idle · pressed(provider) → the provider's door
calls    authClient.signIn.social({ provider, callbackURL: "/" })
```

- behaviour tested by state: each button sends the browser to its provider's origin
- look reviewed against the mockup's entry route (`👤 design review`)

### ui, a component tree

When the slice draws more than one component, the block is the tree first, then one
line per component: what it owns, what comes in, what goes out. A component's state
lives in the lowest component that needs it, and a child never reaches past its parent.

```
AppShell
├─ AppBar                           owns nothing; lays out its children
│  ├─ Wordmark                      in: none
│  ├─ CreditMeter                   in: balance: Money            (a later slot; drawn, inert)
│  └─ AccountSlot                   owns: menuOpen
│     └─ AccountMenu                in: user: { name; email; provider }   out: signOut, deleteAccount
└─ <router-outlet>
```

```ts
// shell/app-bar/account-menu · ui
input   user: { name: string; email: string; provider: Provider }
output  signOut: void
output  deleteAccount: void
states  closed · open · open+confirming-signout
calls   nothing; the parent calls authClient.signOut() on the output
```

- the seam of a component is what a person sees and does: its rendered text and its
  outputs, never its fields or its template's structure
- a service the component reads is stood in for at the service's seam, not spied on
- behaviour tested by state; look reviewed against the mockup's AppBar (`👤 design review`)

### schema

```sql
-- packages/db · schema, generated
create table "account" (…, "provider_id" text not null, "user_id" text not null references "user"("id") on delete cascade, …);
```

- owner: `lib/auth` through the Drizzle adapter; the file is generated and never hand-edited
- proved through the owner's seam: the migration applies, then the linking cases
