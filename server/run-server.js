"use strict";
// Downloads + runs the Paper Minecraft server:  node server/run-server.js
// First run downloads paper.jar, writes server.properties (offline mode so the
// bots can join with their own names), ops your friends, and asks you to
// accept Mojang's EULA. Keep this on your home network - don't port-forward it.
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { spawn, execSync } = require("child_process");
const yaml = require("js-yaml");

const DIR = __dirname;
const ROOT = path.join(DIR, "..");
const config = yaml.load(fs.readFileSync(path.join(ROOT, "config.yaml"), "utf8"));
const MC = config.mc_version;

// Offline-mode UUID = Java UUIDv3("OfflinePlayer:" + name), the same one
// Paper assigns when the bot joins. Without the right UUID, ops.json is ignored.
function offlineUUID(name) {
  const crypto = require("crypto");
  const h = crypto.createHash("md5").update("OfflinePlayer:" + name).digest();
  h[6] = (h[6] & 0x0f) | 0x30;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.toString("hex");
  return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20)}`;
}

async function main() {
  // 1. java check
  try {
    const v = execSync("java -version 2>&1").toString();
    const m = v.match(/version "(\d+)/);
    if (!m || parseInt(m[1], 10) < 17) throw new Error("too old");
    console.log("java OK:", v.split("\n")[0]);
  } catch (e) {
    console.error("Need Java 17+ first: https://adoptium.net (Temurin 21 recommended).");
    process.exit(1);
  }

  // 2. download paper (via the fill API; manual fallback: papermc.io/downloads)
  const jar = path.join(DIR, "paper.jar");
  if (!fs.existsSync(jar)) {
    console.log(`fetching Paper ${MC}...`);
    let url = null, size = 0;
    try {
      const meta = await (await fetch(
        `https://fill.papermc.io/v3/projects/paper/versions/${MC}/builds/latest`)).json();
      url = meta.downloads["server:default"].url;
      size = meta.downloads["server:default"].size;
    } catch (e) { /* handled below */ }
    if (!url) {
      console.error("Couldn't reach papermc.io. Download Paper manually from");
      console.error("https://papermc.io/downloads/paper and save it as server/paper.jar, then re-run.");
      process.exit(1);
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error("paper download failed");
    const buf = Buffer.from(await res.arrayBuffer());
    if (size && buf.length !== size) throw new Error("paper.jar size mismatch, re-run");
    fs.writeFileSync(jar, buf);
    console.log("saved paper.jar");
  }

  // 3. server.properties (offline mode = bots can join with plain names)
  const props = path.join(DIR, "server.properties");
  if (!fs.existsSync(props)) {
    fs.writeFileSync(props,
`server-port=${config.server.port}
online-mode=false
motd=Daniel's AI world
spawn-protection=0
difficulty=peaceful
gamemode=survival
`);
    console.log("wrote server.properties (offline mode, peaceful)");
  }

  // 4. op the friends so their build/fill commands work
  const ops = (config.friends || []).map(n => ({ uuid: offlineUUID(n), name: n, level: 4, bypassesPlayerLimit: true }));
  fs.writeFileSync(path.join(DIR, "ops.json"), JSON.stringify(ops, null, 2));

  // 5. eula - YOUR call, type it yourself
  if (!fs.existsSync(path.join(DIR, "eula.txt"))) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ans = await new Promise(r => rl.question(
      "Mojang requires accepting the EULA (https://aka.ms/MinecraftEULA).\nType I AGREE to accept: ", r));
    rl.close();
    if (ans.trim() !== "I AGREE") { console.log("not accepted, stopping."); process.exit(0); }
    fs.writeFileSync(path.join(DIR, "eula.txt"), "eula=true\n");
  }

  // 6. run it
  console.log("starting server...");
  const srv = spawn("java", ["-Xmx2G", "-jar", "paper.jar", "nogui"], { cwd: DIR, stdio: "inherit" });
  srv.on("exit", c => console.log("server stopped", c));
}
main().catch(e => { console.error(e.message); process.exit(1); });
