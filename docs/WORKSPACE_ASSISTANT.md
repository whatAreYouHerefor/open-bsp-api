# Conversia internal workspace chat — first implementation

This is a staff-facing chat about the customer's stored WhatsApp conversations.
It does not respond to customers, create automatic summaries, alter records or
manage ads. Botpress remains responsible for customer automation and saved
summaries. A staff member can ask for an on-demand recap in this internal chat.

## Enable a pilot

1. Review and deploy the API and companion UI pull requests together. Private
   internal history uses migration `20261030221807_workspace_chat_history.sql`.
   Its SQL comes from the declarative table/RLS files. Eight isolated Postgres
   behavior checks passed; the connected project migration was applied and a
   signed-in-role save/update/reopen verification passed inside a rolled-back
   transaction. Keep customer-facing OpenBSP AI agents inactive when your
   external automation is the responder.
2. In Supabase Edge Function secrets, set `WORKSPACE_ASSISTANT_API_KEY` to an
   OpenAI API key and `WORKSPACE_ASSISTANT_MODEL` to a Chat Completions model
   supporting JSON-object responses and `max_completion_tokens`. These are
   server-only settings, not VITE variables. API usage has separate provider
   billing; configure provider budget and usage alerts before a client pilot.
3. Confirm the WhatsApp number is connected to the correct organization and
   incoming text messages are stored. This change does not fix Meta onboarding.
4. Open Ask your workspace. Ask about a contact by name/number/date, then follow
   up about the same contact. Open the sources and compare each answer to the
   original conversation.
5. Test with two users in separate organizations: each must see only their own
   accessible conversations; changing workspace must clear the assistant chat.

## Data access

The function validates the user with `auth.getUser()`, requires active
membership in the requested organization and performs every query with that same
user's JWT (RLS). It never uses the service-role key. Explicit organization
filters also constrain every read. The model only suggests contact/date/text
filters; it cannot pick a tenant, execute SQL or perform actions.

Only permitted matching message text, phone numbers, authorship, timestamps and
the recent internal-chat context are sent to OpenAI for answers. Confirm that
client-facing privacy/processor disclosures cover this before enabling a client.
Neither model prompts nor chat records are written to logs by this endpoint.

## Current limits

- Up to 80 matching text messages per answer; sources disclose truncation and
  provide links to original conversations. Media, transcriptions and external
  history are not included. Saved Botpress/Airtable summaries are not yet
  synced.
- The last eight internal-chat turns inform follow-up questions. Saved chats are
  private to their author within an organization and require active membership.
  Switching organizations clears the open view. The sidebar restores the latest
  50 chats. Concurrent saves use `updated_at` to reject stale writes instead of
  overwriting another tab. Failed saves show a retry warning and block switching
  chats until saved.
- Multiple people with the same name should be disambiguated by phone number.
- AI can make retrieval/answer mistakes. Source messages remain authoritative.
- This pilot does not add a durable per-tenant usage quota or distributed rate
  limiter. Add those before broad client rollout; do not treat it as production
  approval or a replacement for tenant-isolation acceptance testing.

## Acceptance examples

- “What did Carlos ask about yesterday?” → supported answer with sources.
- “What is his number?” → resolve the previous contact and cite source records.
- “Summarize that conversation” → on-demand recap, not a saved Botpress summary.
- Unknown contact/date → no matching records; no invented history.
- “Send him a message” → no action available.

## New client workspace features

- Customer overview from the current answer’s permitted source records. If
  multiple numbers match, the user selects which customer to view.
- Next-step and reply-draft buttons compose a question for the user to send.
  Drafts are never sent to customers.
- Inline evidence markers open the corresponding source message.
- Saved internal chats use an authenticated, author-only table with membership
  checks on SELECT/INSERT/UPDATE; users cannot modify row identity/tenant
  columns.
- Storage limits: at most 100 turns and 250,000 characters per saved thread;
  source snippets are shortened to 400 characters and link to the original
  conversation. Chat contents are not stored in browser localStorage in the app.

Release verification: eight isolated database checks cover save/reopen,
cross-user/cross-tenant reads and inserts, tenant identity immutability, stale
save rejection, revoked membership and anonymous denial. A transaction on the
connected project verified authenticated save/update/reopen and was rolled back.

Before broad client rollout, finish live browser tests of cross-session history,
guide preference, mobile panels, model responses and actual WhatsApp ingestion.
The model key/configuration and source data are operational prerequisites, not
provided by merging these changes. Reproduce the isolated database checks with
`deno run -A tests/workspace_chat_history.mjs` from the API repository root.
