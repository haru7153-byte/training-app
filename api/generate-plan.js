const platform = req.body?.platform || "Zwift";
export default async function handler(req, res) {
  const ftp = req.body?.ftp || 300;
  const targetFtp = req.body?.targetFtp || 320;
  const weight = req.body?.weight || 73;
  const raceName = req.body?.raceName || "レース";
  const weeksAvailable = req.body?.weeksAvailable || 12;

  const content = "サイクリングコーチとして週間計画をJSON形式のみで返してください。使用プラットフォームは" + platform + "のみ。FTP:" + ftp + "W
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: content }],
      }),
    });
    const d = await r.json();
    const text = d.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    res.status(200).json(JSON.parse(match[0]));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}