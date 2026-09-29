"use strict";
// Starts one bot process per friend in config.yaml:  node bots/start-bots.js
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ROOT = path.join(__dirname, "..");
const config = yaml.load(fs.readFileSync(path.join(ROOT, "config.yaml"), "utf8"));
const kids = [];

for (const friend of config.friends) {
  console.log(`starting ${friend}...`);
  const kid = spawn(process.execPath, [path.join(__dirname, "bot.js"), friend],
                    { stdio: "inherit" });
  kids.push(kid);
}

process.on("SIGINT", () => {
  console.log("\nstopping friends...");
  for (const k of kids) k.kill("SIGINT");
  setTimeout(() => process.exit(0), 1500);
});
