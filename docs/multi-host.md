# Serving several hosts from one instance

One OpenArca instance can answer on several hostnames — for example an internal
desk and a public entry point, or one host per brand. This page covers the
configuration and the reverse proxy it expects.

## Configuration

```bash
ALLOWED_HOSTS=https://desk.example.com,https://pomoc.example.com
```

- Comma-separated origins. A bare hostname is read as `https://`.
- **The first entry is canonical.** It is what links fall back to when a request
  cannot be attributed to an allowed host.
- Only `http` and `https` are accepted; anything else is ignored.

Leaving `ALLOWED_HOSTS` unset keeps the previous behaviour exactly: `FRONTEND_ORIGIN`
(or `APP_URL`) becomes a one-entry allowlist, so an existing single-host install
needs no configuration change.

CORS allows every configured origin and nothing else.

## How a request is attributed to a host

An inbound `Host` or `X-Forwarded-Host` header may only **select** an entry from
the allowlist. It can never define one.

A host that is not on the list falls back to the canonical origin and is never
reflected back. This is not defensive decoration: absolute links in email are
built from the result, and OTP is the only way into the product, so a reflected
host would turn the login mail into an attacker-controlled redirect.

Only the first hop of a forwarded chain is considered — a proxy may append, and
later entries are attacker-controllable.

## Which host appears in email

| Mail | Host used | Why |
|---|---|---|
| OTP login code | the host the requester used | the requester **is** the recipient |
| Ticket notifications | canonical | triggered by one person, delivered to another; we do not record which host the recipient prefers, so the actor's host would be a guess about someone else |

## Reverse proxy

The application trusts the proxy for host and scheme, so the proxy must set both.

```nginx
server {
  listen 443 ssl;
  server_name desk.example.com pomoc.example.com;

  location / {
    proxy_pass http://127.0.0.1:3330;
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-Host  $host;
    proxy_set_header X-Forwarded-Proto $scheme;   # required
    proxy_set_header X-Real-IP         $remote_addr;
  }
}
```

### `X-Forwarded-Proto` is required

**Omitting it is the single most common way to break this.** Without it the
application cannot tell an HTTPS request from an HTTP one, so it resolves a bare
host against the allowlist by scheme and can settle on the wrong entry — or fall
back to canonical on a host that was perfectly valid. Links in email then point
at `http://`, or at the wrong brand.

This is a recurring failure, not a hypothetical one: existing vhosts in a sibling
deployment omitted this header and produced exactly that class of bug.

### Certificates

Every hostname in `ALLOWED_HOSTS` needs to be covered by the certificate served
for it — either one certificate with several names, or one per host. A host that
fails TLS never reaches the application at all, so it will not appear as an
application error; check the proxy first.

## Checking a deployment

The admin readiness view lists the resolved configuration. A quick check from the
shell:

```bash
curl -sI https://pomoc.example.com/health | head -1
curl -s -H 'Origin: https://pomoc.example.com' -I https://desk.example.com/health \
  | grep -i access-control-allow-origin
```

The second command should echo the requesting origin only when it is on the
allowlist. If an origin you did not configure comes back, the proxy is rewriting
headers in a way the application cannot see.
