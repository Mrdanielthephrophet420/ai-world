"use strict";
// Talks to the "brain" behind each friend: Ollama (local, default) or any
// OpenAI-compatible API. Never put API keys in config.yaml - use env vars.

async function ollamaChat(messages, cfg) {
  const res = await fetch(`${cfg.ollama_url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: cfg.model, messages, stream: false,
                           options: { temperature: 0.9, num_predict: 220 } }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.message && data.message.content ? data.message.content : "";
}

async function openaiCompatChat(messages, cfg) {
  const key = process.env[cfg.openai_key_env || "OPENAI_API_KEY"];
  if (!key) throw new Error(`env var ${cfg.openai_key_env} is not set`);
  const res = await fetch(`${cfg.openai_base_url}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: cfg.model, messages, temperature: 0.9, max_tokens: 220 }),
  });
  if (!res.ok) throw new Error(`llm ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content || "";
}

async function chat(messages, brainCfg) {
  if (brainCfg.backend === "openai_compat") return openaiCompatChat(messages, brainCfg);
  return ollamaChat(messages, brainCfg);
}

module.exports = { chat };
