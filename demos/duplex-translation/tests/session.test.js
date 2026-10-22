import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionBootstrap } from "../public/session.js";

function bootstrap(request, initialToken = "") {
  const state = { token: initialToken, session: "" };
  const ensure = createSessionBootstrap({
    getToken: () => state.token, setToken: (value) => { state.token = value; },
    getSession: () => state.session, setSession: (value) => { state.session = value; },
    getMuseum: () => "610000000000000001", device: "test-browser", request,
  });
  return { state, ensure };
}

test("guest bootstrap shares concurrent login and creates one session with a string museum ID", async () => {
  const calls = [];
  const { state, ensure } = bootstrap(async (endpoint, options) => {
    calls.push({ endpoint, options });
    return endpoint.endsWith("GuestLogin") ? { accessToken: "guest-token" } : { id: "2076894321939976192" };
  });
  await Promise.all([ensure(), ensure(), ensure()]);
  await ensure();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].endpoint, "/api/AppUser/GuestLogin");
  assert.deepEqual(calls[0].options.headers, {});
  assert.equal(calls[0].options.body.platform, 5);
  assert.equal(calls[1].options.body.museumId, "610000000000000001");
  assert.equal(state.token, "guest-token");
  assert.equal(state.session, "2076894321939976192");
});

test("existing token skips guest login", async () => {
  const calls = [];
  const { state, ensure } = bootstrap(async (endpoint) => {
    calls.push(endpoint);
    return { id: "2076894321939976192" };
  }, "existing-token");
  await ensure();
  assert.deepEqual(calls, ["sessions"]);
  assert.equal(state.token, "existing-token");
});

test("failed session creation retries without signing in another guest", async () => {
  let logins = 0;
  let sessions = 0;
  const { ensure } = bootstrap(async (endpoint) => {
    if (endpoint.endsWith("GuestLogin")) { logins += 1; return { accessToken: "guest-token" }; }
    sessions += 1;
    if (sessions === 1) throw new Error("temporary failure");
    return { id: "2076894321939976192" };
  });
  await assert.rejects(ensure(), /temporary failure/);
  await ensure();
  assert.equal(logins, 1);
  assert.equal(sessions, 2);
});

test("missing guest token never creates an unauthenticated session", async () => {
  const calls = [];
  const { ensure } = bootstrap(async (endpoint) => { calls.push(endpoint); return {}; });
  await assert.rejects(ensure(), /有效 Token/);
  assert.deepEqual(calls, ["/api/AppUser/GuestLogin"]);
});
