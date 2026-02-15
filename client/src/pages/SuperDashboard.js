import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API = "http://localhost:5000";

const planColors = {
  free: "#6b7280",
  basic: "#2563eb",
  pro: "#7c3aed"
};

function badgeStyle(color) {
  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    background: color + "22",
    border: "1px solid " + color + "55",
    color,
    fontSize: 12,
    fontWeight: 700
  };
}

export default function SuperDashboard() {
  const token = localStorage.getItem("superToken"); // ✅ IMPORTANT

  const [companies, setCompanies] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState("");

  // ✅ Create form
  const [form, setForm] = useState({
    companyName: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    plan: "free",
    userLimit: 5,
    features: {
      crm: true,
      attendance: false,
      reports: true,
      policies: false
    }
  });

  // ✅ Edit modal-like panel
  const [editId, setEditId] = useState("");
  const [edit, setEdit] = useState({
    plan: "free",
    userLimit: 5,
    isActive: true,
    features: { crm: true, attendance: false, reports: true, policies: false }
  });

  // ✅ Bulk select
  const [selected, setSelected] = useState({}); // {id:true}
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  );

  const headers = useMemo(
    () => ({ Authorization: "Bearer " + (token || "") }),
    [token]
  );

  const load = async () => {
    setMsg("");
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/super/companies`, { headers });
      setCompanies(res.data || []);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error loading companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  const createCompany = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      await axios.post(`${API}/api/super/companies`, form, { headers });

      setMsg("✅ Company Created");
      setForm({
        companyName: "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
        plan: "free",
        userLimit: 5,
        features: { crm: true, attendance: false, reports: true, policies: false }
      });

      await load();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Create error");
    }
  };

  const startEdit = (c) => {
    setMsg("");
    setEditId(c._id);
    setEdit({
      plan: c.plan || "free",
      userLimit: Number(c.userLimit || 5),
      isActive: c.isActive !== false,
      features: {
        crm: c.features?.crm !== false,
        attendance: !!c.features?.attendance,
        reports: c.features?.reports !== false,
        policies: !!c.features?.policies
      }
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditId("");
  };

  const saveEdit = async () => {
    setMsg("");
    try {
      await axios.patch(`${API}/api/super/companies/${editId}`, edit, { headers });
      setMsg("✅ Company Updated");
      setEditId("");
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Update error");
    }
  };

  const deleteOne = async (id) => {
    setMsg("");
    if (!window.confirm("Permanent delete this company? (users + leads also delete)")) return;

    try {
      await axios.delete(`${API}/api/super/companies/${id}`, { headers });
      setMsg("✅ Company deleted");
      setSelected((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Delete error");
    }
  };

  const bulkDelete = async () => {
    setMsg("");
    if (selectedIds.length === 0) return setMsg("Select companies first");
    if (!window.confirm(`Permanent delete ${selectedIds.length} companies?`)) return;

    try {
      await axios.post(
        `${API}/api/super/companies/bulk-delete`,
        { companyIds: selectedIds },
        { headers }
      );
      setMsg(`✅ Deleted ${selectedIds.length} companies`);
      setSelected({});
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Bulk delete error");
    }
  };

  const toggleAll = (checked, rows) => {
    if (!checked) return setSelected({});
    const map = {};
    rows.forEach((c) => (map[c._id] = true));
    setSelected(map);
  };

  const toggleOne = (id) => {
    setSelected((p) => ({ ...p, [id]: !p[id] }));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const code = (c.companyCode || "").toLowerCase();
      const slug = (c.slug || "").toLowerCase();
      return name.includes(q) || code.includes(q) || slug.includes(q);
    });
  }, [companies, query]);

  return (
    <div style={{ maxWidth: 1150, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Super Admin</h2>
        <button onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <input
            placeholder="Search company..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 260 }}
          />
          <button onClick={bulkDelete} disabled={selectedIds.length === 0}>
            Delete Selected ({selectedIds.length})
          </button>
        </div>
      </div>

      {msg ? (
        <div style={{ padding: 12, background: "#f5f5f5", borderRadius: 12, marginBottom: 12 }}>
          {msg}
        </div>
      ) : null}

      {/* ✅ EDIT PANEL */}
      {editId ? (
        <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <b>Edit Company</b>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <label style={{ flex: "1 1 220px" }}>
              Plan
              <select
                value={edit.plan}
                onChange={(e) => setEdit((s) => ({ ...s, plan: e.target.value }))}
              >
                <option value="free">free</option>
                <option value="basic">basic</option>
                <option value="pro">pro</option>
              </select>
            </label>

            <label style={{ flex: "1 1 220px" }}>
              User Limit
              <input
                type="number"
                value={edit.userLimit}
                onChange={(e) => setEdit((s) => ({ ...s, userLimit: Number(e.target.value) }))}
              />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 22 }}>
              <input
                type="checkbox"
                checked={!!edit.isActive}
                onChange={(e) => setEdit((s) => ({ ...s, isActive: e.target.checked }))}
              />
              Active
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <b>Features</b>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
              {["crm", "attendance", "reports", "policies"].map((k) => (
                <label key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={!!edit.features?.[k]}
                    onChange={(e) =>
                      setEdit((s) => ({
                        ...s,
                        features: { ...s.features, [k]: e.target.checked }
                      }))
                    }
                  />
                  {k}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <button onClick={saveEdit}>Save</button>
            <button onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      ) : null}

      {/* ✅ CREATE COMPANY */}
      <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: 14, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Create Company</h3>

        <form onSubmit={createCompany} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              style={{ flex: "1 1 240px" }}
              placeholder="Company Name"
              value={form.companyName}
              onChange={(e) => setForm((s) => ({ ...s, companyName: e.target.value }))}
              required
            />
            <select
              style={{ flex: "0 0 160px" }}
              value={form.plan}
              onChange={(e) => setForm((s) => ({ ...s, plan: e.target.value }))}
            >
              <option value="free">free</option>
              <option value="basic">basic</option>
              <option value="pro">pro</option>
            </select>
            <input
              style={{ flex: "0 0 160px" }}
              type="number"
              placeholder="User Limit"
              value={form.userLimit}
              onChange={(e) => setForm((s) => ({ ...s, userLimit: Number(e.target.value) }))}
              min={1}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              style={{ flex: "1 1 220px" }}
              placeholder="Admin Name"
              value={form.adminName}
              onChange={(e) => setForm((s) => ({ ...s, adminName: e.target.value }))}
              required
            />
            <input
              style={{ flex: "1 1 240px" }}
              placeholder="Admin Email"
              value={form.adminEmail}
              onChange={(e) => setForm((s) => ({ ...s, adminEmail: e.target.value }))}
              required
            />
            <input
              style={{ flex: "1 1 220px" }}
              type="password"
              placeholder="Admin Password"
              value={form.adminPassword}
              onChange={(e) => setForm((s) => ({ ...s, adminPassword: e.target.value }))}
              required
            />
          </div>

          <div>
            <b>Features</b>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
              {["crm", "attendance", "reports", "policies"].map((k) => (
                <label key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={!!form.features?.[k]}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        features: { ...s.features, [k]: e.target.checked }
                      }))
                    }
                  />
                  {k}
                </label>
              ))}
            </div>
          </div>

          <button type="submit">Create Company</button>
        </form>
      </div>

      {/* ✅ LIST */}
      <div style={{ overflowX: "auto" }}>
        <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse", minWidth: 1050 }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th align="left">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={(e) => toggleAll(e.target.checked, filtered)}
                />
              </th>
              <th align="left">Company</th>
              <th align="left">Plan</th>
              <th align="left">Users</th>
              <th align="left">Active</th>
              <th align="left">Features</th>
              <th align="left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((c) => {
              const color = planColors[c.plan] || "#6b7280";
              const used = Number(c.usedUsers || 0);
              const limit = Number(c.userLimit || 0);

              return (
                <tr key={c._id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!selected[c._id]}
                      onChange={() => toggleOne(c._id)}
                    />
                  </td>

                  <td>
                    <div style={{ fontWeight: 800 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      ID: {c.companyCode || c._id} • slug: {c.slug || "-"}
                    </div>
                  </td>

                  <td>
                    <span style={badgeStyle(color)}>{c.plan}</span>
                  </td>

                  <td>
                    <b>{used}</b> / {limit}
                    <div style={{ height: 8, background: "#eee", borderRadius: 999, marginTop: 6 }}>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 999,
                          width: limit ? Math.min(100, Math.round((used / limit) * 100)) + "%" : "0%",
                          background: used > limit ? "#ef4444" : "#22c55e"
                        }}
                      />
                    </div>
                  </td>

                  <td>{c.isActive === false ? "No" : "Yes"}</td>

                  <td style={{ fontSize: 12 }}>
                    {c.features?.crm !== false ? "crm ✅" : "crm ❌"}{" "}
                    {c.features?.attendance ? "attendance ✅" : "attendance ❌"}{" "}
                    {c.features?.reports !== false ? "reports ✅" : "reports ❌"}{" "}
                    {c.features?.policies ? "policies ✅" : "policies ❌"}
                  </td>

                  <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => startEdit(c)}>Edit</button>
                    <button onClick={() => deleteOne(c._id)}>Delete</button>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: 16, color: "#666" }}>
                  No companies found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
