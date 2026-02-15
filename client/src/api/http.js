import axios from "axios";

export const API_BASE = "http://localhost:5000";

export function makeClient(getToken) {
  const client = axios.create({ baseURL: API_BASE });

  client.interceptors.request.use((config) => {
    const t = getToken?.();
    if (t) config.headers.Authorization = `Bearer ${t}`;
    return config;
  });

  return client;
}
