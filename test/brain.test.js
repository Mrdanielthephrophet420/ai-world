"use strict";
// node --test test/   (no minecraft server needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseResponse, sanitizeAction, sanitizeSay, buildPrompt, think } = require("../bots/brain");

test("parses a clean JSON answer", () => {
  const r = parseResponse('{"say": "hey all", "action": {"type": "wait"}, "remember": null}');
  assert.equal(r.say, "hey all");
  assert.deepEqual(r.action, { type: "wait" });
  assert.equal(r.remember, null);
});

test("strips ```json fences", () => {
  const r = parseResponse('```json\n{"say": "hi", "action": null, "remember": null}\n```');
  assert.equal(r.say, "hi");
});

test("prose fallback becomes chat", () => {
  const r = parseResponse("oh! I have an idea, let's build a tower");
  assert.equal(r.say, "oh! I have an idea, let's build a tower");
  assert.equal(r.action, null);
});

test("say never starts with a slash", () => {
  assert.equal(sanitizeSay("/op nova"), "op nova");
});

test("say gets capped", () => {
  assert.ok(sanitizeSay("x".repeat(500)).length <= 220);
});

test("goto needs real coords", () => {
  assert.equal(sanitizeAction({ type: "goto", x: 1 }), null);
  assert.deepEqual(sanitizeAction({ type: "goto", x: 1, y: 64, z: 2 }), { type: "goto", x: 1, y: 64, z: 2 });
});

test("build sanitizes blocks", () => {
  const a = sanitizeAction({ type: "build", blocks: [
    { block: "oak_planks", x: 1, y: 0, z: 0 },
    { block: "../../evil", x: 0, y: 0, z: 0 },
    { block: "stone", x: 999, y: 0, z: 0 },
  ]});
  assert.deepEqual(a, { type: "build", blocks: [{ block: "oak_planks", x: 1, y: 0, z: 0 }] });
});

test("fill capped at 5x5x5", () => {
  assert.equal(sanitizeAction({ type: "fill", from: { x: 0, y: 0, z: 0 },
    to: { x: 9, y: 0, z: 0 }, block: "stone" }), null);
  const ok = sanitizeAction({ type: "fill", from: { x: -2, y: 0, z: -2 },
    to: { x: 2, y: 0, z: 2 }, block: "stone" });
  assert.equal(ok.type, "fill");
});

test("unknown action types are dropped", () => {
  assert.equal(sanitizeAction({ type: "fly_to_moon" }), null);
});

test("prompt contains persona, memory and world", () => {
  const { system, user } = buildPrompt("PERSONA-XYZ", "MEMORY-ABC",
    { self: "nova", pos: { x: 1, y: 64, z: 2 }, time: "day", health: 20, food: 20,
      standing_on: "grass_block", looking_at: "air", nearby_players: [], chat: [] });
  assert.ok(system.includes("PERSONA-XYZ") && system.includes("MEMORY-ABC"));
  assert.ok(user.includes("grass_block"));
});

test("think() end to end with a fake brain", async () => {
  const fakeLLM = async () => '{"say": "building time", "action": {"type": "build", "blocks": [{"block": "stone", "x": 1, "y": 0, "z": 0}]}, "remember": "started a tower"}';
  const r = await think({ persona: "p", memory: "m",
    world: { self: "nova", pos: { x: 0, y: 64, z: 0 }, time: "day", health: 20, food: 20,
             standing_on: "grass_block", looking_at: "air", nearby_players: [], chat: [] } }, fakeLLM);
  assert.equal(r.say, "building time");
  assert.equal(r.action.blocks[0].block, "stone");
  assert.equal(r.remember, "started a tower");
});
