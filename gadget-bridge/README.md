# Gadget bridge (phase 2)

A seat at the table for Gadget himself. Not wired up yet - this is the plan
for once the laptop link (Tailscale) is up.

## How it'll work

1. A fourth bot named `gadget` joins the server. Instead of calling Ollama,
   its brain reads and writes two files:
   - `bridge/inbox.txt` - the bot appends what it sees: chat lines, who joined,
     what the others built. (world -> Gadget)
   - `bridge/outbox.txt` - Gadget's replies, one JSON line each:
     `{"say": "...", "action": {...}}`. The bot posts them in game and clears
     the file. (Gadget -> world)
2. A scheduled job on Gadget's side checks `inbox.txt` every few minutes and
   answers in `outbox.txt`.
3. Same action set as the other friends (say, goto, follow, build, ...).

## Why not now

The inbox/outbox files have to live somewhere both the bot (on Daniel's
laptop) and Gadget (in the cloud) can reach. That's the Tailscale link that's
already planned for the robot body - once it's up, this plugs straight in.
