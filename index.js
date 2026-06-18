const SESSION_SECONDS = 60 * 60 * 24 * 30;
const GITHUB_API_VERSION = "2026-03-10";
const ALLOWED_ROLES = new Set(["reader", "contributor", "editor"]);

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") {
        return withCors(new Response(null, { status: 204 }), env);
      }

      const url = new URL(request.url);
      let response;

      if (url.pathname === "/auth/login" && request.method === "GET") {
        response = await beginGitHubLogin(url, env);
      } else if (
        url.pathname === "/auth/callback" &&
        request.method === "GET"
      ) {
        response = await completeGitHubLogin(url, env);
      } else if (
        url.pathname === "/auth/exchange" &&
        request.method === "POST"
      ) {
        response = await exchangeLoginCode(request, env);
      } else if (
        url.pathname === "/auth/logout" &&
        request.method === "POST"
      ) {
        response = await endSession(request, env);
      } else if (url.pathname === "/api/me" && request.method === "GET") {
        const session = await requireSession(request, env);
        response = json({
          user: publicUser(session.user),
          role: await roleForLogin(session.user.login, env),
        });
      } else if (url.pathname === "/api/users") {
        const session = await requireRole(request, env, ["admin"]);
        if (request.method === "GET") {
          response = json({ users: await listTrustedUsers(env) });
        } else if (request.method === "POST") {
          response = await saveTrustedUser(request, session, env);
        } else {
          response = json({ error: "Method not allowed." }, 405);
        }
      } else if (
        url.pathname.startsWith("/api/users/") &&
        request.method === "DELETE"
      ) {
        const session = await requireRole(request, env, ["admin"]);
        response = await removeTrustedUser(url, session, env);
      } else if (
        url.pathname === "/api/publish" &&
        request.method === "POST"
      ) {
        const session = await requireRole(request, env, [
          "contributor",
          "editor",
          "admin",
        ]);
        response = await publishEditorialChanges(request, session, env);
      } else {
        response = json({
          service: "Viṃśikā collaboration service",
          status: "ok",
        });
      }

      return withCors(response, env);
    } catch (error) {
      const status = error.status || 500;
      return withCors(
        json(
          {
            error:
              status === 500
                ? "The collaboration service encountered an error."
                : error.message,
          },
          status,
        ),
        env,
      );
    }
  },
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function withCors(response, env) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", new URL(env.SITE_URL).origin);
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function randomToken(bytes = 32) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return base64Url(values);
}

function base64Url(value) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(text) {
  const binary = atob(text.replaceAll("\n", ""));
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0),
  );
  return new TextDecoder().decode(bytes);
}

function safeReturnTo(value, env) {
  try {
    const target = new URL(value || env.SITE_URL);
    const site = new URL(env.SITE_URL);
    if (target.origin !== site.origin) throw new Error();
    return target.href;
  } catch {
    return env.SITE_URL;
  }
}

async function beginGitHubLogin(url, env) {
  const state = randomToken();
  const returnTo = safeReturnTo(url.searchParams.get("return_to"), env);
  await env.AUTH.put(`oauth:${state}`, returnTo, {
    expirationTtl: 600,
  });
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${url.origin}/auth/callback`);
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  return Response.redirect(authorize.href, 302);
}

async function completeGitHubLogin(url, env) {
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const returnTo = state ? await env.AUTH.get(`oauth:${state}`) : null;
  if (!state || !code || !returnTo) {
    throw httpError(400, "The GitHub sign-in request expired.");
  }
  await env.AUTH.delete(`oauth:${state}`);

  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
      }),
    },
  );
  const token = await tokenResponse.json();
  if (!token.access_token) {
    throw httpError(401, "GitHub sign-in could not be completed.");
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token.access_token}`,
      "User-Agent": "vimsika-collaboration",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    },
  });
  if (!userResponse.ok) {
    throw httpError(401, "GitHub user information could not be read.");
  }
  const user = await userResponse.json();
  const exchangeCode = randomToken();
  await env.AUTH.put(
    `exchange:${exchangeCode}`,
    JSON.stringify({
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatar_url,
      },
    }),
    { expirationTtl: 300 },
  );

  const redirect = new URL(returnTo);
  redirect.searchParams.set("vimsika_exchange", exchangeCode);
  return Response.redirect(redirect.href, 302);
}

async function exchangeLoginCode(request, env) {
  const { code } = await request.json();
  const pending = code ? await env.AUTH.get(`exchange:${code}`, "json") : null;
  if (!pending) throw httpError(401, "The sign-in code expired.");
  await env.AUTH.delete(`exchange:${code}`);

  const token = randomToken();
  await env.AUTH.put(`session:${token}`, JSON.stringify(pending), {
    expirationTtl: SESSION_SECONDS,
  });
  return json({
    token,
    user: publicUser(pending.user),
    role: await roleForLogin(pending.user.login, env),
  });
}

function publicUser(user) {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
}

async function requireSession(request, env) {
  const token = bearerToken(request);
  const session = token
    ? await env.AUTH.get(`session:${token}`, "json")
    : null;
  if (!session) throw httpError(401, "Please sign in with GitHub.");
  return session;
}

function bearerToken(request) {
  const authorization = request.headers.get("Authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
}

async function endSession(request, env) {
  const token = bearerToken(request);
  if (token) await env.AUTH.delete(`session:${token}`);
  return json({ message: "Signed out." });
}

async function requireRole(request, env, allowedRoles) {
  const session = await requireSession(request, env);
  const role = await roleForLogin(session.user.login, env);
  if (!allowedRoles.includes(role)) {
    throw httpError(403, "Your account does not have permission for this action.");
  }
  return { ...session, role };
}

async function roleForLogin(login, env) {
  const normalized = login.toLowerCase();
  if (normalized === env.ADMIN_GITHUB_LOGIN.toLowerCase()) return "admin";
  return (await env.AUTH.get(`role:${normalized}`)) || "reader";
}

async function listTrustedUsers(env) {
  const users = [
    {
      login: env.ADMIN_GITHUB_LOGIN,
      role: "admin",
      fixed: true,
    },
  ];
  let cursor;
  do {
    const page = await env.AUTH.list({ prefix: "role:", cursor });
    for (const key of page.keys) {
      users.push({
        login: key.name.slice(5),
        role: await env.AUTH.get(key.name),
        fixed: false,
      });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return users.sort((left, right) => left.login.localeCompare(right.login));
}

async function saveTrustedUser(request, session, env) {
  const { login, role } = await request.json();
  const normalized = String(login || "").trim().toLowerCase();
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(normalized)) {
    throw httpError(400, "Enter a valid GitHub login.");
  }
  if (!ALLOWED_ROLES.has(role)) {
    throw httpError(400, "Choose a valid role.");
  }
  if (normalized === env.ADMIN_GITHUB_LOGIN.toLowerCase()) {
    throw httpError(400, "The configured administrator role is fixed.");
  }
  await env.AUTH.put(`role:${normalized}`, role);
  return json({
    message: `${normalized} is now a ${role}.`,
    changedBy: session.user.login,
  });
}

async function removeTrustedUser(url, session, env) {
  const login = decodeURIComponent(url.pathname.slice("/api/users/".length))
    .trim()
    .toLowerCase();
  if (!login) throw httpError(400, "GitHub login is required.");
  if (login === env.ADMIN_GITHUB_LOGIN.toLowerCase()) {
    throw httpError(400, "The configured administrator cannot be removed.");
  }
  await env.AUTH.delete(`role:${login}`);
  return json({
    message: `${login} no longer has editorial access.`,
    changedBy: session.user.login,
  });
}

function normalizeEditorial(editorial) {
  const units = Array.isArray(editorial?.units) ? editorial.units : [];
  const alignments = Array.isArray(editorial?.alignments)
    ? editorial.alignments
    : [];
  const sentenceEdits = Array.isArray(editorial?.sentenceEdits)
    ? editorial.sentenceEdits
    : [];
  const sectionEdits = Array.isArray(editorial?.sectionEdits)
    ? editorial.sectionEdits
    : [];
  const lexiconEntries = Array.isArray(editorial?.lexiconEntries)
    ? editorial.lexiconEntries
    : [];
  const syntaxAnnotations = Array.isArray(editorial?.syntaxAnnotations)
    ? editorial.syntaxAnnotations
    : [];
  const textEdits = Array.isArray(editorial?.textEdits)
    ? Object.fromEntries(
        editorial.textEdits.map((edit) => [
          `${edit.passageId}:${edit.sourceId}`,
          edit,
        ]),
      )
    : editorial?.textEdits || {};
  return {
    units,
    alignments,
    sentenceEdits,
    sectionEdits,
    textEdits,
    lexiconEntries,
    syntaxAnnotations,
  };
}

function mergeById(existing, incoming) {
  return [
    ...new Map(
      [...(existing || []), ...(incoming || [])].map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ];
}

function mergeByUnitId(existing, incoming) {
  return [
    ...new Map(
      [...(existing || []), ...(incoming || [])].map((item) => [
        item.unitId || item.id,
        item,
      ]),
    ).values(),
  ];
}

function mergeEditorial(existing, incoming, login) {
  const current = normalizeEditorial(existing);
  const changes = normalizeEditorial(incoming);
  return {
    schemaVersion: "0.2.0-published-editorial",
    updatedAt: new Date().toISOString(),
    updatedBy: login,
    units: mergeById(current.units, changes.units),
    alignments: mergeById(current.alignments, changes.alignments),
    sentenceEdits: mergeById(
      current.sentenceEdits,
      changes.sentenceEdits,
    ),
    sectionEdits: mergeByUnitId(
      current.sectionEdits,
      changes.sectionEdits,
    ),
    lexiconEntries: mergeById(
      current.lexiconEntries,
      changes.lexiconEntries,
    ),
    syntaxAnnotations: mergeById(
      current.syntaxAnnotations,
      changes.syntaxAnnotations,
    ),
    textEdits: {
      ...current.textEdits,
      ...changes.textEdits,
    },
  };
}

function editorialChangeCount(editorial) {
  const normalized = normalizeEditorial(editorial);
  return (
    normalized.units.length +
    normalized.alignments.length +
    normalized.sentenceEdits.length +
    normalized.sectionEdits.length +
    Object.keys(normalized.textEdits).length +
    normalized.lexiconEntries.length +
    normalized.syntaxAnnotations.length
  );
}

async function publishEditorialChanges(request, session, env) {
  const { mode, message, editorial } = await request.json();
  if (!editorialChangeCount(editorial)) {
    throw httpError(400, "No editorial changes were supplied.");
  }
  if (!["review", "direct"].includes(mode)) {
    throw httpError(400, "Choose review or direct publication.");
  }
  if (mode === "direct" && !["editor", "admin"].includes(session.role)) {
    throw httpError(403, "Only editors and administrators can publish directly.");
  }

  const token = await githubInstallationToken(env);
  const branch = env.GITHUB_DEFAULT_BRANCH || "main";
  const currentFile = await getEditorialFile(branch, token, env);
  const merged = mergeEditorial(
    currentFile.data,
    editorial,
    session.user.login,
  );
  const commitMessage = `${message || "Update editorial corpus"} (${session.user.login})`;

  if (mode === "direct") {
    const update = await putEditorialFile(
      branch,
      merged,
      currentFile.sha,
      commitMessage,
      token,
      env,
    );
    return json({
      message: "The published corpus was updated.",
      url: update.commit?.html_url,
    });
  }

  const branchName = `editorial/${session.user.login
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")}-${Date.now()}`;
  const baseRef = await github(
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/ref/heads/${encodeURIComponent(branch)}`,
    { token },
  );
  await github(
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/refs`,
    {
      method: "POST",
      token,
      body: {
        ref: `refs/heads/${branchName}`,
        sha: baseRef.object.sha,
      },
    },
  );
  await putEditorialFile(
    branchName,
    merged,
    currentFile.sha,
    commitMessage,
    token,
    env,
  );
  const pullRequest = await github(
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/pulls`,
    {
      method: "POST",
      token,
      body: {
        title: `Editorial revisions by ${session.user.login}`,
        head: branchName,
        base: branch,
        body:
          `Submitted from the Viṃśikā scholarly shell by @${session.user.login}.\n\n` +
          `${editorialChangeCount(editorial)} editorial object(s) included.`,
      },
    },
  );
  return json({
    message: "A review request was created.",
    url: pullRequest.html_url,
  });
}

async function getEditorialFile(branch, token, env) {
  try {
    const file = await github(
      `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${env.GITHUB_EDITORIAL_PATH}?ref=${encodeURIComponent(branch)}`,
      { token },
    );
    return {
      sha: file.sha,
      data: JSON.parse(decodeBase64(file.content)),
    };
  } catch (error) {
    if (error.status !== 404) throw error;
    return {
      sha: undefined,
      data: {
        units: [],
        alignments: [],
        sentenceEdits: [],
        sectionEdits: [],
        lexiconEntries: [],
        syntaxAnnotations: [],
        textEdits: {},
      },
    };
  }
}

async function putEditorialFile(
  branch,
  editorial,
  sha,
  message,
  token,
  env,
) {
  return github(
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${env.GITHUB_EDITORIAL_PATH}`,
    {
      method: "PUT",
      token,
      body: {
        message,
        content: encodeBase64(`${JSON.stringify(editorial, null, 2)}\n`),
        branch,
        ...(sha ? { sha } : {}),
      },
    },
  );
}

async function github(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "vimsika-collaboration",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = httpError(
      response.status,
      payload.message || "GitHub rejected the request.",
    );
    throw error;
  }
  return payload;
}

async function githubInstallationToken(env) {
  const jwt = await githubAppJwt(env);
  const response = await github(
    `/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,
    {
      method: "POST",
      token: jwt,
      body: {},
    },
  );
  return response.token;
}

async function githubAppJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 540,
      iss: env.GITHUB_APP_ID,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const binary = atob(env.GITHUB_PRIVATE_KEY_BASE64.replaceAll(/\s/g, ""));
  const keyBytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}
