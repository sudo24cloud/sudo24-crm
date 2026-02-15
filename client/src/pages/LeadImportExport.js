import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

const templateCSV = `name,phone,email,city,status,nextFollowUp,assignedToEmail
Aditi,9876543210,aditi@gmail.com,Delhi,new,2026-02-14 18:30,emp1@company.com
`;

export default function LeadImportExport() {
  const { api, user } = useAuth();
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  const [msg, setMsg] = useState("");
  const [csvText, setCsvText] = useState(templateCSV);
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [assignTo, setAssignTo] = useState("");
  const [fileName, setFileName] = useState("");

  // ✅ Hooks always before conditional return
  const assignees = useMemo(() => {
    return (users || []).filter((u) => u && u.isActive !== false);
  }, [users]);

  const loadUsers = async () => {
    try {
      const res = await api.get("/api/users");
      setUsers(res.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isAdminOrManager) loadUsers();
    // eslint-disable-next-line
  }, [isAdminOrManager]);

  if (!isAdminOrManager) return <div>Forbidden</div>;

  const downloadText = (filename, text) => {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ✅ NEW: CSV Upload -> read file -> set textarea
  const onPickFile = async (e) => {
    setMsg("");
    const file = e.target.files?.[0];
    if (!file) return;

    // basic validation
    const ok =
      file.type.includes("csv") ||
      file.name.toLowerCase().endsWith(".csv") ||
      file.type === "text/plain";

    if (!ok) {
      setMsg("❌ Please select a .csv file");
      e.target.value = "";
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setCsvText(text);
      setMsg(`✅ Loaded CSV from file: ${file.name}`);
    };
    reader.onerror = () => {
      setMsg("❌ Failed to read file");
    };
    reader.readAsText(file);
  };

  const exportCSV = async () => {
    setMsg("");
    try {
      const res = await api.get("/api/leads/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "leads_export.csv";
      a.click();
      URL.revokeObjectURL(url);
      setMsg("✅ Export downloaded");
    } catch (e) {
      setMsg(e?.response?.data?.message || "Export error");
    }
  };

  const importCSV = async () => {
    setMsg("");
    try {
      const res = await api.post("/api/leads/import", { csvText });
      setMsg(`✅ Imported: ${res.data.inserted} | Failed: ${res.data.failed}`);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Import error");
    }
  };

  const loadLeadsQuick = async () => {
    setMsg("");
    try {
      const res = await api.get("/api/leads");
      const ids = (res.data || []).slice(0, 200).map((x) => x._id);
      setSelectedIds(ids);
      setMsg(`Loaded ${ids.length} leads (auto-selected first 200)`);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Load leads error");
    }
  };

  const bulkAssign = async () => {
    setMsg("");
    if (!assignTo) return setMsg("Select assignee first");
    if (selectedIds.length === 0) return setMsg("No leads selected");

    try {
      const res = await api.post("/api/leads/bulk-assign", {
        leadIds: selectedIds,
        userId: assignTo
      });
      setMsg(`✅ Assigned modified: ${res.data.modified}`);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Assign error");
    }
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <h2>Bulk Import / Export (Leads)</h2>

      {msg ? (
        <div style={{ padding: 12, background: "#f5f5f5", borderRadius: 12, marginBottom: 12 }}>
          {msg}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => downloadText("leads_template.csv", templateCSV)}>
          Download Template
        </button>
        <button onClick={exportCSV}>Export Leads CSV</button>
      </div>

      {/* ✅ Upload Section */}
      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <b>Upload CSV (Auto Paste)</b>

        <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input type="file" accept=".csv,text/csv" onChange={onPickFile} />
          {fileName ? <span style={{ color: "#444" }}>Selected: <b>{fileName}</b></span> : null}
          <button onClick={() => { setCsvText(templateCSV); setFileName(""); }}>
            Reset to Template
          </button>
        </div>

        <p style={{ marginTop: 10, color: "#666" }}>
          Excel → Save As → CSV → Upload here. Then click “Import Now”.
        </p>

        <textarea
          rows={10}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <div style={{ marginTop: 10 }}>
          <button onClick={importCSV}>Import Now</button>
        </div>
      </div>

      {/* ✅ Bulk Assign */}
      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <b>Bulk Assign (Optional)</b>
        <p style={{ marginTop: 6, color: "#666" }}>
          Quick tool: load leads (first 200 auto-selected), then assign to user.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={loadLeadsQuick}>Load Leads (select)</button>

          <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">-- Select Assignee --</option>
            {assignees.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name} ({a.role}) - {a.email}
              </option>
            ))}
          </select>

          <button onClick={bulkAssign}>Assign Selected ({selectedIds.length})</button>
        </div>
      </div>
    </div>
  );
}
