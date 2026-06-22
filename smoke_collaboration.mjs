import worker from "../collaboration-worker/src/index.js";

class MemoryKV {
  constructor() {
    this.values = new Map();
  }

  async get(key, type) {
    const value = this.values.get(key) ?? null;
    return type === "json" && value ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async delete(key) {
    this.values.delete(key);
  }

  async list({ prefix = "" } = {}) {
    return {
      keys: [...this.values.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((name) => ({ name })),
      list_complete: true,
    };
  }
}

const AUTH = new MemoryKV();
const env = {
  AUTH,
  SITE_URL: "https://glebsharygin-lab.github.io/vimsika_reader",
  ADMIN_GITHUB_LOGIN: "glebsharygin-lab",
};

async function call(path, { method = "GET", token, body } = {}) {
  const response = await worker.fetch(
    new Request(`https://collaboration.example${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
  return {
    status: response.status,
    body: await response.json().catch(() => ({})),
    cors: response.headers.get("Access-Control-Allow-Origin"),
  };
}

await AUTH.put(
  "session:admin-token",
  JSON.stringify({
    user: { id: 1, login: "glebsharygin-lab", name: "Administrator" },
  }),
);
await AUTH.put(
  "session:contributor-token",
  JSON.stringify({
    user: { id: 2, login: "trusted-scholar", name: "Contributor" },
  }),
);
await AUTH.put("role:trusted-scholar", "contributor");

const health = await call("/");
if (health.status !== 200) throw new Error("Expected healthy Worker response");
if (health.cors !== "https://glebsharygin-lab.github.io") {
  throw new Error(`Unexpected CORS origin: ${health.cors}`);
}

const anonymous = await call("/api/me");
if (anonymous.status !== 401) throw new Error("Expected anonymous rejection");

const administrator = await call("/api/me", { token: "admin-token" });
if (administrator.body.role !== "admin") {
  throw new Error("Expected configured administrator role");
}

const saved = await call("/api/users", {
  method: "POST",
  token: "admin-token",
  body: { login: "second-editor", role: "editor" },
});
if (saved.status !== 200) throw new Error("Expected administrator user update");

const users = await call("/api/users", { token: "admin-token" });
if (!users.body.users.some((user) => user.login === "second-editor")) {
  throw new Error("Expected trusted user in access list");
}

const forbiddenDirect = await call("/api/publish", {
  method: "POST",
  token: "contributor-token",
  body: {
    mode: "direct",
    editorial: {
      units: [],
      alignments: [],
      textEdits: {},
      lexiconEntries: [{ id: "lexicon-1" }],
      syntaxAnnotations: [{ id: "syntax-1" }],
    },
  },
});
if (forbiddenDirect.status !== 403) {
  throw new Error("Expected contributors to be blocked from direct publishing");
}

console.log(
  `health=${health.status} anonymous=${anonymous.status} admin=${administrator.body.role} users=${users.body.users.length} contributorDirect=${forbiddenDirect.status}`,
);
