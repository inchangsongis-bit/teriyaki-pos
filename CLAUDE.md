# CLAUDE.md

Guidance for working in this repo. See [README.md](README.md) for stack, structure, and the
current requirements list.

## Running things

- Backend entrypoint is `backend/server.py` (not `main.py`), served with
  `uvicorn server:app --reload --port 8001`. Route/service packages are `backend/routes/` and
  `backend/service/` (singular) — not `routers/`/`services/`. Both naming choices are
  deliberate, not typos: see "Environment gotcha" below.
- Frontend runs on port 3001 (`npm run dev -- --port 3001`), backend on port 8001. Ports
  3000/8000 are used by an unrelated sibling project on this machine — don't default to them.
- Seed the menu with `python seed.py` from `backend/` after activating the venv, before
  expecting `/api/menu/` to return anything.
- Use the Browser tool to verify kiosk/kitchen UI changes against the running dev servers
  rather than asking the user to check manually.

## Environment gotcha: ~/Documents permission loss

This project lives under `~/Documents`, a macOS TCC-gated folder (Desktop/Documents/Downloads
get special privacy treatment). Mid-session, the app hosting Claude Code can lose filesystem
access to the entire `~/Documents` tree — not just this repo — surfacing as `Operation not
permitted` on reads/writes/deletes that previously worked fine. It doesn't just affect brand
new files; anything can degrade after enough time in a session.

If this happens:
1. Confirm scope by testing an unrelated path under `~/Documents` (e.g. a sibling project) —
   if that's also blocked, it's the TCC issue, not something specific to a file here.
2. Have the user check **System Settings → Privacy & Security → Files and Folders** and
   re-enable Documents access for the app hosting the session.
3. Toggling the setting alone is often not enough — the grant applies to newly-launched
   processes. The user needs to **fully quit and relaunch** the hosting app (Terminal, IDE,
   etc.), not just close the window.
4. If a workaround is needed before that happens, create fresh files/directories with new
   names rather than editing ones already touched earlier in the session — freshly created
   paths stay writable for a window even while older ones are locked. That's why the backend
   entrypoint and route/service packages have the names they do (`server.py` /
   `routes/` / `service/`) instead of the more conventional `main.py` / `routers/` /
   `services/`, which got caught by this mid-build and are no longer worth renaming back.

## Payments

Stripe Terminal is semi-integrated: the backend only ever creates a `ConnectionToken` and a
`PaymentIntent` — actual card data flows directly between the kiosk's browser (Stripe Terminal
JS SDK) and the reader, never through our server. Don't add code that tries to read or store
raw card data.

`.env` currently holds a placeholder Stripe key. Payment collection against the real API
(even the simulated reader) needs a real Stripe test secret key before it'll work — a 502
with a Stripe error message from `/api/payments/connection-token` most likely just means the
key is still a placeholder, not a bug.
