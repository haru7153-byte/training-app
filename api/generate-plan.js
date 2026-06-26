export default async function handler(req, res) {
    const ftp = req.body?.ftp || 300;
    const targetFtp = req.body?.targetFtp || 320;
    const weight = req.body?.weight || 73;
    const raceName = req.body?.raceName || "レース";
    const weeksAvailable = req.body?.weeksAvailable || 12;
    const platform = req.body?.platform || "Zwift";
  
    const content = "cycling coach. return ONLY this JSON, no explanation, keep all text under 10 chars: {\"phase\":\"name\",\"weeklyTSS\":300,\"advice\":\"tip\",\"days\":[{\"day\":\"月\",\"type\":\"workout\",\"platform\":\"" + platform + "\",\"name\":\"workout name\",\"duration\":60,\"tss\":70,\"zone\":\"Endurance\",\"description\":\"tip\"},{\"day\":\"火\",\"type\":\"rest\"},{\"day\":\"水\",\"type\":\"workout\",\"platform\":\"" + platform + "\",\"name\":\"workout name\",\"duration\":75,\"tss\":80,\"zone\":\"Threshold\",\"description\":\"tip\"},{\"day\":\"木\",\"type\":\"rest\"},{\"day\":\"金\",\"type\":\"workout\",\"platform\":\"" + platform + "\",\"name\":\"workout name\",\"duration\":50,\"tss\":85,\"zone\":\"VO2max\",\"description\":\"tip\"},{\"day\":\"土\",\"type\":\"workout\",\"platform\":\"" + platform + "\",\"name\":\"workout name\",\"duration\":90,\"tss\":65,\"zone\":\"Endurance\",\"description\":\"tip\"},{\"day\":\"日\",\"type\":\"rest\"}]} FTP:" + ftp + " target:" + targetFtp + " race:" + raceName;  
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 700,
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