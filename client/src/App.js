import React from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Users from "./pages/Users";
import CompanySettings from "./pages/CompanySettings";
import MyFollowups from "./pages/MyFollowups";

import Attendance from "./pages/Attendance";
import EmployeePolicies from "./pages/EmployeePolicies";
import AdminAttendance from "./pages/AdminAttendance";

import Reports from "./pages/Reports";

import SuperLogin from "./pages/SuperLogin";
import SuperDashboard from "./pages/SuperDashboard";

import LeadImportExport from "./pages/LeadImportExport"; // ✅ NEW

import ProtectedRoute from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthContext";

function TopBar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  // ✅ Hide TopBar on super pages
  if (location.pathname.startsWith("/super")) return null;

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";

  return (
    <div
      style={{
        padding: 12,
        borderBottom: "1px solid #ddd",
        display: "flex",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap"
      }}
    >
      <b>SUDO24 CRM V1</b>

      {user ? (
        <>
          <Link to="/">Dashboard</Link>
          <Link to="/leads">Leads</Link>
          <Link to="/followups">Follow-ups</Link>
          <Link to="/attendance">Attendance</Link>

          {(isAdmin || isManager) ? <Link to="/bulk-leads">Bulk Leads</Link> : null}
          {(isAdmin || isManager) ? <Link to="/reports">Reports</Link> : null}

          {isAdmin ? (
            <>
              <Link to="/users">Users</Link>
              <Link to="/company">Company</Link>
              <Link to="/admin-attendance">Admin Attendance</Link>
              <Link to="/policies">Policies</Link>
            </>
          ) : null}
        </>
      ) : null}

      <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
        {user ? <span>Logged in: {user.name} ({user.role})</span> : null}

        {user ? (
          <button
            onClick={() => {
              logout();
              nav("/login");
            }}
          >
            Logout
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TopBar />

      <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
        <Routes>
          {/* ✅ Super Admin */}
          <Route path="/super-login" element={<SuperLogin />} />
          <Route path="/super" element={<SuperDashboard />} />

          {/* ✅ Normal */}
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
          <Route path="/followups" element={<ProtectedRoute><MyFollowups /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />

          {/* ✅ Bulk Leads (Admin + Manager only) */}
          <Route
            path="/bulk-leads"
            element={
              <ProtectedRoute roles={["admin", "manager"]}>
                <LeadImportExport />
              </ProtectedRoute>
            }
          />

          {/* ✅ Reports (Admin + Manager only) */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute roles={["admin", "manager"]}>
                <Reports />
              </ProtectedRoute>
            }
          />

          {/* ✅ Admin-only */}
          <Route path="/users" element={<ProtectedRoute roles={["admin"]}><Users /></ProtectedRoute>} />
          <Route path="/company" element={<ProtectedRoute roles={["admin"]}><CompanySettings /></ProtectedRoute>} />
          <Route path="/admin-attendance" element={<ProtectedRoute roles={["admin"]}><AdminAttendance /></ProtectedRoute>} />
          <Route path="/policies" element={<ProtectedRoute roles={["admin"]}><EmployeePolicies /></ProtectedRoute>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
