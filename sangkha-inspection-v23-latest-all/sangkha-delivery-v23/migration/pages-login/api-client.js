/* Migration bridge: preserves legacy google.script.run callback chaining while routing requests to the Worker API. */
(function () {
  const config = window.SANGKHA_CONFIG || {};
  const baseUrl = String(config.API_BASE_URL || "").replace(/\/$/, "");
  const sessionId = () => new URLSearchParams(location.search).get("sessionId") || sessionStorage.getItem("sessionId") || "";

  async function request(path, options) {
    const response = await fetch(baseUrl + path, { ...options, headers: { "Content-Type": "application/json", ...(options && options.headers ? options.headers : {}) } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "เชื่อมต่อระบบไม่สำเร็จ");
    return data;
  }

  const methods = {
    verifyLogin: (studentId, pin) => request("/auth/login", { method: "POST", body: JSON.stringify({ username: studentId, password: pin }) }),
    getSession: (id) => request("/auth/session", { headers: { Authorization: "Bearer " + (id || sessionId()) } }),
    logout: (id) => request("/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + (id || sessionId()) } }),
    getInspectorLocations: (id) => request("/inspector/locations", { headers: { Authorization: "Bearer " + (id || sessionId()) } }),
    getAllowedInspectionLocations: (id) => request("/inspector/locations", { headers: { Authorization: "Bearer " + (id || sessionId()) } }),
    getInspectorData: (id) => request("/inspector/me", { headers: { Authorization: "Bearer " + (id || sessionId()) } }),
    getAppData: (id) => request("/inspector/me", { headers: { Authorization: "Bearer " + (id || sessionId()) } }),
    getDashboardSummary: (id) => request("/inspector/locations", { headers: { Authorization: "Bearer " + (id || sessionId()) } }),
    getSupervisorDashboard: (id) => request("/supervisor/dashboard", { headers: { Authorization: "Bearer " + (typeof id === "string" ? id : sessionId()) } }),
    submitInspection: (user, locationId, scores, photoData, remark, isProxy, originalInspectorId) => request("/inspections", { method: "POST", headers: { Authorization: "Bearer " + sessionId() }, body: JSON.stringify({ locationId, scores, remark, photoData, isProxy, originalInspectorId }) })
  };

  window.SangkhaAPI = Object.freeze(methods);
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = new Proxy({}, { get: (_, method) => {
    if (method === "withSuccessHandler" || method === "withFailureHandler") return (handler) => createChain(handler, undefined);
    return (...args) => createChain(undefined, undefined, method, args);
  }});

  function createChain(success, failure, initialMethod, initialArgs) {
    const state = { success: success || (() => {}), failure: failure || ((error) => console.error(error)) };
    return new Proxy({}, { get: (_, method) => {
      if (method === "withSuccessHandler") return (handler) => { state.success = handler || state.success; return createChain(state.success, state.failure); };
      if (method === "withFailureHandler") return (handler) => { state.failure = handler || state.failure; return createChain(state.success, state.failure); };
      if (initialMethod) return undefined;
      return (...args) => { Promise.resolve().then(() => methods[method](...args)).then(state.success).catch(state.failure); return createChain(state.success, state.failure); };
    }});
  }
})();
