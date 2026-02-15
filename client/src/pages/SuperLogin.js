import React, { useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:5000";

export default function SuperLogin() {
  const [email, setEmail] = useState("superadmin@sudo24.com");
  const [password, setPassword] = useState("Super@123");
  const [msg, setMsg] = useState("");

  const login = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const res = await axios.post(`${API_BASE}/api/super/login`, { email, password });
      localStorage.setItem("superToken", res.data.token);

      window.location.href = "/super";
    } catch (err) {
      setMsg(err?.response?.data?.message || "Error");
    }
  };

  return (
    <div style={{ maxWidth: 420 }}>
      <h2>Super Admin Login</h2>
      <form onSubmit={login} style={{ display: "grid", gap: 10 }}>
        <label>Email <input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button type="submit">Login</button>
        {msg ? <div style={{ padding: 10, background: "#f5f5f5" }}>{msg}</div> : null}
      </form>
    </div>
  );
}
