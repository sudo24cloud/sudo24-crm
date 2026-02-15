import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { api, login } = useAuth();
  const nav = useNavigate();

  const [mode, setMode] = useState("login");

  // 🔹 NEW: company name state
  const [companyName, setCompanyName] = useState("SUDO24 Learning");

  const [name, setName] = useState("Admin");
  const [email, setEmail] = useState("admin@sudo24.com");
  const [password, setPassword] = useState("Admin@123");
  const [msg, setMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      if (mode === "bootstrap") {

        // 🔹 UPDATED: send companyName also
        await api.post("/api/auth/bootstrap", {
          companyName,
          name,
          email,
          password
        });

        setMsg("✅ Company + Admin created. Now login.");
        setMode("login");
        return;
      }

      const res = await api.post("/api/auth/login", { email, password });

      login(res.data);
      nav("/");

    } catch (err) {
      setMsg(err?.response?.data?.message || "Error");
    }
  };

  return (
    <div style={{ maxWidth: 420 }}>
      <h2>Login</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setMode("login")} disabled={mode === "login"}>
          Login
        </button>

        <button onClick={() => setMode("bootstrap")} disabled={mode === "bootstrap"}>
          First Admin Setup
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>

        {/* 🔹 NEW: Company Name field (only in bootstrap) */}
        {mode === "bootstrap" && (
          <>
            <label>
              Company Name
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </label>

            <label>
              Admin Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          </>
        )}

        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button type="submit">
          {mode === "bootstrap" ? "Create Company & Admin" : "Login"}
        </button>

        {msg ? (
          <div style={{ padding: 10, background: "#f5f5f5" }}>
            {msg}
          </div>
        ) : null}

      </form>
    </div>
  );
}
