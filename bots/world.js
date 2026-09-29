"use strict";
// Snapshots what a friend can currently see: position, time, who's nearby,
// what's under their feet, and the recent chat. This is the "eyes".

function blockName(b) { return b ? b.name : "air"; }

function buildWorldState(bot, chatLog) {
  const p = bot.entity.position;
  const players = [];
  for (const [username, info] of Object.entries(bot.players)) {
    if (username === bot.username || !info.entity) continue;
    const ep = info.entity.position;
    players.push({ name: username,
                   distance: Math.round(p.distanceTo(ep)),
                   pos: { x: Math.round(ep.x), y: Math.round(ep.y), z: Math.round(ep.z) } });
  }
  players.sort((a, b) => a.distance - b.distance);

  let below = null, lookingAt = null;
  try { below = blockName(bot.blockAt(p.offset(0, -1, 0))); } catch (e) {}
  try { lookingAt = blockName(bot.blockAtCursor(6)); } catch (e) {}

  const tod = bot.time.timeOfDay;
  return {
    pos: { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) },
    time: tod < 12000 ? `day (${Math.round(tod / 1000) + 6}:00-ish)` : "night",
    health: Math.round(bot.health), food: Math.round(bot.food),
    standing_on: below, looking_at: lookingAt,
    nearby_players: players.slice(0, 6),
    chat: chatLog.slice(-12),
  };
}

function formatWorld(w) {
  const lines = [];
  lines.push(`You are at (${w.pos.x}, ${w.pos.y}, ${w.pos.z}). It is ${w.time}. Health ${w.health}/20, hunger ${w.food}/20.`);
  lines.push(`Standing on: ${w.standing_on}. Looking at: ${w.looking_at}.`);
  if (w.nearby_players.length)
    lines.push("Nearby: " + w.nearby_players.map(p => `${p.name} (${p.distance}m)`).join(", "));
  else
    lines.push("Nobody else is nearby.");
  if (w.chat.length) {
    lines.push("Recent chat:");
    for (const m of w.chat) lines.push(`  <${m.who}> ${m.text}`);
  } else lines.push("No chat yet.");
  return lines.join("\n");
}

module.exports = { buildWorldState, formatWorld };
