# Nook on a Google Cloud server, behind nginx (optional)

**Not the default.** Nook is made to run on a PC at home (README). This guide is an optional extra: how to put
Nook on a Google Cloud (Compute Engine) Ubuntu machine and reach it from anywhere, safely. Nothing here is switched
on unless you follow it.

```
phone ──HTTPS──▶ Google Cloud firewall (only 80, 443, and SSH from Google) ──▶ nginx (certificate + password)
                                                                                └─▶ 127.0.0.1:8081 Caddy ──▶ Nook
```

**Read this first.** Nook has no passwords: people just pick a name. On a public server, anyone who finds the address
could use it, upload songs, post, and fill your disk. So **nginx asks for a password before anything reaches Nook**,
and everything else on the server stays closed. (If only your family uses it, Tailscale is an even safer alternative:
no public address at all. See [stage-20.md](stage-20.md), section 2. It works on a cloud server too.)

You need:

- The VM (Ubuntu) with Docker installed and Nook cloned (you have this).
- A **domain name** for the HTTPS certificate, e.g. `nook.example.com` (any registrar; a free DuckDNS subdomain works too).
- About 2 GB of memory or more (e2-small works without the AI; `e2-medium` builds faster). On 2 GB, add swap (step 3.1).

## 1. Google Cloud console

**1.1 A fixed address.** VPC network → **IP addresses** → find your VM's external address → **Promote to static
address**. Otherwise it can change when the VM restarts. (Google charges a little for external addresses.)

**1.2 Open only the web ports.** Compute Engine → VM instances → your VM → **Edit** → Networking → tick **Allow HTTP
traffic** and **Allow HTTPS traffic** → Save. This adds the firewall rules `default-allow-http` (port 80) and
`default-allow-https` (443) for this VM.

**1.3 Close everything else.** VPC network → **Firewall**. On the default network you'll see:

| Rule | Keep? |
| --- | --- |
| `default-allow-http`, `default-allow-https` | Yes (nginx) |
| `default-allow-ssh` (port 22 from `0.0.0.0/0`, the whole internet) | Narrow it: edit **Source IPv4 ranges** to `35.235.240.0/20` (Google's Identity-Aware Proxy). Then connect with the console's **SSH** button or `gcloud compute ssh <vm> --tunnel-through-iap`. Keep one SSH window open while you test that a new one still connects. |
| `default-allow-rdp` (3389) | Delete (that's for Windows) |
| `default-allow-icmp`, `default-allow-internal` | Fine |

Never add rules for 8080, 8081, 8443, 5432 (database), 6379 (Valkey), 3001 (Grafana) or 11434 (Ollama). Nook doesn't
need them open, and with the settings below they only listen on the VM itself anyway.

**1.4 Point your domain at it.** At your domain's DNS: an **A record** `nook.example.com` → the static IP from 1.1.

## 2. Nook's settings on the VM

Use the `stage-20` branch (or main once Stage 20 is merged): it has the settings below.
The nginx entrance is off by default; the `COMPOSE_FILE` line below switches it on.

```bash
cd ~/Nook && git pull
nano .env          # or copy .env.example to .env first
```

Set:

```bash
COMPOSE_PROFILES=app
BIND_IP=127.0.0.1      # Nook listens on the VM itself only; nginx is the only way in
HTTP_PORT=8080         # move Caddy off 80/443: nginx uses those
HTTPS_PORT=8443
COMPOSE_FILE=docker-compose.yml:deploy/nginx/compose.proxy.yml   # opens the entrance for nginx (127.0.0.1 only)
# PROXY_PORT=8081      # where nginx talks to Nook (default)
POSTGRES_PASSWORD=...  # a long random one if this is a new install (start.sh makes one for you)
```

Then start (or restart) Nook and check it answers on the VM:

```bash
./start.sh                                   # or: docker compose up -d --build
curl -s http://127.0.0.1:8081/ | head -c 80  # some HTML = good
```

## 3. nginx, the password and HTTPS

**3.1 (2 GB machines) swap**, so the first build doesn't run out of memory:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**3.2 Install** nginx, the password tool and Let's Encrypt's certbot:

```bash
sudo apt update && sudo apt install -y nginx apache2-utils certbot python3-certbot-nginx
```

**3.3 One login per person** (it asks for each password twice):

```bash
sudo htpasswd -c /etc/nginx/nook.htpasswd linh     # -c only for the first one: it creates the file
sudo htpasswd /etc/nginx/nook.htpasswd mai
sudo htpasswd -D /etc/nginx/nook.htpasswd mai      # remove someone later
```

**3.4 Nook's nginx config** (from this repository), with your domain:

```bash
sudo cp ~/Nook/deploy/nginx/nook.conf /etc/nginx/sites-available/nook
sudo sed -i 's/nook.example.com/YOUR.DOMAIN/' /etc/nginx/sites-available/nook
sudo ln -s /etc/nginx/sites-available/nook /etc/nginx/sites-enabled/nook
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

What it does: asks for the password; passes pages, the API, live updates (WebSockets) and uploads up to 110 MB to
Nook on `127.0.0.1:8081`; tells Nook the visitor's real IP and that they used HTTPS (Nook trusts this only from the VM
itself); hides nginx's version.

**3.5 HTTPS** (free certificate, renews by itself):

```bash
sudo certbot --nginx -d YOUR.DOMAIN --redirect
```

It asks for an email (for expiry warnings) and changes the nginx config to use HTTPS and send http:// to https://.
Check renewal works: `sudo certbot renew --dry-run`.

**3.6 Try it** from your phone on 4G (not your Wi-Fi): `https://YOUR.DOMAIN` → the browser asks for the user name and
password → Nook. Also check these **don't** answer: `http://<the IP>:8081`, `http://<the IP>:8080`.

## 4. Optional: the VM's own firewall (ufw)

Google's firewall (section 1) is the main guard, and with `BIND_IP=127.0.0.1` Docker only listens on the VM itself.
A second layer on the VM:

```bash
sudo ufw allow OpenSSH          # FIRST, or you lock yourself out
sudo ufw allow 'Nginx Full'     # 80 and 443
sudo ufw enable
sudo ufw status
```

Note: ufw doesn't control ports that Docker publishes; that's why `BIND_IP=127.0.0.1` matters.

## 5. Running it

- **Updates**: `cd ~/Nook && git pull && ./start.sh`.
- **Backups**: Compute Engine → **Snapshots** → *Create snapshot schedule* (e.g. daily, keep 7) and attach it to the VM's
  disk. That copies everything, including the database and songs. Or by hand:
  `docker compose exec -T db pg_dump -U nook nook > nook-backup.sql`.
- **Logs**: `docker compose logs -f api`, `sudo tail -f /var/log/nginx/error.log`.
- **AI (Companion)**: needs about 4 GB of extra memory for the default model; on a small VM leave the `ai` profile off.
- **Costs**: the VM, its disk, the static IP and outgoing traffic (music streaming) are billed by Google. Check
  Billing → Budgets & alerts and set a budget alert.

## What happens with each request

1. Google's firewall lets in only ports 80 and 443 (and SSH from Google's IAP range).
2. nginx answers on 443 with your certificate, and asks for the password. Wrong or none: 401, nothing reaches Nook.
3. nginx passes the request to `127.0.0.1:8081` with `X-Forwarded-For` (the visitor's IP, overwriting anything the
   visitor sent) and `X-Forwarded-Proto: https`.
4. Caddy's `:8081` entrance trusts those two headers because they come from the VM itself, adds Nook's security
   headers, and passes the request to the website or the API.
5. Nook then works as at home: pick a name, and everything else is the same.

## Tested in the sandbox

nginx with this config, Caddy and the API, with requests like a browser's:

- no password or a wrong one → 401; with the password → pages and the API work;
- the visitor's IP reaches Nook, and a visitor can't fake it;
- `https` reaches Nook (the login cookie is marked Secure);
- a 50 MB upload gets through;
- live updates connect over a WebSocket through nginx with the password.

**Not tested here:** Google Cloud itself (console, firewall, static IP), DNS and certbot, which need a real server and
domain.

## If Nook Arena says it can't reach the game server

The game server is a separate service (`arena`) that came with Stage 22. On a server that was set up earlier:

```bash
git pull
docker compose up -d --build        # builds and starts the new "arena" service too
docker compose ps arena             # should say: running (healthy)
docker compose logs arena           # if not: why it stopped
```

Then check the whole way from outside (replace the address with yours):

```bash
curl "https://nook.example.com/api/arena?EIO=4&transport=polling"
# good: 0{"sid":"…","upgrades":["websocket"],…}
```

- **Cloudflare tunnel or Cloudflare Access:** nothing extra; `/api/arena` goes through Caddy like the rest of `/api`.
  Behind Cloudflare Access, open Nook once in the browser first, so it has the Access pass. A `curl` without it gets the
  "Nook is private" page (that's correct).
- **Cloudflare proxy (orange cloud) or nginx:** WebSockets must be allowed (Cloudflare: Network → WebSockets on;
  `deploy/nginx/nook.conf` already passes them). Without WebSockets the games still work, a little slower.
- **A custom tunnel or proxy that sends only some paths to Nook:** send everything (`/`) to Caddy, or at least add
  `/api/arena`.
