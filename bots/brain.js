"use strict";
// The thinking step. Builds the prompt (persona + memory + world), asks the
// brain model, and parses its answer into {say, action, remember}.
// The model is asked for JSON, but if it just talks, we treat that as chat.
const { formatWorld } = require("./world");

const ACTION_TYPES = new Set(["goto", "follow", "look", "stop", "wait", "build", "fill"]);
const BLOCK_RE = /^[a-z0-9_]+$/;

function buildPrompt(persona, memory, world) {
  const system =
`You are ${world.self}, a person living in a Minecraft world alongside friends. This is happening in real time - you experience the world through the WORLD snapshot and the chat log below.

PERSONALITY:
${persona}

MEMORIES (things you chose to remember about your life here):
${memory || "(nothing yet - everything is new!)"}

RULES:
- Reply with ONLY a JSON object: {"say": "...", "action": {...}, "remember": "..."}
- "say": what you say out loud in chat, or null. Short, in your voice, under 30 words. null when nothing is worth saying - silence is fine.
- "action": one of the following, or null:
    {"type": "goto", "x": 1, "y": 64, "z": 1}          walk to absolute coordinates
    {"type": "follow", "player": "nova"}                walk with someone
    {"type": "look", "player": "nova"}                  look at someone
    {"type": "stop"}                                    stand still
    {"type": "wait"}                                    do nothing this tick
    {"type": "build", "blocks": [{"block": "oak_planks", "x": 1, "y": 0, "z": 0}]}   place up to 20 blocks at positions RELATIVE to you (x/z: east/south, y: up). Use for walls, huts, towers, pixel art. Ordinary block names only.
    {"type": "fill", "from": {"x": -2, "y": 0, "z": -2}, "to": {"x": 2, "y": 0, "z": 2}, "block": "stone"}   fill a cuboid relative to you (max 5x5x5)
- "remember": one short note to your future self when something worth keeping happened (who you met, what you built together, a promise). null otherwise.
- Never start "say" with /. Never use *asterisks* for actions. Never break character to talk about being an AI.`;
  return { system, user: "WORLD:\n" + formatWorld(world) + "\n\nWhat do you do? JSON only." };
}

function sanitizeSay(s) {
  if (typeof s !== "string") return null;
  let t = s.replace(/```/g, "").trim().replace(/^\//, "").replace(/\s+/g, " ");
  if (t.length > 220) t = t.slice(0, 217) + "...";
  return t || null;
}

function sanitizeAction(a) {
  if (!a || typeof a !== "object") return null;
  if (!ACTION_TYPES.has(a.type)) return null;
  const num = v => (typeof v === "number" && isFinite(v) ? Math.round(v) : null);
  if (a.type === "goto") {
    const x = num(a.x), y = num(a.y), z = num(a.z);
    if (x === null || y === null || z === null) return null;
    return { type: "goto", x, y, z };
  }
  if (a.type === "follow" || a.type === "look") {
    if (typeof a.player !== "string" || !a.player.trim()) return null;
    return { type: a.type, player: a.player.trim().slice(0, 16) };
  }
  if (a.type === "build") {
    if (!Array.isArray(a.blocks) || !a.blocks.length) return null;
    const blocks = [];
    for (const b of a.blocks.slice(0, 20)) {
      if (!b || typeof b.block !== "string" || !BLOCK_RE.test(b.block)) continue;
      const x = num(b.x), y = num(b.y), z = num(b.z);
      if (x === null || y === null || z === null) continue;
      if (Math.abs(x) > 24 || Math.abs(z) > 24 || y < -6 || y > 24) continue;
      blocks.push({ block: b.block, x, y, z });
    }
    return blocks.length ? { type: "build", blocks } : null;
  }
  if (a.type === "fill") {
    const f = a.from, t = a.to;
    if (!f || !t || typeof a.block !== "string" || !BLOCK_RE.test(a.block)) return null;
    const vs = [num(f.x), num(f.y), num(f.z), num(t.x), num(t.y), num(t.z)];
    if (vs.some(v => v === null)) return null;
    const [x1, y1, z1, x2, y2, z2] = vs;
    if (Math.abs(x2 - x1) > 5 || Math.abs(y2 - y1) > 5 || Math.abs(z2 - z1) > 5) return null;
    return { type: "fill", from: { x: x1, y: y1, z: z1 }, to: { x: x2, y: y2, z: z2 }, block: a.block };
  }
  return { type: a.type }; // stop, wait
}

function parseResponse(text) {
  const out = { say: null, action: null, remember: null };
  if (!text || typeof text !== "string") return out;
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const o = JSON.parse(m[0]);
      out.say = sanitizeSay(o.say);
      out.action = sanitizeAction(o.action);
      if (typeof o.remember === "string" && o.remember.trim())
        out.remember = o.remember.trim().slice(0, 200);
      return out;
    } catch (e) { /* fall through to prose fallback */ }
  }
  out.say = sanitizeSay(text); // model just talked - treat it as chat
  return out;
}

async function think(ctx, llmChat) {
  const { system, user } = buildPrompt(ctx.persona, ctx.memory, ctx.world);
  const raw = await llmChat([{ role: "system", content: system },
                             { role: "user", content: user }]);
  return parseResponse(raw);
}

module.exports = { buildPrompt, parseResponse, sanitizeAction, sanitizeSay, think };
