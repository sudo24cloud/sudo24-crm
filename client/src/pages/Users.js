// client/src/pages/Users.js
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import AdminLayout from "../components/AdminLayout";

const USERS_URL = "/api/users";
const UPLOAD_URL = "/api/upload/employee-photo"; // ✅ backend multer route

export default function Users() {
  const { api, user } = useAuth();

  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState("");

  // ✅ Create user form
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
    managerId: ""
  });

  const [selected, setSelected] = useState({});
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  );

  const [editId, setEditId] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "employee",
    managerId: "",
    isActive: true,
    newPassword: "",
    photoUrl: "" // ✅ NEW
  });

  // ✅ upload states
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const isAdmin = user?.role === "admin";
  const managers = useMemo(() => users.filter((u) => u.role === "manager"), [users]);

  const load = async () => {
    setMsg("");
    try {
      const res = await api.get(USERS_URL);
      setUsers(res.data || []);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error loading users");
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <AdminLayout title="Users" subtitle="Admin only">
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            background: "#fff"
          }}
        >
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

  const toggleAll = (checked) => {
    if (!checked) return setSelected({});
    const map = {};
    users.forEach((u) => {
      map[u._id] = true;
    });
    setSelected(map);
  };

  const toggleOne = (id) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const startEdit = (u) => {
    setMsg("");
    setUploadErr("");
    setEditId(u._id);
    setEditForm({
      name: u.name || "",
      email: u.email || "",
      role: u.role || "employee",
      managerId: u.managerId || "",
      isActive: u.isActive !== false,
      newPassword: "",
      photoUrl: u.photoUrl || u.avatar || u.profilePic || u.photo || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditId("");
    setUploadErr("");
    setUploading(false);
    setEditForm({
      name: "",
      email: "",
      role: "employee",
      managerId: "",
      isActive: true,
      newPassword: "",
      photoUrl: ""
    });
  };

  const saveEdit = async () => {
    setMsg("");
    try {
      const payload = {
        name: editForm.name,
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        managerId: editForm.managerId || null,
        isActive: !!editForm.isActive,
        photoUrl: editForm.photoUrl || ""
      };
      if (editForm.newPassword) payload.newPassword = editForm.newPassword;

      await api.patch(`${USERS_URL}/${editId}`, payload);
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
      await api.delete(`${USERS_URL}/${id}`);
      setMsg("✅ User deleted");
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
    if (selectedIds.length === 0) return setMsg("Select users first");
    if (!window.confirm(`Delete ${selectedIds.length} selected users?`)) return;

    try {
      for (const id of selectedIds) await api.delete(`${USERS_URL}/${id}`);
      setMsg(`✅ Deleted ${selectedIds.length} users`);
      setSelected({});
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Bulk delete error");
    }
  };

  // ✅ Create user
  const createUser = async () => {
    setMsg("");
    try {
      const payload = {
        name: createForm.name,
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: createForm.role,
        managerId: createForm.managerId || null
      };

      await api.post(USERS_URL, payload);

      setMsg("✅ User created");
      setCreateForm({ name: "", email: "", password: "", role: "employee", managerId: "" });
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Create user error");
    }
  };

  /* ==========================
     ✅ PHOTO UPLOAD (ADMIN)
     ========================== */

  // If backend returns "/uploads/xyz.jpg", make it absolute in dev:
  const makeAbsoluteIfNeeded = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;

    const base = process.env.REACT_APP_API_URL || "";
    if (!base) return url; // production same origin
    return `${base}${url}`;
  };

  const getFallbackAvatar = (name) =>
    "https://ui-avatars.com/api/?name=" + encodeURIComponent(name || "User") + "&background=111827&color=fff&size=256";

  const uploadEmployeePhoto = async (file) => {
    setUploadErr("");
    setUploading(true);

    try {
      if (!file) throw new Error("No file selected");
      if (file.size > 2 * 1024 * 1024) throw new Error("Max file size 2MB");
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Only JPG / PNG / WEBP allowed");
      }

      const fd = new FormData();
      fd.append("photo", file);

      const res = await api.post(UPLOAD_URL, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const urlFromServer = res?.data?.url;
      if (!urlFromServer) throw new Error("Upload failed: URL not returned");

      // ✅ set in edit form (will save on Save)
      setEditForm((s) => ({ ...s, photoUrl: urlFromServer }));
    } catch (e) {
      setUploadErr(e?.response?.data?.message || e?.message || "Upload error");
    } finally {
      setUploading(false);
    }
  };

  const rowAvatar = (u) => {
    const raw = u?.photoUrl || u?.avatar || u?.profilePic || u?.photo || "";
    return raw ? makeAbsoluteIfNeeded(raw) : getFallbackAvatar(u?.name);
  };

  const editPreviewAvatar = () => {
    const raw = editForm.photoUrl || "";
    return raw ? makeAbsoluteIfNeeded(raw) : getFallbackAvatar(editForm.name);
  };

  return (
    <AdminLayout title="Users" subtitle="Create, edit, delete & manage roles">
      {/* Create User */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Create New User</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          Admin can create employee/manager/admin.
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Name</span>
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Email</span>
            <input
              value={createForm.email}
              onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Password</span>
            <input
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Role</span>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm((s) => ({ ...s, role: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }}
            >
              <option value="employee">employee</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Manager (only for employee)</span>
            <select
              value={createForm.managerId}
              onChange={(e) => setCreateForm((s) => ({ ...s, managerId: e.target.value }))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }}
            >
              <option value="">-- none --</option>
              {managers.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
            <button onClick={createUser} style={btn}>
              Create User
            </button>
            <button onClick={load} style={btnLight}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
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
          <button onClick={load} style={btnLight}>
            Refresh
          </button>
          <button
            onClick={bulkDelete}
            style={{ ...btn, background: selectedIds.length ? "#b91c1c" : "#9ca3af" }}
            disabled={!selectedIds.length}
          >
            Delete Selected
          </button>
        </div>
      </div>

      {msg ? (
        <div style={{ ...card, borderColor: "#e5e7eb", background: "#f9fafb", marginBottom: 12 }}>{msg}</div>
      ) : null}

      {/* Edit */}
      {editId ? (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Edit User</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Update details, role, manager, active status, password reset, photo upload
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveEdit} style={btn}>
                Save
              </button>
              <button onClick={cancelEdit} style={btnLight}>
                Cancel
              </button>
            </div>
          </div>

          {/* ✅ PHOTO UPLOAD SECTION (Admin Button) */}
          <div style={{ marginTop: 12, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                width: 74,
                height: 74,
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                background: "#f3f4f6"
              }}
              title="Profile photo preview"
            >
              <img
                src={editPreviewAvatar()}
                alt="profile"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  e.currentTarget.src = getFallbackAvatar(editForm.name);
                }}
              />
            </div>

            <div style={{ display: "grid", gap: 6, minWidth: 280 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Upload Profile Photo (JPG/PNG/WEBP, max 2MB)</div>

              {/* ✅ Styled Upload Button */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  id="empPhoto"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  disabled={uploading}
                  onChange={(e) => uploadEmployeePhoto(e.target.files?.[0])}
                />

                <label
                  htmlFor="empPhoto"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: uploading ? "#9ca3af" : "#111827",
                    color: "#fff",
                    cursor: uploading ? "not-allowed" : "pointer",
                    fontWeight: 800
                  }}
                >
                  {uploading ? "Uploading..." : "Upload Photo"}
                </label>

                {editForm.photoUrl ? (
                  <button
                    type="button"
                    onClick={() => setEditForm((s) => ({ ...s, photoUrl: "" }))}
                    style={btnLight}
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              {uploadErr ? <div style={{ fontSize: 12, color: "#b91c1c" }}>{uploadErr}</div> : null}
              {editForm.photoUrl ? (
                <div style={{ fontSize: 12, color: "#059669" }}>✅ Photo attached (click “Save” to store)</div>
              ) : (
                <div style={{ fontSize: 12, color: "#6b7280" }}>No photo set</div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Name</span>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Email</span>
              <input
                value={editForm.email}
                onChange={(e) => setEditForm((s) => ({ ...s, email: e.target.value }))}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Role</span>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm((s) => ({ ...s, role: e.target.value }))}
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
                onChange={(e) => setEditForm((s) => ({ ...s, managerId: e.target.value }))}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }}
              >
                <option value="">-- none --</option>
                {managers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Reset Password (optional)</span>
              <input
                type="password"
                value={editForm.newPassword}
                onChange={(e) => setEditForm((s) => ({ ...s, newPassword: e.target.value }))}
                placeholder="New password"
                style={{ padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
              />
            </label>

            <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 22 }}>
              <input
                type="checkbox"
                checked={!!editForm.isActive}
                onChange={(e) => setEditForm((s) => ({ ...s, isActive: e.target.checked }))}
              />
              <span style={{ fontWeight: 800 }}>Active</span>
            </label>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
            Upload photo → then click <b>Save</b> (photoUrl DB me save hoga).
          </div>
        </div>
      ) : null}

      {/* Table */}
      <div style={card}>
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table
            width="100%"
            cellPadding="10"
            style={{ borderCollapse: "separate", borderSpacing: "0 10px", minWidth: 980 }}
          >
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
                const mgrName = u.managerId ? (users.find((x) => x._id === u.managerId)?.name || "Manager") : "-";

                return (
                  <tr key={u._id} style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                    <td
                      style={{
                        paddingLeft: 10,
                        borderTopLeftRadius: 14,
                        borderBottomLeftRadius: 14,
                        border: "1px solid #e5e7eb"
                      }}
                    >
                      <input type="checkbox" checked={!!selected[u._id]} onChange={() => toggleOne(u._id)} />
                    </td>

                    <td style={{ border: "1px solid #e5e7eb" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            overflow: "hidden",
                            border: "1px solid #e5e7eb",
                            background: "#f3f4f6"
                          }}
                        >
                          <img
                            src={rowAvatar(u)}
                            alt="avatar"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              e.currentTarget.src = getFallbackAvatar(u?.name);
                            }}
                          />
                        </div>

                        <div>
                          <div style={{ fontWeight: 900, color: "#111827" }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ border: "1px solid #e5e7eb" }}>{u.role}</td>
                    <td style={{ border: "1px solid #e5e7eb" }}>{mgrName}</td>
                    <td style={{ border: "1px solid #e5e7eb" }}>{u.isActive === false ? "Inactive" : "Active"}</td>

                    <td style={{ borderTopRightRadius: 14, borderBottomRightRadius: 14, border: "1px solid #e5e7eb" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => startEdit(u)} style={btnLight}>
                          Edit
                        </button>
                        <button onClick={() => deleteOne(u._id)} style={{ ...btn, background: "#b91c1c" }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: 16, color: "#6b7280" }}>
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
