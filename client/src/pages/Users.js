import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import AdminLayout from "../components/AdminLayout"; // ✅ NEW

export default function Users() {
  const { api, user } = useAuth();

  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState("");

  const [selected, setSelected] = useState({}); // {id:true}
  const selectedIds = useMemo(() => Object.keys(selected).filter(id => selected[id]), [selected]);

  const [editId, setEditId] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "employee",
    managerId: "",
    isActive: true,
    newPassword: ""
  });

  const isAdmin = user?.role === "admin";
  const managers = useMemo(() => users.filter(u => u.role === "manager"), [users]);

  const load = async () => {
    setMsg("");
    try {
      const res = await api.get("/api/users");
      setUsers(res.data || []);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error");
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <AdminLayout title="Users" subtitle="Admin only">
        <div style={{ padding: 14, borderRadius: 14, border: "1px solid #e5e7eb", background: "#fff" }}>
          Forbidden
        </div>
      </AdminLayout>
    );
  }

  const card = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 14
  };

  const btn = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#111827",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800
  };

  const btnLight = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 800
  };

  const pill = (text) => (
    <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid #e5e7eb", background: "#f9fafb" }}>
      {text}
    </span>
  );

  const toggleAll = (checked) => {
    if (!checked) return setSelected({});
    const map = {};
    users.forEach(u => { map[u._id] = true; });
    setSelected(map);
  };

  const toggleOne = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const startEdit = (u) => {
    setMsg("");
    setEditId(u._id);
    setEditForm({
      name: u.name || "",
      email: u.email || "",
      role: u.role || "employee",
      managerId: u.managerId || "",
      isActive: u.isActive !== false,
      newPassword: ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditId("");
    setEditForm({ name: "", email: "", role: "employee", managerId: "", isActive: true, newPassword: "" });
  };

  const saveEdit = async () => {
    setMsg("");
    try {
      const payload = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        managerId: editForm.managerId || null,
        isActive: !!editForm.isActive
      };
      if (editForm.newPassword) payload.newPassword = editForm.newPassword;

      await api.patch(`/api/users/${editId}`, payload);
      setMsg("✅ User updated");
      cancelEdit();
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Update error");
    }
  };

  const deleteOne = async (id) => {
    setMsg("");
    if (!window.confirm("Delete this user permanently?")) return;
    try {
      await api.delete(`/api/users/${id}`);
      setMsg("✅ User deleted");
      setSelected(prev => {
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
    if (selectedIds.length === 0) return setMsg("Select users first");
    if (!window.confirm(`Delete ${selectedIds.length} selected users?`)) return;

    try {
      for (const id of selectedIds) {
        await api.delete(`/api/users/${id}`);
      }
      setMsg(`✅ Deleted ${selectedIds.length} users`);
      setSelected({});
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Bulk delete error");
    }
  };

  return (
    <AdminLayout title="Users" subtitle="Create, edit, delete & manage roles">
      {/* ✅ Summary + actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={card}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Total Users</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{users.length}</div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Selected</div>
          <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{selectedIds.length}</div>
        </div>

        <div style={{ ...card, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={load} style={btnLight}>Refresh</button>
          <button onClick={bulkDelete} style={{ ...btn, background: selectedIds.length ? "#b91c1c" : "#9ca3af" }} disabled={!selectedIds.length}>
            Delete Selected
          </button>
        </div>
      </div>

      {msg ? (
        <div style={{ ...card, borderColor: "#e5e7eb", background: "#f9fafb", marginBottom: 12 }}>
          {msg}
        </div>
      ) : null}

      {/* ✅ Edit card */}
      {editId ? (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Edit User</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Update details, role, manager, active status, password reset</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveEdit} style={btn}>Save</button>
              <button onClick={cancelEdit} style={btnLight}>Cancel</button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Name</span>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm(s => ({ ...s, name: e.target.value }))}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Email</span>
              <input
                value={editForm.email}
                onChange={(e) => setEditForm(s => ({ ...s, email: e.target.value }))}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Role</span>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm(s => ({ ...s, role: e.target.value }))}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }}
              >
                <option value="employee">employee</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Manager (for employee)</span>
              <select
                value={editForm.managerId || ""}
                onChange={(e) => setEditForm(s => ({ ...s, managerId: e.target.value }))}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }}
              >
                <option value="">-- none --</option>
                {managers.map(m => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Reset Password (optional)</span>
              <input
                type="password"
                value={editForm.newPassword}
                onChange={(e) => setEditForm(s => ({ ...s, newPassword: e.target.value }))}
                placeholder="New password"
                style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
              />
            </label>

            <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 22 }}>
              <input
                type="checkbox"
                checked={!!editForm.isActive}
                onChange={(e) => setEditForm(s => ({ ...s, isActive: e.target.checked }))}
              />
              <span style={{ fontWeight: 800 }}>Active</span>
            </label>
          </div>
        </div>
      ) : null}

      {/* ✅ Premium Table */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>User Directory</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Select multiple users for bulk actions</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {pill("Edit")}
            {pill("Delete")}
            {pill("Bulk delete")}
          </div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table width="100%" cellPadding="10" style={{ borderCollapse: "separate", borderSpacing: "0 10px", minWidth: 980 }}>
            <thead>
              <tr style={{ color: "#6b7280", fontSize: 12 }}>
                <th align="left">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedIds.length === users.length}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th align="left">User</th>
                <th align="left">Role</th>
                <th align="left">Manager</th>
                <th align="left">Active</th>
                <th align="left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((u) => {
                const mgrName = u.managerId ? (users.find(x => x._id === u.managerId)?.name || "Manager") : "-";

                return (
                  <tr key={u._id} style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                    <td style={{ paddingLeft: 10, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, border: "1px solid #e5e7eb" }}>
                      <input type="checkbox" checked={!!selected[u._id]} onChange={() => toggleOne(u._id)} />
                    </td>

                    <td style={{ border: "1px solid #e5e7eb" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 12, background: "#111827", color: "#fff", display: "grid", placeItems: "center", fontWeight: 900 }}>
                          {(u.name || "U").slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, color: "#111827" }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ border: "1px solid #e5e7eb" }}>
                      <span style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: u.role === "admin" ? "#111827" : u.role === "manager" ? "#4f46e5" : "#059669",
                        color: "#fff",
                        fontWeight: 800
                      }}>
                        {u.role}
                      </span>
                    </td>

                    <td style={{ border: "1px solid #e5e7eb" }}>{mgrName}</td>

                    <td style={{ border: "1px solid #e5e7eb" }}>
                      <span style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: u.isActive === false ? "#fee2e2" : "#dcfce7",
                        color: u.isActive === false ? "#991b1b" : "#065f46",
                        fontWeight: 900
                      }}>
                        {u.isActive === false ? "Inactive" : "Active"}
                      </span>
                    </td>

                    <td style={{ borderTopRightRadius: 14, borderBottomRightRadius: 14, border: "1px solid #e5e7eb" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => startEdit(u)} style={btnLight}>Edit</button>
                        <button onClick={() => deleteOne(u._id)} style={{ ...btn, background: "#b91c1c" }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: 16, color: "#6b7280" }}>No users found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
