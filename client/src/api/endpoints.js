export const EP = {
  auth: {
    login: "/auth/login",
    bootstrap: "/auth/bootstrap",
  },
  users: {
    list: "/users",
    create: "/users",
    update: (id) => `/users/${id}`,
    remove: (id) => `/users/${id}`,
  },
  leads: {
    list: "/leads",
    create: "/leads",
    update: (id) => `/leads/${id}`,
    remove: (id) => `/leads/${id}`,
  }
};
