import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export default function CompanySettings() {
  const { api, user } = useAuth();
  const [company, setCompany] = useState(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await api.get("/api/company/me");
    setCompany(res.data);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const save = async () => {
    setMsg("");
    try {
      await api.patch("/api/company/me", {
        name: company.name,
        brandColor: company.brandColor,
        logoUrl: company.logoUrl
      });
      setMsg("✅ Saved");
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error");
    }
  };

  if (!company) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: 520 }}>
      <h2>Company Settings</h2>
      <div style={{ color: "#666", marginBottom: 10 }}>
        Plan: <b>{company.plan}</b> | Admin: <b>{user?.email}</b>
      </div>

      <div style={{ display: "grid", gap: 10, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <label>
          Company Name
          <input value={company.name} onChange={(e) => setCompany((s) => ({ ...s, name: e.target.value }))} />
        </label>

        <label>
          Brand Color
          <input value={company.brandColor} onChange={(e) => setCompany((s) => ({ ...s, brandColor: e.target.value }))} />
        </label>

        <label>
          Logo URL
          <input value={company.logoUrl} onChange={(e) => setCompany((s) => ({ ...s, logoUrl: e.target.value }))} />
        </label>

        <button onClick={save}>Save</button>
        {msg ? <div style={{ padding: 10, background: "#f5f5f5" }}>{msg}</div> : null}
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 18, height: 18, borderRadius: 4, border: "1px solid #ddd", background: company.brandColor }} />
        <span style={{ color: "#666" }}>Preview color</span>
        {company.logoUrl ? <img alt="logo" src={company.logoUrl} style={{ height: 28 }} /> : null}
      </div>
    </div>
  );
}
