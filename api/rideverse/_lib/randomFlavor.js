// The spec caps randomness at 10% influence — just enough to stop two riders
// with near-identical bikes/answers from getting an identical veria. Pick one
// small flavor hint per generation and tell the model it's a minor accent only.
const FLAVOR_HINTS = [
  '少しだけ人見知りな一面',
  '小さな癖でしっぽの先が少し揺れる',
  'たまに眠そうな目をする',
  '好奇心できょろきょろする仕草',
  '照れると声が小さくなる',
  '風が吹くとちょっと誇らしげになる',
  '甘いものの匂いに敏感',
  '朝が少しだけ苦手',
]

export function pickRandomFlavorHint() {
  return FLAVOR_HINTS[Math.floor(Math.random() * FLAVOR_HINTS.length)]
}
