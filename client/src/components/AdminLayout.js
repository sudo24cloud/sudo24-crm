import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const styles = {
  shell: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    minHeight: "calc(100vh - 0px)",
    background: "#f6f7fb"
  },
  sidebar: {
    borderRight: "1px solid #e7e7ee",
    background: "#ffffff",
    padding: 16,
    position: "sticky",
    top: 0,
    height: "100vh",
    overflow: "auto"
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    background: "linear-gradient(135deg, #101828, #1f2937)",
    color: "white"
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: "rgba(255,255,255,.15)",
    display: "grid",
    placeItems: "center",
    fontWeight: 900
  },
  nav: { marginTop: 14, display: "grid", gap: 8 },
  navItem: (active) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderRadius: 12,
    textDecoration: "none",
    color: active ? "#111827" : "#374151",
    background: active ? "#eef2ff" : "#fff",
    border: "1px solid " + (active ? "#c7d2fe" : "#e5e7eb")
  }),
  badge: {
    fontSize: 12,
    padding: "3px 8px",
    borderRadius: 999,
    background: "#111827",
    color: "white"
  },
  main: {
    padding: 18
  },
  topbar: {
    background: "rgba(255,255,255,.85)",
    backdropFilter: "blur(10px)",
    border: "1px solid #e7e7ee",
    borderRadius: 16,
    padding: 14,
    display: "flex",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between"
  },
  title: { fontSize: 16, fontWeight: 800, color: "#111827" },
  sub: { fontSize: 12, color: "#6b7280" },
  content: { marginTop: 14, maxWidth: 1200 },
  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#111827",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700
  }
};

export default function AdminLayout({ title, subtitle, children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();

  const links = [
    { to: "/", label: "Dashboard" },
    { to: "/leads", label: "Leads" },
    { to: "/followups", label: "Follow-ups" },
    { to: "/attendance", label: "Attendance" },
    ...(user?.role === "admin" || user?.role === "manager" ? [{ to: "/reports", label: "Reports" }] : []),
    ...(user?.role === "admin"
      ? [
          { to: "/users", label: "Users" },
          { to: "/admin-attendance", label: "Admin Attendance" },
          { to: "/policies", label: "Policies" },
          { to: "/company", label: "Company" }
        ]
      : [])
  ];

  // mobile
  const isMobile = window.innerWidth < 900;

  if (isMobile) {
    // simple mobile top layout
    return (
      <div style={{ background: "#f6f7fb", minHeight: "100vh", padding: 12 }}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>{title || "SUDO24 CRM"}</div>
            <div style={styles.sub}>{subtitle || `${user?.name} (${user?.role})`}</div>
          </div>
          <button style={styles.btn} onClick={logout}>Logout</button>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              style={{
                padding: "8px 10px",
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: loc.pathname === l.to ? "#111827" : "#fff",
                color: loc.pathname === l.to ? "#fff" : "#111827",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 13
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    );
  }

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.logo}>S24</div>
          <div>
            <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>SUDO24 CRM</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Admin Panel</div>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 10, borderRadius: 14, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: 800, color: "#111827" }}>{user?.name || "User"}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{user?.email}</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={styles.badge}>{user?.role}</span>
          </div>
        </div>

        <nav style={styles.nav}>
          {links.map((l) => {
            const active = loc.pathname === l.to;
            return (
              <Link key={l.to} to={l.to} style={styles.navItem(active)}>
                <span style={{ fontWeight: 800 }}>{l.label}</span>
                {active ? <span style={{ fontSize: 12, color: "#4f46e5" }}>●</span> : <span style={{ fontSize: 12, color: "#9ca3af" }}>›</span>}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 14 }}>
          <button style={{ ...styles.btn, width: "100%" }} onClick={logout}>Logout</button>
        </div>
      </aside>

      <main style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.title}>{title || "Admin Panel"}</div>
            <div style={styles.sub}>{subtitle || "Manage users, leads, attendance & reports"}</div>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Secure • Role-based • Multi-tenant
          </div>
        </div>

        <div style={styles.content}>{children}</div>
      </main>
    </div>
  );
}
