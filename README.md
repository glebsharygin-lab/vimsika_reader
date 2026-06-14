# Viṃśikā collaboration service

This Cloudflare Worker provides the secure write layer that GitHub Pages cannot
provide by itself.

## Roles

- `reader`: public/read-only access.
- `contributor`: edit locally and submit a GitHub pull request.
- `editor`: contributor permissions plus direct publication.
- `admin`: editor permissions plus trusted-user management.

`ADMIN_GITHUB_LOGIN` is always the administrator and cannot be removed through
the interface.

## GitHub setup

1. Create a GitHub OAuth App.
   - Homepage: the published reader URL.
   - Callback: `https://YOUR-WORKER.workers.dev/auth/callback`
2. Create a GitHub App with repository permissions:
   - Contents: read and write.
   - Pull requests: read and write.
3. Install the GitHub App on `glebsharygin-lab/vimsika_reader`.
4. Download its private key and convert it to unencrypted PKCS#8 DER:

```powershell
openssl pkcs8 -topk8 -inform PEM -outform DER -in downloaded-key.pem -nocrypt -out github-app-key.der
[Convert]::ToBase64String([IO.File]::ReadAllBytes("github-app-key.der"))
```

## Cloudflare setup

```powershell
cd collaboration-worker
npm install
npx wrangler kv namespace create AUTH
```

Put the returned namespace ID in `wrangler.toml`, then add secrets:

```powershell
npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
npx wrangler secret put GITHUB_APP_ID
npx wrangler secret put GITHUB_INSTALLATION_ID
npx wrangler secret put GITHUB_PRIVATE_KEY_BASE64
npm run deploy
```

Finally, put the deployed Worker URL in the root `auth-config.js`:

```js
window.VIMSIKA_AUTH_CONFIG = {
  apiBaseUrl: "https://vimsika-collaboration.YOUR-SUBDOMAIN.workers.dev",
  administratorLogin: "glebsharygin-lab",
};
```
