import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

function cardStyle() { return { border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, background: "#fff" }; }
function btnStyle(primary = false) {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid #111827",
    background: primary ? "#111827" : "#fff", color: primary ? "#fff" : "#111827",
    fontWeight: 900, cursor: "pointer", height: 40 };
}
function pad2(n){ return String(n).padStart(2,"0"); }
function fmtMin(min){
  const h = Math.floor(min/60), m = min%60;
  return `${h}h ${m}m`;
}
function fmtClock(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const hh = Math.floor(s/3600), mm = Math.floor((s%3600)/60), ss = s%60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}
function ymd(d){
  const dd = new Date(d);
  const y = dd.getFullYear();
  const m = String(dd.getMonth()+1).padStart(2,"0");
  const da = String(dd.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}
function startOfWeek(d=new Date()){
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = (day === 0 ? -6 : 1 - day); // Monday as start
  x.setDate(x.getDate()+diff);
  x.setHours(0,0,0,0);
  return x;
}
function endOfWeek(d=new Date()){
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate()+6);
  return e;
}

export default function Attendance() {
  const { api, user } = useAuth();

  // camera
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // state
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState("user");
  const [snapshot, setSnapshot] = useState("");

  // location
  const [geo, setGeo] = useState(null);
  const [geoErr, setGeoErr] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);

  // today attendance row
  const [today, setToday] = useState(null);

  // timers
  const [nowTick, setNowTick] = useState(Date.now());

  // reports
  const [reportTab, setReportTab] = useState("week"); // day/week/month/range
  const [from, setFrom] = useState(ymd(startOfWeek()));
  const [to, setTo] = useState(ymd(endOfWeek()));
  const [rows, setRows] = useState([]);
  const [adminRows, setAdminRows] = useState([]);
  const [employeeId, setEmployeeId] = useState(""); // optional for admin filter
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  const isSecure = typeof window !== "undefined" && window.isSecureContext;

  // tick
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // cleanup camera
  useEffect(() => () => stopCamera(), []);

  const stopCamera = () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch {}
    setCameraOn(false);
  };

  const startCamera = async () => {
    setMsg("");
    setSnapshot("");

    if (!isSecure && window.location.hostname !== "localhost") {
      setMsg("❌ Camera requires HTTPS. Open site with https://");
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (!videoRef.current) return setMsg("❌ Video not ready, refresh once.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
    } catch (e) {
      const n = e?.name || "";
      if (n === "NotAllowedError") setMsg("❌ Camera permission denied. Allow it in browser settings.");
      else if (n === "NotFoundError") setMsg("❌ No camera found on device.");
      else setMsg(`❌ Camera error: ${e?.message || "Unknown"}`);
      stopCamera();
    }
  };

  const toggleFacing = async () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (cameraOn) setTimeout(() => startCamera(), 0);
  };

  const capture = () => {
    setMsg("");
    if (!videoRef.current || !canvasRef.current) return setMsg("❌ Camera not ready");
    const v = videoRef.current;
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    const c = canvasRef.current;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0, w, h);
    const b64 = c.toDataURL("image/jpeg", 0.85);
    setSnapshot(b64);
    setMsg("✅ Photo captured");
  };

  const fetchLocation = async () => {
    setGeoErr("");
    setGeoLoading(true);
    try {
      const g = await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          }),
          (err) => resolve({ error: err?.message || "Location permission denied" }),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });

      if (!g) {
        setGeoErr("Location not supported");
        setGeo(null);
      } else if (g.error) {
        setGeoErr(g.error);
        setGeo(null);
      } else {
        setGeo(g);
      }
    } catch {
      setGeoErr("Location error");
      setGeo(null);
    } finally {
      setGeoLoading(false);
    }
  };

  const loadToday = async () => {
    try {
      const res = await api.get("/api/attendance/today");
      setToday(res?.data?.row || null);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actionPayload = () => {
    // require photo + location for strict compliance
    if (!snapshot) return { ok: false, message: "Capture live photo first" };
    if (!geo) return { ok: false, message: "Fetch location first" };
    return { ok: true, photoBase64: snapshot, geo };
  };

  const doCheckIn = async () => {
    setMsg("");
    const p = actionPayload();
    if (!p.ok) return setMsg(`❌ ${p.message}`);
    setLoading(true);
    try {
      const res = await api.post("/api/attendance/check-in", { photoBase64: p.photoBase64, geo: p.geo });
      setToday(res?.data?.row || null);
      setMsg("✅ Checked-in");
    } catch (e) {
      setMsg(e?.response?.data?.message || "❌ Check-in failed");
    } finally {
      setLoading(false);
    }
  };

  const doBreakStart = async () => {
    setMsg("");
    const p = actionPayload();
    if (!p.ok) return setMsg(`❌ ${p.message}`);
    setLoading(true);
    try {
      const res = await api.post("/api/attendance/break/start", { photoBase64: p.photoBase64, geo: p.geo });
      setToday(res?.data?.row || null);
      setMsg("✅ Break started");
    } catch (e) {
      setMsg(e?.response?.data?.message || "❌ Break start failed");
    } finally {
      setLoading(false);
    }
  };

  const doBreakEnd = async () => {
    setMsg("");
    const p = actionPayload();
    if (!p.ok) return setMsg(`❌ ${p.message}`);
    setLoading(true);
    try {
      const res = await api.post("/api/attendance/break/end", { photoBase64: p.photoBase64, geo: p.geo });
      setToday(res?.data?.row || null);
      setMsg("✅ Break ended");
    } catch (e) {
      setMsg(e?.response?.data?.message || "❌ Break end failed");
    } finally {
      setLoading(false);
    }
  };

  const doCheckOut = async () => {
    setMsg("");
    const p = actionPayload();
    if (!p.ok) return setMsg(`❌ ${p.message}`);
    setLoading(true);
    try {
      const res = await api.post("/api/attendance/check-out", { photoBase64: p.photoBase64, geo: p.geo });
      setToday(res?.data?.row || null);
      setMsg("✅ Checked-out");
      stopCamera();
    } catch (e) {
      setMsg(e?.response?.data?.message || "❌ Check-out failed");
    } finally {
      setLoading(false);
    }
  };

  const isBreakRunning = useMemo(() => {
    const b = today?.breaks || [];
    const last = b[b.length - 1];
    return !!(last && !last.endAt);
  }, [today]);

  const runningWorkMs = useMemo(() => {
    if (!today?.checkInAt) return 0;
    const start = new Date(today.checkInAt).getTime();
    const end = today?.checkOutAt ? new Date(today.checkOutAt).getTime() : nowTick;
    return Math.max(0, end - start);
  }, [today, nowTick]);

  const runningBreakMs = useMemo(() => {
    if (!isBreakRunning) return 0;
    const b = today?.breaks || [];
    const last = b[b.length - 1];
    const s = new Date(last.startAt).getTime();
    return Math.max(0, nowTick - s);
  }, [today, isBreakRunning, nowTick]);

  const computedBreakMin = useMemo(() => {
    const b = today?.breaks || [];
    let sum = 0;
    for (const x of b) sum += Number(x.durationMin || 0);
    if (isBreakRunning) sum += Math.floor(runningBreakMs / 60000);
    return sum;
  }, [today, isBreakRunning, runningBreakMs]);

  const computedTotalMin = useMemo(() => {
    if (!today?.checkInAt) return 0;
    const end = today?.checkOutAt ? new Date(today.checkOutAt).getTime() : nowTick;
    const start = new Date(today.checkInAt).getTime();
    return Math.floor(Math.max(0, end - start) / 60000);
  }, [today, nowTick]);

  const computedNetMin = useMemo(() => {
    return Math.max(0, computedTotalMin - computedBreakMin);
  }, [computedTotalMin, computedBreakMin]);

  const fullDayNow = computedNetMin >= 360 && computedBreakMin <= 60;

  const setPreset = (type) => {
    const now = new Date();
    if (type === "day") {
      const d = ymd(now);
      setFrom(d); setTo(d);
    } else if (type === "week") {
      setFrom(ymd(startOfWeek(now)));
      setTo(ymd(endOfWeek(now)));
    } else if (type === "month") {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth()+1, 0);
      setFrom(ymd(s)); setTo(ymd(e));
    }
  };

  const loadReport = async () => {
    setMsg("");
    setLoading(true);
    try {
      const my = await api.get(`/api/attendance/my?from=${from}&to=${to}`);
      setRows(my?.data?.rows || []);

      if (isAdminOrManager) {
        const q = employeeId ? `&userId=${encodeURIComponent(employeeId)}` : "";
        const ad = await api.get(`/api/attendance/admin?from=${from}&to=${to}${q}`);
        setAdminRows(ad?.data?.rows || []);
      }
    } catch (e) {
      setMsg(e?.response?.data?.message || "❌ Report load failed");
    } finally {
      setLoading(false);
    }
  };

  const reportStats = useMemo(() => {
    const list = isAdminOrManager ? adminRows : rows;
    let present = 0, fullDay = 0, totalNet = 0, totalBreak = 0;
    for (const r of list) {
      if (r.checkInAt) present++;
      if (r.isFullDay) fullDay++;
      totalNet += Number(r.netWorkMin || 0);
      totalBreak += Number(r.breakMin || 0);
    }
    return { present, fullDay, totalNet, totalBreak };
  }, [rows, adminRows, isAdminOrManager]);

  const listToShow = isAdminOrManager ? adminRows : rows;

  return (
    <div style={{ display:"grid", gap:14 }}>
      {/* Top */}
      <div style={cardStyle()}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Attendance</div>
          <div style={{ marginLeft:"auto", fontSize: 12, color:"#6b7280" }}>
            User: <b>{user?.name || user?.email || "-"}</b> • Role: <b>{user?.role || "-"}</b>
          </div>
        </div>

        {msg ? <div style={{ marginTop:10, padding:10, borderRadius:12, background:"#f9fafb", border:"1px solid #e5e7eb" }}>{msg}</div> : null}

        {/* Today status cards */}
        <div style={{ marginTop: 12, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 }}>
          <div style={cardStyle()}>
            <div style={{ fontSize:12, color:"#6b7280" }}>Today Status</div>
            <div style={{ fontWeight:900, marginTop:6 }}>
              {today?.checkOutAt ? "Checked-out" : today?.checkInAt ? (isBreakRunning ? "On Break" : "Working") : "Not checked-in"}
            </div>
            <div style={{ marginTop:8, fontSize:12, color:"#6b7280" }}>
              Full Day rule: <b>Net ≥ 6h</b> & <b>Break ≤ 60m</b>
            </div>
            <div style={{ marginTop:6, fontSize:12 }}>
              Full Day now: <b style={{ color: fullDayNow ? "#065f46" : "#991b1b" }}>{fullDayNow ? "YES" : "NO"}</b>
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={{ fontSize:12, color:"#6b7280" }}>Timers</div>
            <div style={{ marginTop:6, display:"grid", gap:6 }}>
              <div>Gross: <b>{fmtClock(runningWorkMs)}</b></div>
              <div>Break: <b>{fmtClock(runningBreakMs)}</b></div>
              <div>Net: <b>{fmtMin(computedNetMin)}</b></div>
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={{ fontSize:12, color:"#6b7280" }}>Geo</div>
            {geo ? (
              <div style={{ marginTop:6, fontSize:12 }}>
                Lat: <b>{geo.lat.toFixed(6)}</b><br/>
                Lng: <b>{geo.lng.toFixed(6)}</b><br/>
                Accuracy: <b>{Math.round(geo.accuracy)}m</b>
              </div>
            ) : (
              <div style={{ marginTop:6, color:"#6b7280", fontSize:12 }}>
                {geoErr ? `❌ ${geoErr}` : "Location not captured yet."}
              </div>
            )}
            <div style={{ marginTop:10, display:"flex", gap:10, flexWrap:"wrap" }}>
              <button onClick={fetchLocation} style={btnStyle(false)}>{geoLoading ? "Getting..." : "📍 Get Location"}</button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ marginTop: 12, display:"flex", gap:10, flexWrap:"wrap" }}>
          <button onClick={startCamera} style={btnStyle(true)}>📷 Start Camera</button>
          <button onClick={toggleFacing} style={btnStyle(false)}>🔁 Switch</button>
          <button onClick={capture} style={btnStyle(false)} disabled={!cameraOn}>📸 Capture</button>

          <div style={{ marginLeft:"auto", display:"flex", gap:10, flexWrap:"wrap" }}>
            <button onClick={doCheckIn} style={btnStyle(true)} disabled={loading}>✅ Check-in</button>
            <button onClick={doBreakStart} style={btnStyle(false)} disabled={loading}>⏸ Break Start</button>
            <button onClick={doBreakEnd} style={btnStyle(false)} disabled={loading}>▶ Break End</button>
            <button onClick={doCheckOut} style={btnStyle(true)} disabled={loading}>🚪 Check-out</button>
          </div>
        </div>

        {/* Camera + Photo */}
        <div style={{ marginTop: 12, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12 }}>
          <div style={{ border:"1px solid #e5e7eb", borderRadius:16, padding:10 }}>
            <div style={{ fontSize:12, color:"#6b7280", marginBottom:8 }}>Live Camera</div>
            <video ref={videoRef} autoPlay muted playsInline style={{ width:"100%", borderRadius:12, background:"#111827" }} />
            <div style={{ marginTop:10, display:"flex", gap:10 }}>
              <button onClick={stopCamera} style={btnStyle(false)}>⛔ Stop</button>
            </div>
          </div>

          <div style={{ border:"1px solid #e5e7eb", borderRadius:16, padding:10 }}>
            <div style={{ fontSize:12, color:"#6b7280", marginBottom:8 }}>Captured Proof</div>
            {snapshot ? <img src={snapshot} alt="proof" style={{ width:"100%", borderRadius:12 }} /> : <div style={{ color:"#6b7280" }}>No photo captured.</div>}
          </div>
        </div>

        <canvas ref={canvasRef} style={{ display:"none" }} />
      </div>

      {/* Reports */}
      <div style={cardStyle()}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ fontWeight: 900 }}>Attendance Reports</div>

          <div style={{ marginLeft:"auto", display:"flex", gap:8, flexWrap:"wrap" }}>
            <button onClick={() => { setReportTab("day"); setPreset("day"); }} style={btnStyle(false)}>Daily</button>
            <button onClick={() => { setReportTab("week"); setPreset("week"); }} style={btnStyle(false)}>Weekly</button>
            <button onClick={() => { setReportTab("month"); setPreset("month"); }} style={btnStyle(false)}>Monthly</button>
          </div>
        </div>

        <div style={{ marginTop: 12, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <label style={{ fontSize:12, color:"#6b7280" }}>
            From
            <input value={from} onChange={(e)=>setFrom(e.target.value)} type="date" style={{ marginLeft:8, height:40, borderRadius:12, border:"1px solid #e5e7eb", padding:"0 10px" }} />
          </label>
          <label style={{ fontSize:12, color:"#6b7280" }}>
            To
            <input value={to} onChange={(e)=>setTo(e.target.value)} type="date" style={{ marginLeft:8, height:40, borderRadius:12, border:"1px solid #e5e7eb", padding:"0 10px" }} />
          </label>

          {isAdminOrManager ? (
            <label style={{ fontSize:12, color:"#6b7280" }}>
              EmployeeId (optional)
              <input value={employeeId} onChange={(e)=>setEmployeeId(e.target.value)} placeholder="paste userId" style={{ marginLeft:8, height:40, borderRadius:12, border:"1px solid #e5e7eb", padding:"0 10px" }} />
            </label>
          ) : null}

          <button onClick={loadReport} style={btnStyle(true)} disabled={loading}>{loading ? "Loading..." : "Load Report"}</button>
        </div>

        {/* Summary */}
        <div style={{ marginTop: 12, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
          <div style={cardStyle()}><div style={{ fontSize:12, color:"#6b7280" }}>Present Days</div><div style={{ fontWeight:900, marginTop:6 }}>{reportStats.present}</div></div>
          <div style={cardStyle()}><div style={{ fontSize:12, color:"#6b7280" }}>Full Days</div><div style={{ fontWeight:900, marginTop:6 }}>{reportStats.fullDay}</div></div>
          <div style={cardStyle()}><div style={{ fontSize:12, color:"#6b7280" }}>Total Net Time</div><div style={{ fontWeight:900, marginTop:6 }}>{fmtMin(reportStats.totalNet)}</div></div>
          <div style={cardStyle()}><div style={{ fontSize:12, color:"#6b7280" }}>Total Break</div><div style={{ fontWeight:900, marginTop:6 }}>{fmtMin(reportStats.totalBreak)}</div></div>
        </div>

        {/* Rows */}
        <div style={{ marginTop: 12, display:"grid", gap:10 }}>
          {listToShow.length === 0 ? <div style={{ color:"#6b7280" }}>No records.</div> : null}

          {listToShow.map((r) => (
            <div key={r._id} style={{ border:"1px solid #e5e7eb", borderRadius:16, padding:12 }}>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                <div style={{ fontWeight: 900 }}>{r.dateKey}</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>
                  {isAdminOrManager ? <>• <b>{r.userId?.name || "-"}</b></> : null}
                </div>
                <div style={{ marginLeft:"auto", fontSize:12 }}>
                  Full Day: <b style={{ color: r.isFullDay ? "#065f46" : "#991b1b" }}>{r.isFullDay ? "YES" : "NO"}</b>
                </div>
              </div>

              <div style={{ marginTop:8, display:"flex", gap:16, flexWrap:"wrap", fontSize:12, color:"#374151" }}>
                <div>Check-in: <b>{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : "-"}</b></div>
                <div>Check-out: <b>{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : "-"}</b></div>
                <div>Total: <b>{fmtMin(r.totalMin || 0)}</b></div>
                <div>Break: <b>{fmtMin(r.breakMin || 0)}</b></div>
                <div>Net: <b>{fmtMin(r.netWorkMin || 0)}</b></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
