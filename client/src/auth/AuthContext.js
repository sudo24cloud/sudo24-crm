// client/src/auth/AuthContext.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  /**
   * ✅ IMPORTANT:
   * .env in client root:
   * REACT_APP_API_URL=http://localhost:5000
   * (NO /api, NO trailing slash)
   */
  const API_ROOT =
    (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [authReady, setAuthReady] = useState(false); // ✅ prevents early redirect issues

  // ✅ axios instance
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_ROOT,
      headers: { "Content-Type": "application/json" }
    });

    // ✅ attach token
    instance.interceptors.request.use(
      (config) => {
        const t = localStorage.getItem("token");
        if (t) config.headers.Authorization = `Bearer ${t}`;
        return config;
      },
      (error) => Promise.reject(error)
    );

    return instance;
  }, [API_ROOT]);

  /**
   * ✅ Login handler
   * expects: { token, user }
   */
  const login = (data) => {
    const t = data?.token || "";
    const u = data?.user || null;

    setToken(t);
    setUser(u);

    if (t) localStorage.setItem("token", t);
    else localStorage.removeItem("token");

    if (u) localStorage.setItem("user", JSON.stringify(u));
    else localStorage.removeItem("user");
  };

  /**
   * ✅ Logout handler
   */
  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  /**
   * ✅ Refresh latest user from server (for photoUrl updates)
   * Backend must have: GET /api/auth/me
   * If not present, it will silently skip (so login won't break).
   */
  const refreshMe = async () => {
    const t = localStorage.getItem("token");
    if (!t) return;

    try {
      const res = await api.get("/api/auth/me");
      const fresh = res.data;

      if (fresh && typeof fresh === "object") {
        setUser(fresh);
        localStorage.setItem("user", JSON.stringify(fresh));
      }
    } catch (e) {
      // ✅ don't force logout here (prevents login breaking if /me not added yet)
      // You can enable strict logout after backend is ready.
      // console.log("refreshMe failed:", e?.response?.status);
    }
  };

  /**
   * ✅ On app load: mark auth ready
   * and try refreshMe if token exists (won't break login if endpoint missing).
   */
  useEffect(() => {
    (async () => {
      await refreshMe();
      setAuthReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        api,
        API_ROOT,
        token,
        user,
        authReady,
        login,
        logout,
        refreshMe,
        setUser // optional: useful if you want to update user locally
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
