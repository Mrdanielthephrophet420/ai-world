"use strict";
// Add a new friend:  node tools/new-friend.js <name>
// Copies the persona template and seeds a memory file, then registers them.
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const name = (process.argv[2] || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16);
if (!name) { console.error("usage: node tools/new-friend.js <name>"); process.exit(1); }

const ROOT = path.join(__dirname, "..");
const personaPath = path.join(ROOT, "personas", `${name}.md`);
if (fs.existsSync(personaPath)) { console.error(`${name} already exists`); process.exit(1); }

fs.copyFileSync(path.join(ROOT, "personas", "_template.md"), personaPath);
fs.writeFileSync(path.join(ROOT, "memory", `${name}.md`),
  `- [${new Date().toISOString().slice(0, 10)}] I woke up in Daniel's world for the first time. Everything is new.\n`);

const cfgPath = path.join(ROOT, "config.yaml");
const cfg = yaml.load(fs.readFileSync(cfgPath, "utf8"));
if (!cfg.friends.includes(name)) cfg.friends.push(name);
fs.writeFileSync(cfgPath, yaml.dump(cfg));

console.log(`Created ${name}. Now edit personas/${name}.md to give them a personality,`);
console.log(`then restart the bots. Don't forget to op them: they auto-op on next server start.`);
