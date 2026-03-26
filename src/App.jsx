import { useState, useEffect, useRef } from "react";

// ─── Analytics helper ───────────────────────────────────────────────────────
// Fires a GA4 custom event. Safe to call even if gtag isn't loaded yet.
function track(eventName, params = {}) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}

// ─── Data ────────────────────────────────────────────────────────────────────
const BENCHMARKS = {
  B2B:       { impressionToClick: 0.022, clickToLead: 0.031, leadToMQL: 0.42, MQLtoSQL: 0.38, SQLtoClose: 0.29 },
  B2C:       { impressionToClick: 0.038, clickToLead: 0.052, leadToMQL: 0.55, MQLtoSQL: 0.45, SQLtoClose: 0.36 },
  SaaS:      { impressionToClick: 0.028, clickToLead: 0.041, leadToMQL: 0.48, MQLtoSQL: 0.41, SQLtoClose: 0.32 },
  Ecommerce: { impressionToClick: 0.045, clickToLead: 0.068, leadToMQL: 0.61, MQLtoSQL: 0.52, SQLtoClose: 0.41 },
};

const STAGES = [
  { key: "impressions", label: "Impressions", icon: "👁️",  color: "#6EE7F7" },
  { key: "clicks",      label: "Clicks",      icon: "🖱️",  color: "#67E8B0" },
  { key: "leads",       label: "Leads",       icon: "📋",  color: "#FCD34D" },
  { key: "mqls",        label: "MQLs",        icon: "🎯",  color: "#F9A87B" },
  { key: "sqls",        label: "SQLs",        icon: "💼",  color: "#F87171" },
  { key: "customers",   label: "Customers",   icon: "🏆",  color: "#C084FC" },
];

const DEFAULT_VALUES = { impressions: 250000, clicks: 5500, leads: 170, mqls: 71, sqls: 27, customers: 8 };
const RATE_KEYS   = ["impressionToClick","clickToLead","leadToMQL","MQLtoSQL","SQLtoClose"];
const RATE_LABELS = ["Impression → Click","Click → Lead","Lead → MQL","MQL → SQL","SQL → Customer"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getRating(actual, benchmark) {
  const r = actual / benchmark;
  if (r >= 1.2) return { label: "Excellent",  color: "#67E8B0", emoji: "🚀" };
  if (r >= 0.9) return { label: "On Track",   color: "#6EE7F7", emoji: "✅" };
  if (r >= 0.6) return { label: "Below Avg",  color: "#FCD34D", emoji: "⚠️" };
  return             { label: "Needs Work", color: "#F87171", emoji: "🔴" };
}

function AnimatedBar({ pct, color, delay = 0 }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 80 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div style={{ background:"#1a1a2e", borderRadius:8, height:10, overflow:"hidden", width:"100%" }}>
      <div style={{ width:`${width}%`, height:"100%", background:color, borderRadius:8, transition:"width 0.7s cubic-bezier(0.4,0,0.2,1)", boxShadow:`0 0 10px ${color}88` }} />
    </div>
  );
}

function NumberInput({ value, onChange }) {
  return (
    <input type="number" value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ background:"#0d0d1a", border:"1px solid #2a2a4a", borderRadius:8, color:"#e2e8f0", fontFamily:"'DM Mono',monospace", fontSize:14, padding:"6px 10px", width:120, outline:"none", textAlign:"right", transition:"border-color 0.2s" }}
      onFocus={(e) => (e.target.style.borderColor = "#6EE7F7")}
      onBlur={(e)  => (e.target.style.borderColor = "#2a2a4a")} />
  );
}

// ─── Canvas share-card renderer ───────────────────────────────────────────────
function drawShareCard(canvas, { values, rates, industry, bench, overallConversion, benchmarkOverall, overallRating }) {
  const W = 800, H = 480;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#07071a"; ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = "#1a1a2e"; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Top gradient bar
  const grd = ctx.createLinearGradient(0,0,W,0);
  grd.addColorStop(0,"#6EE7F7"); grd.addColorStop(1,"#C084FC");
  ctx.fillStyle = grd; ctx.fillRect(0,0,W,4);

  // Border
  ctx.strokeStyle = "#1e1e3a"; ctx.lineWidth = 1; ctx.strokeRect(0,0,W,H);

  // Title
  ctx.fillStyle = "#f1f5f9"; ctx.font = "bold 26px Arial";
  ctx.fillText("📊 My Funnel Benchmarks", 40, 56);

  // Industry badge
  ctx.fillStyle = "#12122a"; ctx.beginPath(); ctx.roundRect(40,68,90,24,6); ctx.fill();
  ctx.fillStyle = "#6EE7F7"; ctx.font = "bold 11px Arial";
  ctx.fillText(industry.toUpperCase(), 52, 85);

  // Overall verdict
  ctx.textAlign = "right";
  ctx.fillStyle = overallRating.color; ctx.font = "bold 30px Arial";
  ctx.fillText(`${overallRating.emoji} ${overallRating.label}`, W-40, 56);
  ctx.fillStyle = "#475569"; ctx.font = "13px 'Courier New'";
  ctx.fillText(`${overallConversion.toFixed(4)}% overall  vs  ${benchmarkOverall.toFixed(4)}% avg`, W-40, 78);
  ctx.textAlign = "left";

  // Divider
  ctx.strokeStyle = "#1e1e3a"; ctx.beginPath(); ctx.moveTo(40,108); ctx.lineTo(W-40,108); ctx.stroke();

  // Left column — stage conversion rates
  const colW = (W-80)/2 - 20;
  RATE_KEYS.forEach((key, i) => {
    const actual = rates[key], bmark = bench[key];
    const r = getRating(actual, bmark);
    const y = 130 + i * 60, x = 40;

    ctx.fillStyle = "#94a3b8"; ctx.font = "12px Arial"; ctx.fillText(RATE_LABELS[i], x, y);
    ctx.fillStyle = "#f1f5f9"; ctx.font = "bold 16px 'Courier New'";
    ctx.fillText(`${(actual*100).toFixed(1)}%`, x, y+18);

    ctx.fillStyle = r.color+"33"; ctx.beginPath(); ctx.roundRect(x+72,y+4,86,18,4); ctx.fill();
    ctx.fillStyle = r.color; ctx.font = "bold 11px Arial";
    ctx.fillText(`${r.emoji} ${r.label}`, x+80, y+17);

    ctx.fillStyle = "#1a1a2e"; ctx.beginPath(); ctx.roundRect(x,y+26,colW,8,4); ctx.fill();
    const pct = Math.min(actual/(bmark*2),1);
    const bg = ctx.createLinearGradient(x,0,x+colW,0);
    bg.addColorStop(0,STAGES[i].color); bg.addColorStop(1,STAGES[i].color+"88");
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x,y+26,colW*pct,8,4); ctx.fill();

    ctx.fillStyle = "#334155"; ctx.font = "10px 'Courier New'";
    ctx.fillText(`benchmark: ${(bmark*100).toFixed(1)}%`, x, y+50);
  });

  // Right column — funnel volumes
  const rx = W/2+20;
  ctx.fillStyle = "#94a3b8"; ctx.font = "bold 11px Arial"; ctx.fillText("FUNNEL VOLUMES", rx, 130);

  STAGES.forEach((s,i) => {
    const val = values[s.key], maxVal = values.impressions||1;
    const barMax = W-rx-40-110;
    const barLen = (val/maxVal)*barMax;
    const y = 148 + i*48;

    ctx.fillStyle = "#64748b"; ctx.font = "12px Arial"; ctx.fillText(`${s.icon} ${s.label}`, rx, y+14);

    ctx.fillStyle = s.color+"33"; ctx.beginPath(); ctx.roundRect(rx,y+20,barMax,10,3); ctx.fill();
    ctx.fillStyle = s.color; ctx.beginPath(); ctx.roundRect(rx,y+20,Math.max(barLen,6),10,3); ctx.fill();

    ctx.textAlign = "right";
    ctx.fillStyle = "#cbd5e1"; ctx.font = "bold 13px 'Courier New'";
    ctx.fillText(val>=1000?`${(val/1000).toFixed(1)}k`:val, W-40, y+30);
    ctx.textAlign = "left";
  });

  // Footer
  ctx.fillStyle = "#0d0d20"; ctx.fillRect(0,H-36,W,36);
  ctx.strokeStyle = "#1e1e3a"; ctx.beginPath(); ctx.moveTo(0,H-36); ctx.lineTo(W,H-36); ctx.stroke();
  ctx.fillStyle = "#334155"; ctx.font = "11px 'Courier New'";
  ctx.fillText("Funnel Benchmarks Calculator", 40, H-13);
  ctx.textAlign = "right";
  ctx.fillText("Built with Claude AI  ✦", W-40, H-13);
  ctx.textAlign = "left";
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FunnelCalculator() {
  const [values, setValues]       = useState(DEFAULT_VALUES);
  const [industry, setIndustry]   = useState("B2B");
  const [showShare, setShowShare] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [imgUrl, setImgUrl]       = useState(null);
  const canvasRef = useRef(null);

  // Track first load
  useEffect(() => { track("calculator_view"); }, []);

  const bench = BENCHMARKS[industry];
  const rates = {
    impressionToClick: values.impressions > 0 ? values.clicks    / values.impressions : 0,
    clickToLead:       values.clicks      > 0 ? values.leads     / values.clicks      : 0,
    leadToMQL:         values.leads       > 0 ? values.mqls      / values.leads       : 0,
    MQLtoSQL:          values.mqls        > 0 ? values.sqls      / values.mqls        : 0,
    SQLtoClose:        values.sqls        > 0 ? values.customers / values.sqls        : 0,
  };

  const overallConversion = values.impressions > 0 ? (values.customers / values.impressions) * 100 : 0;
  const benchmarkOverall  = bench.impressionToClick * bench.clickToLead * bench.leadToMQL * bench.MQLtoSQL * bench.SQLtoClose * 100;
  const overallRating     = getRating(overallConversion, benchmarkOverall);

  const set = (key) => (val) => setValues((v) => ({ ...v, [key]: val }));

  // Rebuild canvas whenever inputs or industry change while share is open
  useEffect(() => {
    if (showShare && canvasRef.current) {
      drawShareCard(canvasRef.current, { values, rates, industry, bench, overallConversion, benchmarkOverall, overallRating });
      setImgUrl(canvasRef.current.toDataURL("image/png"));
    }
  }, [values, industry, showShare]);

  const handleGenerateCard = () => {
    track("share_card_opened", { industry, overall_rating: overallRating.label });
    setShowShare(true);
    setTimeout(() => {
      if (canvasRef.current) {
        drawShareCard(canvasRef.current, { values, rates, industry, bench, overallConversion, benchmarkOverall, overallRating });
        setImgUrl(canvasRef.current.toDataURL("image/png"));
      }
    }, 50);
  };

  const handleDownload = () => {
    track("image_downloaded", { industry, overall_rating: overallRating.label });
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      track("link_copied", { industry });
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleIndustryChange = (ind) => {
    track("industry_switched", { from: industry, to: ind });
    setIndustry(ind);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#07071a", display:"flex", justifyContent:"center", alignItems:"flex-start", padding:"40px 20px", fontFamily:"'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{display:none;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes popIn{from{opacity:0;transform:scale(0.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .card{animation:fadeUp 0.5s ease both;}
        .share-pop{animation:popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both;}
        input[type=number]::-webkit-inner-spin-button{opacity:0.3;}
      `}</style>

      <div style={{ width:"100%", maxWidth:820 }}>

        {/* Header */}
        <div className="card" style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ display:"inline-flex", alignItems:"center", background:"#12122a", border:"1px solid #2a2a4a", borderRadius:99, padding:"6px 16px", marginBottom:16 }}>
            <span style={{ color:"#6EE7F7", fontSize:12, fontFamily:"'DM Mono',monospace", letterSpacing:2 }}>MARKETING ANALYTICS</span>
          </div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(28px,5vw,44px)", fontWeight:800, color:"#f1f5f9", margin:"0 0 8px", lineHeight:1.1 }}>
            Funnel{" "}
            <span style={{ background:"linear-gradient(90deg,#6EE7F7,#C084FC)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Benchmarks</span>
            {" "}Calculator
          </h1>
          <p style={{ color:"#64748b", fontSize:15, margin:0, maxWidth:480, marginInline:"auto" }}>
            Enter your funnel numbers and instantly see how you stack up against industry benchmarks.
          </p>
        </div>

        {/* Industry Tabs */}
        <div className="card" style={{ display:"flex", justifyContent:"center", gap:10, marginBottom:28, flexWrap:"wrap" }}>
          {["B2B","B2C","SaaS","Ecommerce"].map((ind) => (
            <button key={ind} onClick={() => handleIndustryChange(ind)}
              style={{ background: industry===ind ? "linear-gradient(135deg,#6EE7F7,#C084FC)" : "#12122a", border: industry===ind ? "none" : "1px solid #2a2a4a", borderRadius:8, color: industry===ind ? "#07071a" : "#94a3b8", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:13, padding:"8px 22px", letterSpacing:1, transition:"all 0.2s" }}>
              {ind}
            </button>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {/* Inputs */}
          <div className="card" style={{ animationDelay:"0.1s" }}>
            <div style={{ background:"#0d0d20", border:"1px solid #1e1e3a", borderRadius:16, padding:24 }}>
              <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#94a3b8", fontSize:11, letterSpacing:2, margin:"0 0 20px", textTransform:"uppercase" }}>Your Numbers</p>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {STAGES.map((s) => (
                  <div key={s.key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:16 }}>{s.icon}</span>
                      <span style={{ color:"#cbd5e1", fontSize:13, fontWeight:500 }}>{s.label}</span>
                    </div>
                    <NumberInput value={values[s.key]} onChange={set(s.key)} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div className="card" style={{ animationDelay:"0.15s", background:"#0d0d20", border:"1px solid #1e1e3a", borderRadius:16, padding:24 }}>
              <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#94a3b8", fontSize:11, letterSpacing:2, margin:"0 0 12px", textTransform:"uppercase" }}>Overall Conversion</p>
              <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:12 }}>
                <span style={{ fontFamily:"'Syne',sans-serif", fontSize:36, fontWeight:800, color:"#f1f5f9" }}>{overallConversion.toFixed(4)}%</span>
                <span style={{ color:"#475569", fontSize:13 }}>vs {benchmarkOverall.toFixed(4)}% avg</span>
              </div>
              <AnimatedBar pct={Math.min((overallConversion/(benchmarkOverall*2))*100,100)} color="#6EE7F7" />
              <div style={{ marginTop:8, fontSize:12 }}>
                {overallRating.emoji} <span style={{ color:overallRating.color }}>{overallRating.label}</span>
                <span style={{ color:"#475569" }}> — {industry} benchmark</span>
              </div>
            </div>

            <div className="card" style={{ animationDelay:"0.2s", background:"#0d0d20", border:"1px solid #1e1e3a", borderRadius:16, padding:24, flex:1 }}>
              <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#94a3b8", fontSize:11, letterSpacing:2, margin:"0 0 18px", textTransform:"uppercase" }}>Stage-by-Stage</p>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {RATE_KEYS.map((key,i) => {
                  const actual = rates[key], bmark = bench[key];
                  const rating = getRating(actual,bmark);
                  return (
                    <div key={key}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ color:"#94a3b8", fontSize:12 }}>{RATE_LABELS[i]}</span>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontFamily:"'DM Mono',monospace", color:"#f1f5f9", fontSize:13 }}>{(actual*100).toFixed(1)}%</span>
                          <span style={{ background:rating.color+"22", color:rating.color, borderRadius:4, fontSize:10, padding:"2px 6px", fontWeight:600 }}>{rating.emoji} {rating.label}</span>
                        </div>
                      </div>
                      <AnimatedBar pct={Math.min((actual/(bmark*2))*100,100)} color={STAGES[i].color} delay={i*80} />
                      <div style={{ marginTop:4, color:"#334155", fontSize:11, fontFamily:"'DM Mono',monospace" }}>benchmark: {(bmark*100).toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Visual Funnel */}
        <div className="card" style={{ animationDelay:"0.25s", background:"#0d0d20", border:"1px solid #1e1e3a", borderRadius:16, padding:24, marginTop:16 }}>
          <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#94a3b8", fontSize:11, letterSpacing:2, margin:"0 0 20px", textTransform:"uppercase" }}>Visual Funnel</p>
          <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:80 }}>
            {STAGES.map((s) => {
              const val = values[s.key], max = values.impressions||1;
              const h = Math.max((val/max)*80,4);
              return (
                <div key={s.key} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                  <div style={{ fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace", textAlign:"center" }}>{val>=1000?`${(val/1000).toFixed(1)}k`:val}</div>
                  <div style={{ width:"100%", height:h, background:`linear-gradient(180deg,${s.color}cc,${s.color}44)`, borderRadius:"4px 4px 2px 2px", border:`1px solid ${s.color}66`, boxShadow:`0 0 12px ${s.color}33`, transition:"height 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
                  <div style={{ fontSize:9, color:"#475569", textAlign:"center", fontWeight:600 }}>{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Share Results */}
        <div className="card" style={{ animationDelay:"0.3s", background:"#0d0d20", border:"1px solid #1e1e3a", borderRadius:16, padding:24, marginTop:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#94a3b8", fontSize:11, letterSpacing:2, margin:"0 0 4px", textTransform:"uppercase" }}>Share Results</p>
              <p style={{ color:"#475569", fontSize:12, margin:0 }}>Download your results as an image or copy a shareable link</p>
            </div>
            <button onClick={handleGenerateCard}
              style={{ background:"linear-gradient(135deg,#6EE7F7,#C084FC)", border:"none", borderRadius:8, color:"#07071a", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:13, padding:"10px 20px", whiteSpace:"nowrap" }}>
              {showShare ? "↻ Refresh Card" : "📤 Generate Results Card"}
            </button>
          </div>

          <canvas ref={canvasRef} style={{ display:"none" }} />

          {showShare && imgUrl && (
            <div className="share-pop" style={{ marginTop:20 }}>
              <div style={{ border:"1px solid #1e1e3a", borderRadius:12, overflow:"hidden", marginBottom:16 }}>
                <img src={imgUrl} alt="Your funnel results card" style={{ width:"100%", display:"block" }} />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <a href={imgUrl} download="my-funnel-results.png" onClick={handleDownload}
                  style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:"linear-gradient(135deg,#6EE7F7,#C084FC)", borderRadius:8, color:"#07071a", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:14, padding:13, textDecoration:"none" }}>
                  ⬇️ Download Image
                </a>
                <button onClick={handleCopyLink}
                  style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background: copiedLink?"#67E8B022":"#12122a", border:`1px solid ${copiedLink?"#67E8B0":"#2a2a4a"}`, borderRadius:8, color: copiedLink?"#67E8B0":"#94a3b8", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, padding:13, transition:"all 0.2s" }}>
                  {copiedLink ? "✅ Link Copied!" : "🔗 Copy Share Link"}
                </button>
              </div>
              <p style={{ color:"#334155", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:12, marginBottom:0, textAlign:"center" }}>
                Post the image anywhere · Share the link so others can try with their own numbers
              </p>
            </div>
          )}
        </div>

        <div style={{ textAlign:"center", marginTop:20, color:"#1e1e3a", fontSize:11, fontFamily:"'DM Mono',monospace" }}>
          benchmarks sourced from industry averages · built with Claude AI
        </div>
      </div>
    </div>
  );
}
