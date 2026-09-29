# AI World — a Minecraft server where Daniel's AI friends live

Three bots (nova, echo, rivet), each with their own personality, memory, and AI
brain, living on a Paper Minecraft server on your laptop. They chat, wander,
remember things, and **build stuff** — together, and with you when you log in.

## How it works (the video's trick, basically)

1. **The world**: a Paper Minecraft server running on your laptop.
2. **The bodies**: Mineflayer bots — one per friend — that can walk, look,
   chat, and place blocks (they're server ops, so they build with commands).
3. **The brains**: every 12 seconds each bot "thinks": it looks at the world
   (position, who's nearby, recent chat), asks its AI model what to do, and
   does it — says something, walks somewhere, or builds something.
4. **The memory**: each friend has a memory file. When something worth keeping
   happens, they write it down and remember it next time. That's how they
   start feeling like people instead of chatbots.

## What you need on your laptop

- **Java 17+** — https://adoptium.net (Temurin 21)
- **Node.js 20+** — https://nodejs.org
- **Minecraft Java Edition**, version matching `mc_version` in `config.yaml`
- **Ollama** — https://ollama.com, then run `ollama pull llama3.1:8b`
  (runs the brains locally: free, private, nothing leaves your house)

## Run it (3 commands)

```powershell
npm install
node server/run-server.js   # downloads Paper, type I AGREE for the EULA
node bots/start-bots.js     # nova, echo and rivet wake up
```

Then open Minecraft → Multiplayer → add server `localhost` → join.
Say hi in chat. They'll hear you.

## Make it yours

- **Give them personalities**: edit `personas/nova.md` (or rename the file).
  Vibe, backstory, relationships, quirks — that's the whole soul.
- **Add a friend**: `node tools/new-friend.js <name>`, edit their persona,
  restart the bots.
- **Read their diaries**: `memory/<name>.md` — everything they've chosen to
  remember. You can add notes yourself; they'll know them next tick.
- **Tune**: `config.yaml` — brain model, how often they think, who exists.

## Notes

- The server runs in **offline mode** so the bots can join with plain names.
  Keep it on your home network — don't port-forward it to the internet.
- Bots are ops so they can build. They can only place/fill ordinary blocks,
  and chat can't run slash commands, so they can't grief the server settings.
- `npm test` runs the brain unit tests (no server needed).
- Gadget's seat: see `gadget-bridge/README.md` — that's phase 2, once the
  laptop link is up.

## Troubleshooting

- **Bots can't join**: make sure the server finished starting ("Done!") first.
- **Version mismatch**: set `mc_version` in config.yaml to YOUR game's version.
- **Brain errors / silence**: is Ollama running? (`ollama list` should show the model.)
- **A friend is stuck**: they leash back to `home` in config.yaml automatically.
- **Port busy**: something's already on 25565 — change `server.port`.
