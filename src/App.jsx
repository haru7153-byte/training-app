import { useState, useEffect } from "react";
import { supabase } from "./supabase";

/* ─── Design tokens ─────────────────────────────── */
const C = {
  bg:        "#080C14",
  surface:   "#0F1520",
  card:      "#141C2C",
  cardHi:    "#1A2438",
  blue:      "#3B82F6",
  blueDark:  "#1D4ED8",
  cyan:      "#06B6D4",
  green:     "#10B981",
  orange:    "#F97316",
  yellow:    "#EAB308",
  red:       "#EF4444",
  purple:    "#8B5CF6",
  text:      "#F1F5F9",
  sub:       "#94A3B8",
  muted:     "#475569",
  border:    "#1E2D45",
  borderHi:  "#2A3F5F",
};

/* ─── Mock data ──────────────────────────────────── */
const ZONES = [
  { z: 1, name: "Active Recovery", pct: "<55%", color: "#64748B", watts: "<165" },
  { z: 2, name: "Endurance",       pct: "55–75%", color: C.blue,   watts: "165–225" },
  { z: 3, name: "Tempo",           pct: "76–90%", color: C.green,  watts: "226–270" },
  { z: 4, name: "Threshold",       pct: "91–105%", color: C.orange, watts: "271–315" },
  { z: 5, name: "VO2max",          pct: "106–120%", color: C.red,   watts: "316–360" },
];

const WORKOUTS = [
  {
    id: "w1", platform: "Zwift", name: "FTP Builder — Week 1",
    duration: 60, tss: 72, type: "Threshold",
    color: C.orange,
    blocks: [
      { pct: 50, min: 10, label: "W/U" },
      { pct: 88, min: 8, label: "Tempo" },
      { pct: 95, min: 10, label: "FTP" },
      { pct: 95, min: 10, label: "FTP" },
      { pct: 50, min: 5, label: "Rest" },
      { pct: 100, min: 12, label: "Threshold" },
      { pct: 50, min: 5, label: "C/D" },
    ],
  },
  {
    id: "w2", platform: "MyWhoosh", name: "Sweet Spot Intervals",
    duration: 75, tss: 80, type: "Sweet Spot",
    color: C.yellow,
    blocks: [
      { pct: 50, min: 10, label: "W/U" },
      { pct: 88, min: 15, label: "SS" },
      { pct: 55, min: 5, label: "Rest" },
      { pct: 88, min: 15, label: "SS" },
      { pct: 55, min: 5, label: "Rest" },
      { pct: 88, min: 15, label: "SS" },
      { pct: 50, min: 10, label: "C/D" },
    ],
  },
  {
    id: "w3", platform: "Zwift", name: "VO2max Ladder",
    duration: 50, tss: 85, type: "VO2max",
    color: C.red,
    blocks: [
      { pct: 50, min: 10, label: "W/U" },
      { pct: 110, min: 3, label: "V02" },
      { pct: 55, min: 3, label: "Rest" },
      { pct: 115, min: 3, label: "V02" },
      { pct: 55, min: 3, label: "Rest" },
      { pct: 120, min: 3, label: "V02" },
      { pct: 55, min: 3, label: "Rest" },
      { pct: 115, min: 3, label: "V02" },
      { pct: 55, min: 3, label: "Rest" },
      { pct: 50, min: 7, label: "C/D" },
    ],
  },
  {
    id: "w4", platform: "MyWhoosh", name: "Zone 2 Long Ride",
    duration: 90, tss: 65, type: "Endurance",
    color: C.blue,
    blocks: [
      { pct: 50, min: 10, label: "W/U" },
      { pct: 65, min: 70, label: "Z2" },
      { pct: 50, min: 10, label: "C/D" },
    ],
  },
];

const PLAN = [
  { date: "6/23", day: "月", workout: WORKOUTS[3], strava: null, rest: false },
  { date: "6/24", day: "火", workout: null, strava: null, rest: true },
  { date: "6/25", day: "水", workout: WORKOUTS[0], strava: { watts: 285, tss: 74, source: "Strava" }, rest: false },
  { date: "6/26", day: "木", workout: WORKOUTS[3], strava: null, rest: false },
  { date: "6/27", day: "金", workout: null, strava: null, rest: true },
  { date: "6/28", day: "土", workout: WORKOUTS[1], strava: null, rest: false },
  { date: "6/29", day: "日", workout: WORKOUTS[2], strava: null, rest: false },
];

/* ─── Tiny helpers ───────────────────────────────── */
function Badge({ label, color, bg }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
      padding: "2px 7px", borderRadius: 99,
      color: color || C.blue,
      background: bg || `${C.blue}22`,
    }}>{label}</span>
  );
}

function PlatformBadge({ platform }) {
  const cfg = platform === "Zwift"
    ? { color: "#FF6B00", bg: "#FF6B0022" }
    : { color: C.cyan, bg: `${C.cyan}22` };
  return <Badge label={platform} {...cfg} />;
}

function WorkoutBar({ blocks, ftp = 300, compact = false }) {
  const total = blocks.reduce((s, b) => s + b.min, 0);
  return (
    <div style={{ display: "flex", gap: 2, height: compact ? 28 : 44, borderRadius: 6, overflow: "hidden" }}>
      {blocks.map((b, i) => {
        const watts = Math.round(ftp * b.pct / 100);
        const zone = ZONES.find(z => b.pct < 55 ? z.z === 1 : b.pct < 76 ? z.z === 2 : b.pct < 91 ? z.z === 3 : b.pct < 106 ? z.z === 4 : z.z === 5) || ZONES[0];
        return (
          <div key={i} title={`${b.label} ${b.pct}% — ${watts}W`} style={{
            flex: b.min / total,
            background: zone.color,
            opacity: 0.85,
            position: "relative",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            paddingBottom: compact ? 0 : 4,
          }}>
            {!compact && b.min >= 5 && (
              <span style={{ fontSize: 9, color: "#fff", fontWeight: 700, opacity: 0.9 }}>{b.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.card, borderRadius: 16,
      border: `1px solid ${C.border}`,
      padding: "16px", ...style
    }}>{children}</div>
  );
}

/* ─── Pages ──────────────────────────────────────── */

// ── Home ──
function HomePage({ ftp, latestWeight }) {
  const pwr2wt = latestWeight ? (ftp / latestWeight).toFixed(2) : "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* FTP banner */}
      <div style={{
        background: `linear-gradient(135deg, ${C.blueDark}60, ${C.purple}30)`,
        borderRadius: 18, padding: "18px 18px",
        border: `1px solid ${C.blue}40`,
      }}>
        <div style={{ fontSize: 11, color: C.blue, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>現在のFTP</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <span style={{ fontSize: 48, fontWeight: 900, color: C.text, letterSpacing: "-0.04em", lineHeight: 1 }}>{ftp}</span>
          <span style={{ fontSize: 18, color: C.sub, marginBottom: 6 }}>W</span>
          <div style={{ marginBottom: 6, marginLeft: 4 }}>
            <div style={{ fontSize: 11, color: C.sub }}>パワーウェイト比</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.cyan }}>{pwr2wt} W/kg</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.sub, marginBottom: 4 }}>
            <span>目標 FTP: 320W</span><span>{Math.round(ftp / 320 * 100)}%</span>
          </div>
          <div style={{ background: C.border, borderRadius: 99, height: 5 }}>
            <div style={{ width: `${Math.round(ftp / 320 * 100)}%`, height: "100%", background: `linear-gradient(90deg, ${C.blue}, ${C.cyan})`, borderRadius: 99 }} />
          </div>
        </div>
      </div>

      {/* パワーゾーン */}
      <Card>
        <SectionTitle>パワーゾーン（FTP {ftp}W 基準）</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ZONES.map(z => (
            <div key={z.z} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: z.color, flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: C.sub, width: 32, flexShrink: 0 }}>Z{z.z}</div>
              <div style={{ fontSize: 12, color: C.text, flex: 1 }}>{z.name}</div>
              <div style={{ fontSize: 12, color: z.color, fontWeight: 700, textAlign: "right" }}>
                {z.watts.includes("<") ? `< ${Math.round(ftp * 0.55)}` : z.watts === "316–360" ? `${Math.round(ftp * 1.06)}–${Math.round(ftp * 1.2)}` : z.watts === "271–315" ? `${Math.round(ftp * 0.91)}–${Math.round(ftp * 1.05)}` : z.watts === "226–270" ? `${Math.round(ftp * 0.76)}–${Math.round(ftp * 0.90)}` : `${Math.round(ftp * 0.55)}–${Math.round(ftp * 0.75)}`} W
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 今日のワークアウト */}
      <Card>
        <SectionTitle>今日のメニュー</SectionTitle>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{WORKOUTS[3].name}</div>
            <div style={{ display: "flex", gap: 6 }}>
              <PlatformBadge platform={WORKOUTS[3].platform} />
              <Badge label={`${WORKOUTS[3].duration}分`} color={C.sub} bg={`${C.muted}30`} />
              <Badge label={`TSS ${WORKOUTS[3].tss}`} color={C.green} bg={`${C.green}22`} />
            </div>
          </div>
          <button style={{
            background: C.blue, color: "#fff", border: "none",
            borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>開始 ›</button>
        </div>
        <WorkoutBar blocks={WORKOUTS[3].blocks} ftp={ftp} />
      </Card>

      {/* 今週サマリー */}
      <Card>
        <SectionTitle>今週のTSS</SectionTitle>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 50 }}>
          {[55, 0, 74, 65, 0, 80, 85].map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: "100%", height: v ? `${v / 85 * 100}%` : 4,
                background: v ? (i === 2 ? `linear-gradient(180deg, ${C.green}, ${C.green}80)` : `linear-gradient(180deg, ${C.blue}, ${C.blueDark})`) : C.border,
                borderRadius: 4, minHeight: 4,
              }} />
              <div style={{ fontSize: 9, color: i === 3 ? C.blue : C.muted }}>{"月火水木金土日"[i]}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: C.sub }}>累計TSS <b style={{ color: C.text }}>359</b> / 目標 420</span>
          <span style={{ fontSize: 11, color: C.orange }}>あと 61</span>
        </div>
      </Card>
    </div>
  );
}

// ── Plan ──
function PlanPage({ ftp }) {
  const [selected, setSelected] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{
        background: `linear-gradient(120deg, ${C.purple}30, ${C.blue}20)`,
        borderRadius: 14, padding: "14px 16px",
        border: `1px solid ${C.purple}40`,
        display: "flex", gap: 12, alignItems: "center",
      }}>
        <div style={{ fontSize: 28 }}>🤖</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>AI コーチからの提案</div>
          <div style={{ fontSize: 11, color: C.sub }}>FTP +20W（320W目標）に向けた8週間プラン。今週はベース強化フェーズです。</div>
        </div>
      </div>

      <SectionTitle>今週のスケジュール</SectionTitle>
      {PLAN.map((day, i) => (
        <div key={i}>
          <div
            onClick={() => !day.rest && day.workout && setSelected(selected === i ? null : i)}
            style={{
              background: selected === i ? C.cardHi : C.card,
              borderRadius: 14, padding: "12px 14px",
              border: `1px solid ${selected === i ? C.borderHi : C.border}`,
              cursor: day.workout ? "pointer" : "default",
              transition: "all 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: C.muted }}>{day.date}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: i === 3 ? C.blue : C.text }}>{day.day}</div>
              </div>

              {day.rest ? (
                <div style={{ flex: 1, fontSize: 12, color: C.muted }}>🛌 休養日</div>
              ) : (
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{day.workout.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
                    <PlatformBadge platform={day.workout.platform} />
                    <Badge label={`${day.workout.duration}分`} color={C.sub} bg={`${C.muted}30`} />
                    <Badge label={day.workout.type} color={day.workout.color} bg={`${day.workout.color}22`} />
                  </div>
                  <WorkoutBar blocks={day.workout.blocks} ftp={ftp} compact />
                </div>
              )}

              {day.strava ? (
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>✓ 完了</div>
                  <div style={{ fontSize: 10, color: C.sub }}>NP {day.strava.watts}W</div>
                </div>
              ) : !day.rest && (
                <div style={{ flexShrink: 0, fontSize: 18, color: C.muted }}>›</div>
              )}
            </div>

            {day.strava && (
              <div style={{
                marginTop: 10, padding: "8px 10px",
                background: `${C.green}15`, borderRadius: 8,
                border: `1px solid ${C.green}30`,
                display: "flex", gap: 16,
              }}>
                <div>
                  <div style={{ fontSize: 9, color: C.sub }}>計画NP</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{Math.round(ftp * 0.92)}W</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.sub }}>実績NP</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{day.strava.watts}W</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.sub }}>TSS</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{day.strava.tss}</div>
                </div>
                <Badge label="Strava連携" color="#FC4C02" bg="#FC4C0222" />
              </div>
            )}
          </div>

          {selected === i && day.workout && (
            <div style={{
              background: C.surface, borderRadius: "0 0 14px 14px",
              border: `1px solid ${C.borderHi}`, borderTop: "none",
              padding: "14px",
            }}>
              <WorkoutBar blocks={day.workout.blocks} ftp={ftp} />
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {day.workout.blocks.map((b, j) => (
                  <div key={j} style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 8,
                    background: C.card, border: `1px solid ${C.border}`,
                    color: C.sub,
                  }}>
                    <b style={{ color: C.text }}>{b.label}</b> {b.min}分 @ {b.pct}% ({Math.round(ftp * b.pct / 100)}W)
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Weight ── ★ Supabase対応
function WeightPage({ onWeightUpdate }) {
  const [log, setLog] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // 起動時にSupabaseからデータ取得
  useEffect(() => {
    fetchWeights();
  }, []);

  async function fetchWeights() {
    setLoading(true);
    const { data, error } = await supabase
      .from("weight_log")
      .select("*")
      .order("recorded_at", { ascending: true });
    if (!error && data.length > 0) {
      const formatted = data.map(d => ({
        id: d.id,
        d: new Date(d.recorded_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }),
        w: parseFloat(d.weight),
      }));
      setLog(formatted);
      onWeightUpdate(formatted[formatted.length - 1].w);
    }
    setLoading(false);
  }

  async function addWeight() {
    const v = parseFloat(input);
    if (!v || v < 30 || v > 200) return;
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    // 同じ日付のデータを先に削除してから挿入
await supabase
.from("weight_log")
.delete()
.eq("recorded_at", today);

const { error } = await supabase
.from("weight_log")
.insert({ weight: v, recorded_at: today });
    if (error) {
      setMsg("❌ 保存に失敗しました");
    } else {
      setMsg("✅ 保存しました！");
      setInput("");
      await fetchWeights();
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  }

  const displayLog = log.length > 0 ? log : [{ d: "—", w: 0 }];
  const latest = displayLog[displayLog.length - 1].w;
  const start = displayLog[0].w;
  const diff = (latest - start).toFixed(1);
  const minW = Math.min(...displayLog.map(d => d.w), 69) - 1;
  const maxW = Math.max(...displayLog.map(d => d.w), 76) + 1;
  const range = maxW - minW || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: 10 }}>
        {[
          { label: "現在", val: latest ? `${latest} kg` : "—", color: C.text },
          { label: "目標", val: "70.0 kg", color: C.cyan },
          { label: "変化", val: latest && start ? `${diff} kg` : "—", color: parseFloat(diff) < 0 ? C.green : C.red },
        ].map((s, i) => (
          <Card key={i} style={{ flex: 1, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: C.sub, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: s.color }}>{s.val}</div>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <SectionTitle>体重推移</SectionTitle>
        {loading ? (
          <div style={{ textAlign: "center", color: C.muted, padding: 20 }}>読み込み中...</div>
        ) : log.length < 2 ? (
          <div style={{ textAlign: "center", color: C.muted, padding: 20 }}>データを記録すると表示されます</div>
        ) : (
          <>
            <div style={{ position: "relative", height: 120 }}>
              <svg width="100%" height="100%" viewBox="0 0 300 120" preserveAspectRatio="none">
                {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
                  <line key={i} x1={0} y1={v * 120} x2={300} y2={v * 120} stroke={C.border} strokeWidth={1} />
                ))}
                <defs>
                  <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.cyan} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={C.cyan} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <polygon
                  points={[
                    ...log.map((d, i) => `${(i / (log.length - 1)) * 300},${((maxW - d.w) / range) * 110 + 5}`),
                    "300,120", "0,120"
                  ].join(" ")}
                  fill="url(#wgrad)"
                />
                <polyline
                  points={log.map((d, i) => `${(i / (log.length - 1)) * 300},${((maxW - d.w) / range) * 110 + 5}`).join(" ")}
                  fill="none" stroke={C.cyan} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                />
                {log.map((d, i) => (
                  <circle key={i} cx={(i / (log.length - 1)) * 300} cy={((maxW - d.w) / range) * 110 + 5}
                    r={4} fill={C.bg} stroke={C.cyan} strokeWidth={2} />
                ))}
                <line x1={0} y1={((maxW - 70) / range) * 110 + 5} x2={300} y2={((maxW - 70) / range) * 110 + 5}
                  stroke={C.green} strokeWidth={1} strokeDasharray="4,3" />
              </svg>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              {log.map((d, i) => <div key={i} style={{ fontSize: 9, color: C.muted }}>{d.d}</div>)}
            </div>
          </>
        )}
      </Card>

      {/* Input */}
      <Card>
        <SectionTitle>今日の体重を記録</SectionTitle>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="number" value={input} onChange={e => setInput(e.target.value)}
            placeholder="73.5"
            style={{
              flex: 1, background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: "10px 14px", color: C.text, fontSize: 16,
              outline: "none",
            }}
          />
          <span style={{ alignSelf: "center", color: C.sub, fontSize: 14 }}>kg</span>
          <button onClick={addWeight} disabled={saving} style={{
            background: saving ? C.muted : C.blue, color: "#fff", border: "none",
            borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
          }}>{saving ? "保存中..." : "記録"}</button>
        </div>
        {msg && <div style={{ marginTop: 8, fontSize: 12, color: msg.includes("✅") ? C.green : C.red }}>{msg}</div>}
      </Card>

      {/* Log */}
      <Card>
        <SectionTitle>履歴</SectionTitle>
        {loading ? (
          <div style={{ color: C.muted, fontSize: 12 }}>読み込み中...</div>
        ) : log.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 12 }}>まだデータがありません</div>
        ) : (
          [...log].reverse().map((d, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between",
              padding: "8px 0", borderBottom: i < log.length - 1 ? `1px solid ${C.border}` : "none",
            }}>
              <span style={{ fontSize: 13, color: C.sub }}>{d.d}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{d.w} kg</span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

// ── Goals ── ★ Supabase対応
function GoalsPage({ ftp, setFtp, latestWeight }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(ftp));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function saveFtp() {
    const v = parseInt(draft);
    if (!v || v <= 0) return;
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("ftp_log")
      .insert({ ftp: v, recorded_at: today });
    if (error) {
      setMsg("❌ 保存に失敗しました");
    } else {
      setFtp(v);
      setEditing(false);
      setMsg("✅ FTPを保存しました！");
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  }

  const weightDiff = latestWeight ? (latestWeight - 70).toFixed(1) : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionTitle>目標設定</SectionTitle>

      {msg && (
        <div style={{
          padding: "10px 14px", borderRadius: 10, fontSize: 12,
          background: msg.includes("✅") ? `${C.green}20` : `${C.red}20`,
          color: msg.includes("✅") ? C.green : C.red,
          border: `1px solid ${msg.includes("✅") ? C.green : C.red}40`,
        }}>{msg}</div>
      )}

      {/* FTP goal */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>FTP（Functional Threshold Power）</div>
            <div style={{ fontSize: 11, color: C.sub }}>60分継続できる最大平均パワー</div>
          </div>
          <button onClick={() => { setEditing(!editing); setMsg(""); }} style={{
            background: editing ? C.green : C.surface, color: editing ? "#fff" : C.sub,
            border: `1px solid ${editing ? C.green : C.border}`,
            borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}>{editing ? "キャンセル" : "編集"}</button>
        </div>

        <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
          <div style={{ flex: 1, background: C.surface, borderRadius: 12, padding: "14px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.sub, marginBottom: 4 }}>現在のFTP</div>
            {editing ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input value={draft} onChange={e => setDraft(e.target.value)}
                    style={{
                      background: "transparent", border: "none", outline: "none",
                      fontSize: 28, fontWeight: 900, color: C.text, width: 80,
                    }} />
                  <span style={{ color: C.sub }}>W</span>
                </div>
                <button onClick={saveFtp} disabled={saving} style={{
                  marginTop: 8, background: saving ? C.muted : C.blue,
                  color: "#fff", border: "none", borderRadius: 6,
                  padding: "6px 12px", fontSize: 11, fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                }}>{saving ? "保存中..." : "保存"}</button>
              </div>
            ) : (
              <div style={{ fontSize: 28, fontWeight: 900, color: C.text }}>{ftp}<span style={{ fontSize: 14, color: C.sub, marginLeft: 4 }}>W</span></div>
            )}
          </div>
          <div style={{ flex: 1, background: C.surface, borderRadius: 12, padding: "14px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.sub, marginBottom: 4 }}>目標FTP</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.cyan }}>320<span style={{ fontSize: 14, color: C.sub, marginLeft: 4 }}>W</span></div>
          </div>
        </div>

        <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
          <span style={{ color: C.sub }}>達成まで <b style={{ color: C.text }}>+{320 - ftp}W</b></span>
          <span style={{ color: C.blue }}>{Math.round(ftp / 320 * 100)}%</span>
        </div>
        <div style={{ background: C.border, borderRadius: 99, height: 6 }}>
          <div style={{ width: `${ftp / 320 * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.blue}, ${C.cyan})`, borderRadius: 99, transition: "width 0.4s" }} />
        </div>
      </Card>

      {/* Other goals */}
      {[
        { icon: "🏆", label: "レース目標", val: "グランフォンドKyoto 2025", sub: "2025年9月14日", color: C.orange },
        { icon: "⚖️", label: "目標体重", val: "70.0 kg", sub: latestWeight ? `現在 ${latestWeight} kg / 残り ${weightDiff} kg` : "体重を記録してください", color: C.cyan },
        { icon: "📅", label: "週間トレーニング", val: "週4回", sub: "平均週3.2回達成中", color: C.green },
      ].map((g, i) => (
        <Card key={i} style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ fontSize: 28 }}>{g.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 2 }}>{g.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: g.color }}>{g.val}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{g.sub}</div>
          </div>
          <div style={{ color: C.muted }}>›</div>
        </Card>
      ))}

      {/* AI提案 */}
      <Card style={{ background: `${C.purple}15`, border: `1px solid ${C.purple}30` }}>
        <div style={{ fontSize: 11, color: C.purple, fontWeight: 700, marginBottom: 8 }}>🤖 AIアドバイス</div>
        <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
          現在のFTP {ftp}Wから320W達成まで約<b style={{ color: C.text }}>8〜12週間</b>のプランが最適です。週に<b style={{ color: C.text }}>スイートスポット2回＋Z2ロング1回</b>の組み合わせでTSSを段階的に上げていきましょう。
        </div>
      </Card>
    </div>
  );
}

// ── Strava ──
function StravaPage() {
  const [activities, setActivities] = useState([]);
  const [athlete, setAthlete] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("strava_token");
    const a = params.get("athlete");
    if (t) {
      setToken(t);
      localStorage.setItem("strava_token", t);
    } else {
      const saved = localStorage.getItem("strava_token");
      if (saved) setToken(saved);
    }
    if (a) {
      const parsed = JSON.parse(decodeURIComponent(a));
      setAthlete(parsed);
      localStorage.setItem("strava_athlete", JSON.stringify(parsed));
    } else {
      const saved = localStorage.getItem("strava_athlete");
      if (saved) setAthlete(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (token) fetchActivities(token);
  }, [token]);

  async function fetchActivities(t) {
    setLoading(true);
    const res = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=10",
      { headers: { Authorization: `Bearer ${t}` } }
    );
    const data = await res.json();
    if (Array.isArray(data)) setActivities(data);
    setLoading(false);
  }

  function connectStrava() {
    const clientId = "260703";
    const redirect = `https://training-app-git-main-haru10.vercel.app/api/strava-callback`;
    const scope = "activity:read_all";
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=${scope}`;
  }

  function logout() {
    localStorage.removeItem("strava_token");
    localStorage.removeItem("strava_athlete");
    setToken(null);
    setAthlete(null);
    setActivities([]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!token ? (
        <Card style={{ textAlign: "center", padding: "32px 16px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚴</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            Stravaと連携する
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 20 }}>
            活動データを自動で取得してトレーニング計画と照合します
          </div>
          <button onClick={connectStrava} style={{
            background: "#FC4C02", color: "#fff", border: "none",
            borderRadius: 12, padding: "14px 28px",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>Stravaでログイン</button>
        </Card>
      ) : (
        <>
          {athlete && (
            <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src={athlete.profile} alt="" style={{ width: 48, height: 48, borderRadius: "50%" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{athlete.firstname} {athlete.lastname}</div>
                <div style={{ fontSize: 11, color: C.green }}>✓ Strava連携中</div>
              </div>
              <button onClick={logout} style={{
                background: "transparent", color: C.muted, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer",
              }}>切断</button>
            </Card>
          )}

          <SectionTitle>最近の活動</SectionTitle>
          {loading ? (
            <div style={{ textAlign: "center", color: C.muted, padding: 20 }}>読み込み中...</div>
          ) : activities.map((act, i) => (
            <Card key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{act.name}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>{new Date(act.start_date_local).toLocaleDateString("ja-JP")}</div>
                </div>
                <Badge label={act.type === "Ride" ? "🚴 ライド" : "🏃 ラン"} color={C.orange} bg={`${C.orange}22`} />
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                {[
                  { label: "距離", val: `${(act.distance / 1000).toFixed(1)} km` },
                  { label: "時間", val: `${Math.floor(act.moving_time / 60)}分` },
                  { label: "獲得標高", val: `${act.total_elevation_gain}m` },
                ].map((s, j) => (
                  <div key={j}>
                    <div style={{ fontSize: 10, color: C.muted }}>{s.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
/* ─── Shell ──────────────────────────────────────── */
const TABS = [
  { id: "home", label: "ホーム", icon: "⚡" },
  { id: "plan", label: "プラン", icon: "📅" },
  { id: "strava", label: "Strava", icon: "🚴" },
  { id: "weight", label: "体重", icon: "⚖️" },
  { id: "goals", label: "目標", icon: "🎯" },
];

export default function App() {
  const [tab, setTab] = useState("home");
  const [ftp, setFtp] = useState(300);
  const [latestWeight, setLatestWeight] = useState(null);

  // 起動時にSupabaseから最新FTPを取得
  useEffect(() => {
    async function fetchLatestFtp() {
      const { data } = await supabase
        .from("ftp_log")
        .select("ftp")
        .order("recorded_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) setFtp(data[0].ftp);
    }
    fetchLatestFtp();
  }, []);

  const pages = {
    home:   <HomePage ftp={ftp} latestWeight={latestWeight} />,
    plan:   <PlanPage ftp={ftp} />,
    strava: <StravaPage />,
    weight: <WeightPage onWeightUpdate={setLatestWeight} />,
    goals:  <GoalsPage ftp={ftp} setFtp={setFtp} latestWeight={latestWeight} />,
  };

  return (
    <div style={{
      background: "#04080F",
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
    }}>
      <div style={{
        width: 375, height: 812,
        background: C.bg,
        borderRadius: 46,
        border: `1.5px solid ${C.border}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 50px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}>
        {/* Status bar */}
        <div style={{ padding: "16px 28px 0", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>9:41</div>
          <div style={{ width: 90, height: 22, background: "#000", borderRadius: 99 }} />
          <div style={{ fontSize: 11, color: C.sub }}>⚡100%</div>
        </div>

        {/* Page title */}
        <div style={{ padding: "14px 20px 0", flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: "-0.03em" }}>
            {tab === "home" && "ダッシュボード"}
            {tab === "plan" && "トレーニング計画"}
            {tab === "weight" && "体重ログ"}
            {tab === "goals" && "目標管理"}
          </div>
          {tab === "plan" && (
            <div style={{ fontSize: 11, color: C.blue, marginTop: 2, fontWeight: 600 }}>
              2025年6月 第4週 ・ Strava連携中 ✓
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 0" }}>
          {pages[tab]}
          <div style={{ height: 24 }} />
        </div>

        {/* Bottom nav */}
        <div style={{
          background: C.surface,
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          padding: "10px 0 26px",
          flexShrink: 0,
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, border: "none", background: "transparent",
              cursor: "pointer", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 3, padding: "4px 0",
            }}>
              <div style={{
                fontSize: 22,
                filter: tab === t.id ? "none" : "grayscale(1) opacity(0.35)",
                transition: "filter 0.2s",
              }}>{t.icon}</div>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                color: tab === t.id ? C.blue : C.muted,
                transition: "color 0.2s",
              }}>{t.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}