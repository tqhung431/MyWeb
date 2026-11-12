# Stage 20 — Going out: using Nook away from home, safely

**Goal:** open Nook from anywhere (4G, work, a friend's place), without opening it to the whole internet.

**Short answer:**

1. Keep Nook on your home PC, as it is now.
2. For your own family's phones and laptops, use **Tailscale** (section 2): a private network only your devices are in.
   Nothing is opened on your router.
3. For people who won't install an app, add a **Cloudflare Tunnel with Cloudflare Access** (section 3): a normal web
   address, but Cloudflare asks for an email code first, and Nook checks Cloudflare's signed pass on every request.
4. **Never forward ports** on your router (section 4), and check the firewall rules (section 5).

## 1. Why not just open a port?

Nook's sign-in is just a **name, no password** (Stage 11). That's fine at home: only people on your Wi-Fi can reach it.
On the open internet, anyone who found the address could pick a name, upload songs, post in Hobby Hub, use your PC's
AI, and fill your disk. Bots scan every home IP address for open ports within minutes.

So the rule is: **something that checks who you are must stand in front of Nook**, before any request reaches it.

| Way | Who checks | Open router port? | Needs | Good for |
| --- | --- | --- | --- | --- |
| **Tailscale** (recommended) | Your Tailscale login (Google, Microsoft, GitHub, Apple…) on each device | No | The Tailscale app on each device | Family, your own devices |
| **Cloudflare Tunnel + Access** | Cloudflare emails a one-time code to addresses you listed; Nook checks the signed pass | No | A domain name on Cloudflare (~10 USD a year) | Friends who won't install an app |
| Port forwarding + HTTPS | Nobody (Nook has no passwords) | **Yes** | — | ❌ Don't |

Both good ways only make *outgoing* connections from your PC, so they work even when your internet provider doesn't
give you a public IP address (common with 4G/5G home internet, "CGNAT").

## 2. Tailscale: a private network for your devices

[Tailscale](https://tailscale.com) connects your devices with WireGuard, an encrypted VPN, wherever they are.
Only devices signed in to your Tailscale network ("tailnet") can reach each other. The free Personal plan
allows 6 people with any number of devices (non-commercial use; check their pricing page for changes).

**On the Nook PC**

1. Install Tailscale from https://tailscale.com/download and sign in.
2. In the admin console (https://login.tailscale.com/admin/dns): turn on **MagicDNS** and **HTTPS certificates**.
3. In a terminal (on Windows: PowerShell):

   ```bash
   tailscale serve --bg 80
   ```

   It prints Nook's private address, like **https://nook-pc.tail1234.ts.net**, with a real HTTPS certificate.
   Tailscale passes those requests to Caddy on this PC. `--bg` keeps it on after restarts; `tailscale serve reset`
   turns it off.

**On each phone or laptop**

4. Install the Tailscale app and sign in. Family members: invite them from the admin console (Users → Invite), so each
   person has their own login. Then open the address from step 3. Add it to the home screen: Nook works like an app.

**Optional: only Nook, nothing else on the PC.** By default, devices in your tailnet can reach every port of each
other. In the admin console → Access controls, this policy lets everyone reach only Nook (port 443) on the Nook PC,
while you (the admin) keep full access. Replace the IP with your PC's Tailscale IP (shown in the Machines list):

```json
{
  "hosts": { "nook-pc": "100.101.102.103" },
  "grants": [
    { "src": ["autogroup:admin"], "dst": ["*"], "ip": ["*"] },
    { "src": ["autogroup:member"], "dst": ["nook-pc"], "ip": ["443"] }
  ]
}
```

**Optional: not even the home Wi-Fi.** Put `BIND_IP=127.0.0.1` in `.env` and run `docker compose up -d`. Then
Nook answers only on the PC itself and through `tailscale serve`, so a guest on your Wi-Fi can't open it.

**Friends** can get Nook too: Machines → the Nook PC → Share. They sign in with their own Tailscale account and see
only that one machine (and with the policy above, only Nook on it).

## 3. Cloudflare Tunnel with Cloudflare Access: a public address with a gate

For people who won't install an app. You need a domain name managed by Cloudflare (for example `example.com`;
Nook will be at `nook.example.com`). Cloudflare Zero Trust has a free plan.

How it works:

```
phone ──https──▶ Cloudflare ──(Access: email code? signed pass)──▶ tunnel ──▶ cloudflared (your PC, profile "tunnel")
                                                                             └─▶ Caddy :8080 ──(asks the API: is the pass valid?)──▶ Nook
```

`cloudflared` runs in Docker next to Nook and connects **out** to Cloudflare. It reaches Caddy on a separate
entrance, `:8080`, that isn't published on your PC or network. Before anything else, that entrance asks the API
(`GET /internal/access-check`) to check the **Cf-Access-Jwt-Assertion** header: a pass (JWT) that Cloudflare Access
signs after someone enters their email code. The API checks the signature with your team's public keys, the
application (AUD tag), and the expiry date. No valid pass → a short "Nook is private" page. If Access isn't set up
yet, or someone switches it off by mistake, **nobody gets in** ("fail closed"). Typing a fake header doesn't help:
it has no valid signature.

**Steps** (Cloudflare dashboard → Zero Trust):

1. **Settings → Authentication**: keep **One-time PIN** (Cloudflare emails a code; no passwords to manage).
2. **Access → Applications → Add an application → Self-hosted**: domain `nook.example.com`, session 1 week or a month.
   Policy: **Allow**, Include → **Emails**: list each person's email. Save, then copy the **Application Audience
   (AUD) Tag**. Your team domain is under Settings → Custom pages, e.g. `https://nookfamily.cloudflareaccess.com`.
3. **Networks → Tunnels → Create a tunnel → Cloudflared**: name it "nook" and copy the **token** from the install
   command (the long text after `--token`). Don't run their install command: Nook's Docker setup runs cloudflared.
4. In the tunnel, **Public hostname**: `nook.example.com` → service **HTTP**, URL **caddy:8080**.
5. In `.env`:

   ```bash
   COMPOSE_PROFILES=app,tunnel
   TUNNEL_TOKEN=eyJ...                                         # secret, like a password
   CF_ACCESS_TEAM_DOMAIN=https://nookfamily.cloudflareaccess.com
   CF_ACCESS_AUD=4714c1358e65fe4b408ad6d432a5f878f08194bdb4752441fd56faefa9b2b6f2
   ```

   then `docker compose up -d`.
6. Test in a private window: `https://nook.example.com` must show **Cloudflare's sign-in page** first. After the email
   code, Nook opens.

Good to know:

- Cloudflare's free plan accepts uploads up to **100 MB** per request, so songs bigger than that can't be added through
  the tunnel (they still can at home). `MAX_UPLOAD_MB` is 100 by default.
- HTTPS ends at Cloudflare, so Cloudflare could see the traffic (Tailscale is end-to-end encrypted).
- Visitors through the tunnel are counted by their real IP for Nook's rate limits: Caddy trusts the IP that
  cloudflared reports, on that entrance only.

### On a cloud server instead (optional)

Not the default. Running Nook on a cloud VM (Google Cloud, …) with nginx in front: [deploy-gcp.md](deploy-gcp.md). nginx asks for a
password and handles HTTPS; Nook listens only on the VM itself (`BIND_IP=127.0.0.1`) and takes nginx's requests on
`127.0.0.1:8081`, a Caddy entrance that trusts the visitor IP and "https" nginx passes on. That entrance is only
opened with `COMPOSE_FILE=docker-compose.yml:deploy/nginx/compose.proxy.yml`.

## 4. Your router

- **No port forwarding.** In the router's settings (often http://192.168.1.1) → Port forwarding / Virtual server /
  NAT: there should be **no rule** pointing at the Nook PC. Neither Tailscale nor the tunnel needs one.
- **Turn off UPnP** (often under Advanced or NAT). UPnP lets programs open router ports by themselves.
- Keep the router's firmware updated and change its admin password from the default.

## 5. Firewall rules on the Nook PC

What Nook opens, and to whom:

| Port | What | Who can reach it |
| --- | --- | --- |
| 80, 443 | Caddy (Nook) | Your network (`BIND_IP=0.0.0.0`, default), or this PC only (`BIND_IP=127.0.0.1`) |
| 5432, 6379 | PostgreSQL, Valkey | This PC only (`127.0.0.1`), already |
| 3001, 11434 | Grafana, Ollama | This PC only, already |
| 4000, 3000, 8080 | API, website, tunnel entrance | Docker's private network only (not published) |

**Windows** (Docker Desktop):

1. Settings → Network & internet → your Wi-Fi → set the home network to **Private**. Public Wi-Fi (cafés) stays **Public**.
2. Windows Security → Firewall → *Allow an app through firewall*: for **Docker Desktop Backend**, tick **Private**
   only, untick **Public**. Otherwise a laptop running Nook on café Wi-Fi shows Nook to the whole café.
3. Optional, stricter (PowerShell as administrator): allow ports 80/443 only from your own network:

   ```powershell
   New-NetFirewallRule -DisplayName "Nook (home network only)" -Direction Inbound -Action Allow `
     -Protocol TCP -LocalPort 80,443 -RemoteAddress LocalSubnet -Profile Private
   ```

**Linux**: Docker writes its own firewall rules, and **ufw does not protect ports that Docker publishes**. Use
`BIND_IP` instead: `127.0.0.1` (this PC + Tailscale serve), or the PC's home-network address (e.g. `192.168.1.20`,
reserve it in the router so it doesn't change). ufw still protects everything else (`sudo ufw default deny incoming`,
`sudo ufw allow from 192.168.1.0/24 to any port 22` if you use SSH).

**macOS**: System Settings → Network → Firewall on. Docker Desktop's ports follow `BIND_IP` the same way.

## 6. Running it for real

- **Always on**: Docker Desktop → Settings → General → *Start Docker Desktop when you sign in*. Nook's containers
  restart by themselves (`restart: unless-stopped`). Set the PC never to sleep while plugged in.
- **Database password**: `start.cmd` / `start.sh` now give a brand-new install a random `POSTGRES_PASSWORD`
  (only if there's no database yet). If yours is still `nook`, it's only reachable from the PC itself, but
  `.env` is now worth keeping private anyway: it holds your tunnel token.
- **Updates**: `git pull`, then `start.cmd` / `./start.sh` (rebuilds and restarts; data stays).
- **Backups** (the database, then the songs):

  ```bash
  docker compose exec -T db pg_dump -U nook nook > nook-backup.sql
  docker run --rm -v nook_media-data:/media -v "$PWD":/backup alpine tar czf /backup/nook-media.tgz -C /media .
  ```

## 7. What changed in the code

| Where | What |
| --- | --- |
| `docker-compose.yml` | `cloudflared` service (profile `tunnel`); `BIND_IP` for Caddy's ports; the API trusts private-network proxies (real visitor IPs through the tunnel) |
| `Caddyfile` | The tunnel entrance `:8080` with `forward_auth` to the API, HSTS; `X-Frame-Options: DENY` and a `Permissions-Policy` everywhere |
| `api/src/access/cloudflare.ts`, `routes/access.ts` | Checks Cloudflare Access passes (signature, issuer, AUD, expiry) with `jose` (MIT) |
| `api/tests/access*.test.ts` | A fake Cloudflare team signs passes: valid ones get in; none, fake, wrong keys, wrong app, wrong team or expired don't; nothing gets in without settings |
| `start.cmd`, `start.sh` | A random database password on a brand-new install |
| `.env.example` | `BIND_IP`, `TUNNEL_TOKEN`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` |

## What wasn't tested

- Real Tailscale and Cloudflare accounts can't be used from the sandbox. The Cloudflare check was tested with a fake
  Cloudflare team (its own signing keys), and the Caddy configuration with a real Caddy binary and requests shaped
  like cloudflared's. Do the "private window" test in step 6 after setting it up.
- `start.cmd`'s random password (PowerShell) couldn't be run here (no Windows); `start.sh`'s was.
