import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

function fmt(dt) {
  if (!dt) return "-";
  try { return new Date(dt).toLocaleString(); } catch { return "-"; }
}

function msToHM(ms) {
  const m = Math.floor(Math.max(0, ms) / 60000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function calcTimes(row) {
  if (!row?.checkInAt) return { workMs: 0, breakMs: 0, netMs: 0 };
  const start = new Date(row.checkInAt).getTime();
  const end = row.checkOutAt ? new Date(row.checkOutAt).getTime() : Date.now();

  let breakMs = 0;
  for (const b of (row.breaks || [])) {
    const bs = new Date(b.startAt).getTime();
    const be = b.endAt ? new Date(b.endAt).getTime() : Date.now();
    breakMs += Math.max(0, be - bs);
  }
  const workMs = Math.max(0, end - start);
  const netMs = Math.max(0, workMs - breakMs);
  return { workMs, breakMs, netMs };
}

export default function AdminAttendance() {
  const { api } = useAuth();
  const [dateKey, setDateKey] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");
    try {
      const res = await api.get(`/api/attendance/admin/list?dateKey=${dateKey}`);
      setRows(res.data || []);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error");
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const downloadPdf = async () => {
    setMsg("");
    try {
      const res = await api.get(`/api/attendance/admin/report.pdf?dateKey=${dateKey}`, {
        responseType: "blob"
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-${dateKey}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(e?.response?.data?.message || "PDF download error");
    }
  };

  const rowsWithCalc = useMemo(() => {
    return rows.map(r => ({ r, t: calcTimes(r) }));
  }, [rows]);

  return (
    <div>
      <h2>Attendance (Admin)</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <label>
          Date
          <input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
        </label>
        <button onClick={load}>Load</button>
        <button onClick={downloadPdf}>Download PDF</button>
      </div>

      {msg ? <div style={{ marginTop: 10, padding: 10, background: "#f5f5f5", borderRadius: 10 }}>{msg}</div> : null}

      <div style={{ overflowX: "auto" }}>
        <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse", marginTop: 12, minWidth: 1050 }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th align="left">Employee</th>
              <th align="left">Check-in</th>
              <th align="left">Check-out</th>
              <th align="left">Work</th>
              <th align="left">Break</th>
              <th align="left">Net</th>
              <th align="left">Location</th>
              <th align="left">Selfie IN</th>
              <th align="left">Selfie OUT</th>
            </tr>
          </thead>

          <tbody>
            {rowsWithCalc.map(({ r, t }) => {
              const inMap = (r.checkInLat != null && r.checkInLng != null)
                ? `https://www.google.com/maps?q=${r.checkInLat},${r.checkInLng}` : null;

              const outMap = (r.checkOutLat != null && r.checkOutLng != null)
                ? `https://www.google.com/maps?q=${r.checkOutLat},${r.checkOutLng}` : null;

              return (
                <tr key={r._id} style={{ borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                  <td>
                    <b>{r.userId?.name}</b>
                    <div style={{ fontSize: 12, color: "#666" }}>{r.userId?.email}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>({r.userId?.role})</div>
                  </td>

                  <td>{fmt(r.checkInAt)}</td>
                  <td>{fmt(r.checkOutAt)}</td>

                  <td>{msToHM(t.workMs)}</td>
                  <td>{msToHM(t.breakMs)}</td>
                  <td><b>{msToHM(t.netMs)}</b></td>

                  <td>
                    <div style={{ fontSize: 12 }}>
                      IN: {inMap ? <a href={inMap} target="_blank" rel="noreferrer">Open</a> : "-"}
                    </div>
                    <div style={{ fontSize: 12 }}>
                      OUT: {outMap ? <a href={outMap} target="_blank" rel="noreferrer">Open</a> : "-"}
                    </div>
                  </td>

                  <td>
                    {r.checkInPhotoUrl ? (
                      <img
                        src={r.checkInPhotoUrl}
                        alt="in"
                        style={{ width: 90, height: 70, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd" }}
                      />
                    ) : "-"}
                  </td>

                  <td>
                    {r.checkOutPhotoUrl ? (
                      <img
                        src={r.checkOutPhotoUrl}
                        alt="out"
                        style={{ width: 90, height: 70, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd" }}
                      />
                    ) : "-"}
                  </td>
                </tr>
              );
            })}

            {rowsWithCalc.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ padding: 16, color: "#666" }}>No attendance found for this date.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
