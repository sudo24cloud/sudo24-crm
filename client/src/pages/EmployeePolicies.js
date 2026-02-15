import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export default function EmployeePolicies() {
  const { api } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [policy, setPolicy] = useState(null);
  const [msg, setMsg] = useState("");

  const loadUsers = async () => {
    const res = await api.get("/api/users");
    setUsers(res.data || []);
  };

  useEffect(() => { loadUsers(); }, []); // eslint-disable-line

  const loadPolicy = async (userId) => {
    setMsg("");
    setPolicy(null);
    if (!userId) return;
    try {
      const res = await api.get(`/api/policies/${userId}`);
      setPolicy(res.data || {
        requireSelfieIn: true, requireSelfieOut: true,
        requireLocationIn: true, requireLocationOut: true,
        breaksEnabled: true,
        geoFenceEnabled: false, geoCenterLat: 0, geoCenterLng: 0, geoRadiusMeters: 150
      });
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error");
    }
  };

  const save = async () => {
    setMsg("");
    try {
      await api.put(`/api/policies/${selectedId}`, policy || {});
      setMsg("✅ Saved");
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error");
    }
  };

  const toggle = (k) => setPolicy(s => ({ ...s, [k]: !s?.[k] }));

  return (
    <div>
      <h2>Employee Policies (Admin)</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ minWidth: 320 }}>
          Select employee
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              loadPolicy(e.target.value);
            }}
          >
            <option value="">-- select --</option>
            {users.map(u => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </label>

        <button onClick={save} disabled={!selectedId || !policy}>Save</button>
      </div>

      {msg ? <div style={{ marginTop: 10, padding: 10, background: "#f5f5f5", borderRadius: 10 }}>{msg}</div> : null}

      {policy ? (
        <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 10, padding: 12, maxWidth: 820 }}>
          <b>Controls</b>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <label><input type="checkbox" checked={!!policy.requireSelfieIn} onChange={() => toggle("requireSelfieIn")} /> Require selfie on Check-in</label>
            <label><input type="checkbox" checked={!!policy.requireLocationIn} onChange={() => toggle("requireLocationIn")} /> Require location on Check-in</label>
            <label><input type="checkbox" checked={!!policy.requireSelfieOut} onChange={() => toggle("requireSelfieOut")} /> Require selfie on Check-out</label>
            <label><input type="checkbox" checked={!!policy.requireLocationOut} onChange={() => toggle("requireLocationOut")} /> Require location on Check-out</label>
            <label><input type="checkbox" checked={!!policy.breaksEnabled} onChange={() => toggle("breaksEnabled")} /> Breaks enabled</label>

            <hr />

            <label><input type="checkbox" checked={!!policy.geoFenceEnabled} onChange={() => toggle("geoFenceEnabled")} /> Enable Geo-fence (optional)</label>

            {policy.geoFenceEnabled ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label>
                  Center Lat
                  <input
                    value={policy.geoCenterLat}
                    onChange={(e) => setPolicy(s => ({ ...s, geoCenterLat: Number(e.target.value) }))}
                    style={{ width: 160 }}
                  />
                </label>
                <label>
                  Center Lng
                  <input
                    value={policy.geoCenterLng}
                    onChange={(e) => setPolicy(s => ({ ...s, geoCenterLng: Number(e.target.value) }))}
                    style={{ width: 160 }}
                  />
                </label>
                <label>
                  Radius (meters)
                  <input
                    value={policy.geoRadiusMeters}
                    onChange={(e) => setPolicy(s => ({ ...s, geoRadiusMeters: Number(e.target.value) }))}
                    style={{ width: 160 }}
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
