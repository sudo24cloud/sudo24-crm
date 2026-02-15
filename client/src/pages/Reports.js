import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

function msToHM(ms) {
  const m = Math.floor(Math.max(0, ms) / 60000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function toCsv(rows) {
  const headers = ["key", "sessions", "workHours", "breakHours", "netHours"];
  const escape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        escape(r.key),
        escape(r.sessions),
        escape(r.workHours),
        escape(r.breakHours),
        escape(r.netHours)
      ].join(",")
    )
  ];

  return lines.join("\n");
}

export default function Reports() {
  const { api, user } = useAuth();

  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("all");

  const [granularity, setGranularity] = useState("day");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");

  const loadUsers = async () => {
    try {
      const res = await api.get("/api/users");
      setUsers(res.data || []);
    } catch (e) {
      // ignore — reports can still work
    }
  };

  const loadReport = async () => {
    setMsg("");
    try {
      const params = new URLSearchParams();
      params.set("granularity", granularity);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (selectedUserId !== "all") params.set("userId", selectedUserId);

      const res = await api.get(`/api/reports/attendance?${params.toString()}`);
      const data = (res.data || []).map((r) => ({
        key: r.key,
        sessions: r.sessions,
        workHours: msToHM(r.workMs),
        breakHours: msToHM(r.breakMs),
        netHours: msToHM(r.netMs),
        workMs: r.workMs,
        breakMs: r.breakMs,
        netMs: r.netMs
      }));
      setRows(data);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error");
    }
  };

  useEffect(() => {
    loadUsers();
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const t = rows.reduce(
      (acc, r) => {
        acc.sessions += Number(r.sessions || 0);
        acc.workMs += Number(r.workMs || 0);
        acc.breakMs += Number(r.breakMs || 0);
        acc.netMs += Number(r.netMs || 0);
        return acc;
      },
      { sessions: 0, workMs: 0, breakMs: 0, netMs: 0 }
    );
    return {
      sessions: t.sessions,
      work: msToHM(t.workMs),
      brk: msToHM(t.breakMs),
      net: msToHM(t.netMs)
    };
  }, [rows]);

  const downloadCsv = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;

    const uid = selectedUserId === "all" ? "all" : selectedUserId.slice(-6);
    a.download = `report-${granularity}-${from}-to-${to}-${uid}.csv`;

    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const canPickAll = user?.role === "admin" || user?.role === "manager";

  return (
    <div>
      <h2>Reports</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <label>
          Granularity
          <select value={granularity} onChange={(e) => setGranularity(e.target.value)}>
            <option value="hour">Hourly</option>
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </label>

        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>

        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>

        <label style={{ minWidth: 280 }}>
          User
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            {canPickAll ? <option value="all">All Users</option> : null}
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </label>

        <button onClick={loadReport}>Run Report</button>
        <button onClick={downloadCsv} disabled={rows.length === 0}>Download CSV</button>
      </div>

      {msg ? <div style={{ marginTop: 10, padding: 10, background: "#f5f5f5", borderRadius: 10 }}>{msg}</div> : null}

      <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <b>Totals</b>
        <div style={{ marginTop: 6, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div>Sessions: <b>{totals.sessions}</b></div>
          <div>Work: <b>{totals.work}</b></div>
          <div>Break: <b>{totals.brk}</b></div>
          <div>Net: <b>{totals.net}</b></div>
        </div>
      </div>

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse", minWidth: 820 }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th align="left">Key</th>
              <th align="left">Sessions</th>
              <th align="left">Work</th>
              <th align="left">Break</th>
              <th align="left">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} style={{ borderBottom: "1px solid #eee" }}>
                <td>{r.key}</td>
                <td>{r.sessions}</td>
                <td>{r.workHours}</td>
                <td>{r.breakHours}</td>
                <td><b>{r.netHours}</b></td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: 16, color: "#666" }}>No data for selected filters.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
