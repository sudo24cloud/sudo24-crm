import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export default function MyFollowups() {
  const { api } = useAuth();
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d.toISOString().slice(0, 10);
  });

  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  const load = async () => {
    setMsg("");
    try {
      const res = await api.get(`/api/leads/followups?from=${from}&to=${to}`);
      setItems(res.data || []);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error");
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  return (
    <div>
      <h2>My Follow-ups</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button onClick={load}>Load</button>
      </div>

      {msg ? <div style={{ marginTop: 10, padding: 10, background: "#f5f5f5" }}>{msg}</div> : null}

      <div style={{ marginTop: 14 }}>
        <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th align="left">Follow-up</th>
              <th align="left">Lead</th>
              <th align="left">Status</th>
              <th align="left">Assigned</th>
              <th align="left">Phone</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l._id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleString() : "-"}</td>
                <td>{l.name}</td>
                <td>{l.status}</td>
                <td>{l.assignedTo?.name || "-"}</td>
                <td>{l.phone || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
