# Blocks, one per concern

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

## Seam blocks, by what sits behind them

### in-process

```
Seam: env.ts, `env`
behind it   the process environment, read once
cases       each of the six keys missing → the start fails naming it   → criterion 6
            all present                  → the object, typed           → criterion 6
not past it process.env itself; the test sets the environment and reads `env`
```

### a local stand-in

```
Seam: lib/auth, the routes /sign-in/social and /callback/:provider
behind it   PGlite in the suite, PostgreSQL itself in-process; the seam stays inside the module
cases       verified email through a second provider attaches       → criterion 4, branch "match"
            unverified email through LinkedIn is refused            → criterion 5, branch "account_not_linked"
            Microsoft without the claim attaches                    → ID72, branch "trusted"
not past it the account table: the answer is read through listUserAccounts
```

### our own service across a network

```
Seam: web lib/api, the RPC client
behind it   the API over HTTP; a port at the seam, the payload-hash fetch as the production
            adapter, an in-memory adapter answering the typed routes for the tests
cases       a bodied POST carries x-amz-content-sha256                 → ID58
            a 401 answer redirects to the entry route                  → criterion 3, branch "expired"
not past it the API's handlers; they have their own seam
```

### a screen

```
Seam: shell/app-bar, rendered
behind it   the auth client's session, stood in for at its seam (signed in as who; signed out)
cases       signed in  → the name, the address, "signed in with Google" in the menu   → US3
            sign out pressed → signOut fires once, the menu closes                    → US3
            signed out → no account slot at all                                       → US3
not past it the component's fields and its template's tags; the assertions read text
            and press buttons the way a person does
```

### a third party

```
Seam: the providers, at their doors
behind it   Google, Microsoft, LinkedIn; a stand-in per door, one function per address,
            each answering one shape; the door not stood in for throws
cases       the token endpoint answers an id token with the claims     → the linking cases above
            LinkedIn's userinfo answers email and email_verified       → D11
not past it the provider's own behaviour; a claim they omit is reported, not simulated
```
