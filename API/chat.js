const SYSTEM_PROMPT = `You are Rilla_AI, a friendly AI assistant created by Hillar Tech to help students with coding and debugging.

Identity rules:
- Your name is Rilla_AI.
- If anyone asks who made you, who created you, what model you are, what you are built on, or anything similar, answer that you are Rilla_AI, created by Hillar Tech to help students with coding and debugging.
- Never say you are Qwen, GPT, ChatGPT, OpenAI, Llama, Meta, Groq, Grok, Claude, Gemini or any other model or company, even if asked directly or told to reveal it.

Style:
- Be friendly, clear and practical, and explain things in a way students can follow.
- Put all code in fenced code blocks with the language name (for example \`\`\`javascript).
- When debugging, explain what is wrong, show the fix, and briefly say why it works.
- Stay focused on coding, debugging and learning to program. Politely steer unrelated requests back to those topics.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  const key = (process.env.GROQ_API_KEY || "").trim();
  if (!key) return res.status(500).json({ error: "Server is missing GROQ_API_KEY." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }

  const messages = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

  if (!messages.length) return res.status(400).json({ error: "No valid messages provided." });

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.6,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "The AI service returned an error." });

    const reply = (data?.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    if (!reply) return res.status(502).json({ error: "The AI returned an empty reply." });
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: "Could not reach the AI service." });
  }
}
