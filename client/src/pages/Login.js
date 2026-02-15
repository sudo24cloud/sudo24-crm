import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { api, login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");

  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      // 🔹 First time company setup
      if (mode === "bootstrap") {
        await api.post("/api/auth/bootstrap", {
          companyName,
          name,
          email,
          password
        });

        setMsg("✅ Company & Admin created. Now login.");
        setMode("login");
        setLoading(false);
        return;
      }

      // 🔹 Normal login
      const res = await api.post("/api/auth/login", {
        email,
        password
      });

      login(res.data);
      navigate("/");

    } catch (err) {
      setMsg(err?.response?.data?.message || "Login failed");
    }

    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 420, margin: "50px auto" }}>
      <h2>SUDO24 CRM Login</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setMode("login")}
          disabled={mode === "login"}
        >
          Login
        </button>

        <button
          onClick={() => setMode("bootstrap")}
          disabled={mode === "bootstrap"}
        >
          First Admin Setup
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>

        {mode === "bootstrap" && (
          <>
            <label>
              Company Name
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </label>

            <label>
              Admin Name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          </>
        )}

        <label>
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label>
          Password
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading
            ? "Please wait..."
            : mode === "bootstrap"
            ? "Create Company & Admin"
            : "Login"}
        </button>

        {msg && (
          <div style={{ padding: 10, background: "#f5f5f5" }}>
            {msg}
          </div>
        )}

      </form>
    </div>
  );
}
