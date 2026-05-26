import {createHash, randomBytes} from 'node:crypto';
import {createServer, type IncomingMessage, type Server, type ServerResponse} from 'node:http';
import {AddressInfo} from 'node:net';
import open from 'open';
import type {OAuthSession} from './config.js';

// OAuth defaults for the Bitmovin CLI. All values can be overridden via env
// vars (BITMOVIN_OAUTH_ISSUER, BITMOVIN_OAUTH_CLIENT_ID, etc.) to point at a
// non-default IdP — useful for testing.
const DEFAULT_ISSUER = 'https://goofy-wing-xkrz7yoids.projects.oryapis.com';
const DEFAULT_AUTHORIZE_PATH = '/oauth2/auth';
const DEFAULT_TOKEN_PATH = '/oauth2/token';
const DEFAULT_CLIENT_ID = 'f0c655e4-564f-486a-ad39-e07bc29d2032';
const DEFAULT_SCOPE = 'openid offline_access';
// Fixed loopback port — the OAuth client only accepts a literal pre-registered
// redirect URI, so we cannot pick an ephemeral port at runtime.
const DEFAULT_REDIRECT_PORT = 27315;

export interface OAuthEndpoints {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  scope: string;
  redirectPort: number;
}

export function resolveEndpoints(): OAuthEndpoints {
  const issuer = process.env.BITMOVIN_OAUTH_ISSUER ?? DEFAULT_ISSUER;
  const authorizeUrl = process.env.BITMOVIN_OAUTH_AUTHORIZE_URL ?? issuer.replace(/\/$/, '') + DEFAULT_AUTHORIZE_PATH;
  const tokenUrl = process.env.BITMOVIN_OAUTH_TOKEN_URL ?? issuer.replace(/\/$/, '') + DEFAULT_TOKEN_PATH;
  const clientId = process.env.BITMOVIN_OAUTH_CLIENT_ID ?? DEFAULT_CLIENT_ID;
  const scope = process.env.BITMOVIN_OAUTH_SCOPE ?? DEFAULT_SCOPE;
  const redirectPort = parseRedirectPort(process.env.BITMOVIN_OAUTH_REDIRECT_PORT) ?? DEFAULT_REDIRECT_PORT;
  return {authorizeUrl, tokenUrl, clientId, scope, redirectPort};
}

function parseRedirectPort(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    throw new Error(`BITMOVIN_OAUTH_REDIRECT_PORT must be a TCP port (1-65535), got "${value}"`);
  }

  return n;
}

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function generatePkcePair(): {verifier: string; challenge: string} {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  return {verifier, challenge};
}

function openInBrowser(url: string): void {
  // Best-effort: the URL is also printed for the user to copy. Use the `open`
  // package because it handles per-platform quirks (Windows `&` quoting, WSL,
  // xdg-open vs gnome-open on Linux) that ad-hoc spawns get wrong.
  open(url).catch(() => {
    // Swallow — printing the URL is the user-visible fallback.
  });
}

interface CallbackResult {
  code: string;
  state: string;
}

function startLoopbackServer(expectedState: string, port: number): Promise<{port: number; result: Promise<CallbackResult>; close: () => void}> {
  return new Promise((resolveStart, rejectStart) => {
    let resolveResult!: (value: CallbackResult) => void;
    let rejectResult!: (reason: Error) => void;
    const result = new Promise<CallbackResult>((res, rej) => {
      resolveResult = res;
      rejectResult = rej;
    });

    const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (!req.url) {
        res.writeHead(400).end('Bad request');
        return;
      }

      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== '/callback') {
        res.writeHead(404).end('Not found');
        return;
      }

      const error = url.searchParams.get('error');
      if (error) {
        const description = url.searchParams.get('error_description') ?? '';
        res.writeHead(400, {'Content-Type': 'text/html'}).end(
          renderPage('Login failed', `Authorization failed: ${error}. ${description}`),
        );
        rejectResult(new Error(`Authorization failed: ${error}${description ? ' — ' + description : ''}`));
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) {
        res.writeHead(400, {'Content-Type': 'text/html'}).end(renderPage('Login failed', 'Missing code or state in callback.'));
        rejectResult(new Error('Missing code or state in OAuth callback'));
        return;
      }

      if (state !== expectedState) {
        res.writeHead(400, {'Content-Type': 'text/html'}).end(renderPage('Login failed', 'State parameter mismatch.'));
        rejectResult(new Error('OAuth state mismatch — possible CSRF, aborting'));
        return;
      }

      res.writeHead(200, {'Content-Type': 'text/html'}).end(
        renderPage('Login complete', 'You can close this tab and return to your terminal.'),
      );
      resolveResult({code, state});
    });

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        rejectStart(new Error(
          `Loopback port ${port} is already in use, can't complete OAuth login.\n` +
          '  Free the port (likely another process or a previous "bitmovin login") or set\n' +
          '  BITMOVIN_OAUTH_REDIRECT_PORT to a port that is registered on the OAuth client.',
        ));
      } else {
        rejectStart(err);
      }
    });

    server.listen(port, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolveStart({
        port: addr.port,
        result,
        close: () => server.close(),
      });
    });
  });
}

// Body is escaped here so callers can't accidentally render unescaped user
// input. Pass the raw string in — `renderPage` HTML-escapes it.
function renderPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    `<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#111}` +
    `h1{font-size:1.25rem;margin-bottom:.5rem}p{color:#555;line-height:1.5}</style>` +
    `</head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
}

export interface LoginOptions {
  /** Called after the authorize URL is built, before the browser opens. Lets callers print the URL. */
  onAuthorizeUrl?: (url: string) => void;
  /** Optional override for the redirect host (default 127.0.0.1). */
  redirectHost?: string;
  /** When true, skip spawning a browser process — caller is responsible for visiting the URL. */
  noOpenBrowser?: boolean;
  /** Max time (ms) to wait for the OAuth callback before aborting. Defaults to 5 min. */
  timeoutMs?: number;
}

const DEFAULT_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export async function runLoginFlow(options: LoginOptions = {}): Promise<OAuthSession> {
  const endpoints = resolveEndpoints();
  const {verifier, challenge} = generatePkcePair();
  const state = base64Url(randomBytes(16));

  const {port, result, close} = await startLoopbackServer(state, endpoints.redirectPort);
  const redirectUri = `http://${options.redirectHost ?? '127.0.0.1'}:${port}/callback`;

  const authorizeUrl = new URL(endpoints.authorizeUrl);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', endpoints.clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', endpoints.scope);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  options.onAuthorizeUrl?.(authorizeUrl.toString());
  if (!options.noOpenBrowser) openInBrowser(authorizeUrl.toString());

  // Tear the loopback server down on Ctrl+C so the fixed port isn't left
  // bound after the process exits.
  const onSigint = () => {
    close();
    process.exit(130);
  };

  process.once('SIGINT', onSigint);

  const timeoutMs = options.timeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(
        `Login timed out after ${Math.round(timeoutMs / 1000)}s. ` +
        'Did you complete the browser authorization step? Re-run `bitmovin login`.',
      ));
    }, timeoutMs);
    // Don't keep the event loop alive solely on this timer.
    timer.unref?.();
  });

  try {
    const {code} = (await Promise.race([result, timeout])) as CallbackResult;
    return await exchangeCodeForToken({
      code,
      verifier,
      redirectUri,
      endpoints,
    });
  } finally {
    if (timer) clearTimeout(timer);
    process.removeListener('SIGINT', onSigint);
    close();
  }
}

interface TokenExchangeArgs {
  code: string;
  verifier: string;
  redirectUri: string;
  endpoints: OAuthEndpoints;
}

interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

async function exchangeCodeForToken(args: TokenExchangeArgs): Promise<OAuthSession> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: args.redirectUri,
    client_id: args.endpoints.clientId,
    code_verifier: args.verifier,
  });

  const response = await fetch(args.endpoints.tokenUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (HTTP ${response.status}): ${text}`);
  }

  const json = await response.json() as TokenResponse;
  return tokenResponseToSession(json);
}

export async function refreshAccessToken(refreshToken: string): Promise<OAuthSession> {
  const endpoints = resolveEndpoints();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: endpoints.clientId,
  });

  const response = await fetch(endpoints.tokenUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (HTTP ${response.status}): ${text}`);
  }

  const json = await response.json() as TokenResponse;
  const session = tokenResponseToSession(json);
  // Some IdPs omit a new refresh token on refresh — keep the previous one.
  if (!session.refreshToken) session.refreshToken = refreshToken;
  return session;
}

function tokenResponseToSession(json: TokenResponse): OAuthSession {
  // The CLI sends Authorization: Bearer unconditionally. Reject anything else
  // up front so a misconfigured IdP (e.g. DPoP) fails with a clear error
  // instead of looping on 401s.
  if (json.token_type && json.token_type.toLowerCase() !== 'bearer') {
    throw new Error(
      `Unsupported OAuth token_type "${json.token_type}". The Bitmovin CLI only supports Bearer tokens.`,
    );
  }

  const expiresAt = typeof json.expires_in === 'number' ? Date.now() + json.expires_in * 1000 : undefined;
  const user = decodeIdTokenClaims(json.id_token);
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt,
    tokenType: json.token_type,
    scope: json.scope,
    ...(user && {user}),
  };
}

// Display-only — the email/sub from the ID token is shown in `config show`
// but never used for any auth decision. The JWT signature is intentionally
// NOT verified here; don't gate behavior on these claims.
function decodeIdTokenClaims(idToken?: string): {email?: string; sub?: string} | undefined {
  if (!idToken) return undefined;
  const parts = idToken.split('.');
  if (parts.length !== 3) return undefined;
  try {
    const payload = Buffer.from(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    const claims = JSON.parse(payload) as {email?: string; sub?: string};
    const result: {email?: string; sub?: string} = {};
    if (typeof claims.email === 'string') result.email = claims.email;
    if (typeof claims.sub === 'string') result.sub = claims.sub;
    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

export function isExpired(session: OAuthSession, skewMs = 30_000): boolean {
  if (typeof session.expiresAt !== 'number') return false;
  return Date.now() + skewMs >= session.expiresAt;
}
