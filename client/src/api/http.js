import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL
});

export default API;

import axios from "axios";

export const API_BASE = "https://sudo24-crm.onrender.com";

export function makeClient(getToken) {
  const client = axios.create({ baseURL: API_BASE });

  client.interceptors.request.use((config) => {
    const t = getToken?.();
    if (t) config.headers.Authorization = `Bearer ${t}`;
    return config;
  });

  return client;
}
