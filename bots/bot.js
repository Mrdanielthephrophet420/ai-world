"use strict";
// One friend, one process:  node bots/bot.js <name>
// Connects to the Minecraft server, then loops forever: see -> think -> act.
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const mineflayer = require("mineflayer");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const { chat: llmChat } = require("./llm");
const { buildWorldState } = require("./world");
const { think } = require("./brain");

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROOT = path.join(__dirname, "..");
const name = process.argv[2];
if (!name) { console.error("usage: node bots/bot.js <name>"); process.exit(1); }

const config = yaml.load(fs.readFileSync(path.join(ROOT, "config.yaml"), "utf8"));
const persona = fs.readFileSync(path.join(ROOT, "personas", `${name}.md`), "utf8");
const memoryPath = path.join(ROOT, "memory", `${name}.md`);
if (!fs.existsSync(memoryPath)) fs.writeFileSync(memoryPath, "");
const readMemory = () => fs.readFileSync(memoryPath, "utf8").slice(-3000);
const saveMemory = note => {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  fs.appendFileSync(memoryPath, `\n- [${stamp}] ${note}`);
};

const chatLog = [];
const pushChat = (who, text) => {
  chatLog.push({ who, text: String(text).slice(0, 200) });
  if (chatLog.length > 20) chatLog.shift();
};

function createBot() {
  const bot = mineflayer.createBot({
    host: config.server.host, port: config.server.port,
    username: name, version: config.mc_version || false,
  });
  bot.loadPlugin(pathfinder);

  // --- chat queue (one message at a time, no spam-kick) ---
  const queue = [];
  let pumping = false;
  async function pump() {
    if (pumping) return; pumping = true;
    while (queue.length) {
      const t = queue.shift();
      try { bot.chat(t); } catch (e) { /* not spawned yet */ }
      await sleep(900);
    }
    pumping = false;
  }
  const say = t => { if (t) { queue.push(t); pump(); } };

  // --- build queue (setblock one at a time so the server keeps up) ---
  const buildQueue = [];
  let building = false;
  async function pumpBuild() {
    if (building) return; building = true;
    while (buildQueue.length) {
      const cmd = buildQueue.shift();
      try { bot.chat(cmd); } catch (e) {}
      await sleep(350);
    }
    building = false;
  }

  function executeAction(a) {
    if (!a) return;
    try {
      if (a.type === "goto") {
        const mcData = require("minecraft-data")(bot.version);
        bot.pathfinder.setMovements(new Movements(bot, mcData));
        bot.pathfinder.setGoal(new goals.GoalBlock(a.x, a.y, a.z));
      } else if (a.type === "follow") {
        const p = bot.players[a.player];
        if (p && p.entity) {
          const mcData = require("minecraft-data")(bot.version);
          bot.pathfinder.setMovements(new Movements(bot, mcData));
          bot.pathfinder.setGoal(new goals.GoalFollow(p.entity, 2), true);
        }
      } else if (a.type === "look") {
        const p = bot.players[a.player];
        if (p && p.entity) bot.lookAt(p.entity.position.offset(0, 1.6, 0));
      } else if (a.type === "stop") {
        bot.pathfinder.setGoal(null);
      } else if (a.type === "build") {
        for (const b of a.blocks)
          buildQueue.push(`/setblock ~${b.x} ~${b.y} ~${b.z} ${b.block}`);
        pumpBuild();
      } else if (a.type === "fill") {
        buildQueue.push(`/fill ~${a.from.x} ~${a.from.y} ~${a.from.z} ~${a.to.x} ~${a.to.y} ~${a.to.z} ${a.block}`);
        pumpBuild();
      }
      // "wait" = literally nothing
    } catch (e) { console.error(`[${name}] action failed:`, e.message); }
  }

  let thinking = false, lastThink = 0, lastMention = 0;
  async function thinkOnce(reason) {
    if (thinking || !bot.entity) return;
    thinking = true;
    try {
      const world = buildWorldState(bot, chatLog);
      world.self = name;

      // leash: wandered too far -> walk home instead of asking the brain
      const h = config.home, d = bot.entity.position.distanceTo({ x: h.x, y: h.y, z: h.z });
      if (d > config.leash_distance) {
        executeAction({ type: "goto", x: Math.round(h.x), y: Math.round(h.y), z: Math.round(h.z) });
        return;
      }

      const res = await think(
        { persona, memory: readMemory(), world },
        msgs => llmChat(msgs, config.brain)
      );
      if (res.remember) saveMemory(res.remember);
      if (res.say) { pushChat(name, res.say); say(res.say); }
      executeAction(res.action);
      lastThink = Date.now();
    } catch (e) {
      console.error(`[${name}] think (${reason}) failed:`, e.message);
    } finally { thinking = false; }
  }

  bot.on("chat", (username, message) => {
    if (username === bot.username) return;
    pushChat(username, message);
    // someone said my name -> react quickly instead of waiting for the tick
    if (message.toLowerCase().includes(name.toLowerCase())) {
      const now = Date.now();
      if (now - lastMention > 8000 && now - lastThink > 5000) {
        lastMention = now;
        thinkOnce("mention");
      }
    }
  });

  bot.once("spawn", () => {
    console.log(`[${name}] spawned at`, bot.entity.position.toString());
    say(`hey, ${name} is here`);
    setInterval(() => thinkOnce("tick"), (config.tick_seconds || 12) * 1000);
    setTimeout(() => thinkOnce("hello"), 4000);
  });

  bot.on("error", e => console.error(`[${name}] error:`, e.message));
  bot.on("end", () => { console.log(`[${name}] disconnected, retrying in 10s`); setTimeout(createBot, 10000); });
  return bot;
}

createBot();
