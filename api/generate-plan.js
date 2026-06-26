export default async function handler(req, res) {
    res.status(200).json({ok: true, key: !!process.env.ANTHROPIC_API_KEY});
  }