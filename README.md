# Automated-VPS-deployment-pipeline

Automated CI/CD pipeline that deploys a Node.js REST API to a production VPS on every push to `main`. Zero manual steps — push code, pipeline runs, live URL updates.

**Live:** https://api.nagar.fun  
**Health check:** https://api.nagar.fun/health

---

## What this project demonstrates

- Multi-stage Docker builds producing minimal, non-root production images
- GitHub Actions pipeline: test → build → push to Docker Hub → SSH deploy → health check
- Automatic rollback if health check fails post-deploy
- Apache reverse proxy with SSL termination via Cloudflare Origin Certificate
- Cloudflare Full (Strict) mode — end-to-end encrypted with origin validation
- UFW firewall locked to Cloudflare IP ranges only — direct VPS access blocked
- Security headers: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Rate limiting: 10 req/s per IP with burst tolerance of 20

---

## Architecture

```
Browser
  │
  │  TLS (Cloudflare cert)
  ▼
Cloudflare Edge  ←── DNS proxy, DDoS protection, WAF
  │
  │  TLS (Cloudflare Origin Cert — Full Strict)
  ▼
Apache :443  ←── reverse proxy, SSL termination, rate limiting, security headers
  │
  │  HTTP (localhost only)
  ▼
Node.js :3000  ←── application server
```

**Deploy pipeline:**

```
git push main
     │
     ▼
GitHub Actions
     ├── test       (Jest + Supertest)
     ├── build      (Docker multi-stage → Docker Hub)
     └── deploy     (SSH → pull image → run container → health check)
                                                              │
                                              pass ──────────┘
                                              fail ──── rollback to previous image
```

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (Alpine) |
| Framework | Express |
| Container | Docker (multi-stage build) |
| Registry | Docker Hub |
| CI/CD | GitHub Actions |
| Web server | Apache 2 |
| SSL | Cloudflare Origin Certificate (Full Strict) |
| DNS / Proxy | Cloudflare |
| Firewall | UFW |
| Server OS | Ubuntu 22.04 |
| Hosting | Hetzner VPS |

---

## Project structure

```
.
├── app.js                        # Express app (exported for testing)
├── app.test.js                   # Jest + Supertest tests
├── Dockerfile                    # Multi-stage production build
├── .dockerignore
├── package.json
├── .github/
│   └── workflows/
│       └── deploy.yml            # Full CI/CD pipeline
└── RUNBOOK.md                    # Operational runbook
```

---

## Run locally

**Prerequisites:** Node.js 20+, npm

```bash
git clone https://github.com/joue-zero/Automated-VPS-deployment-pipeline
cd Automated-VPS-deployment-pipeline
npm install
npm test        # run tests
npm start       # start server on :3000
```

```bash
curl http://localhost:3000/
# {"status":"ok","version":"1.0.0"}

curl http://localhost:3000/health
# {"healthy":true}
```

---

## Run with Docker

```bash
docker build -t Automated-VPS-deployment-pipeline .
docker run -p 3000:3000 Automated-VPS-deployment-pipeline
```

The container:
- Runs as a non-root user (`appuser`)
- Exposes port 3000
- Has a built-in `HEALTHCHECK` that polls `/health` every 30 seconds

---

## CI/CD pipeline

The pipeline lives in `.github/workflows/deploy.yml` and has three jobs that run in sequence:

**1. test** — installs dependencies, runs Jest suite. Pipeline fails here if any test fails. Nothing gets built or deployed with a broken test suite.

**2. build-and-push** — builds the Docker image using a multi-stage Dockerfile, tags it with the Git SHA and `latest`, pushes to Docker Hub.

**3. deploy** — SSHs into the VPS as a non-root `deployer` user, pulls the new image, stops the old container, starts the new one, waits 10 seconds, then hits `/health`. If the health check fails, a rollback step fires automatically and restarts the previous image.

**Secrets required** (GitHub repo → Settings → Secrets → Actions):

| Secret | Description |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `VPS_HOST` | VPS IP address |
| `VPS_SSH_KEY` | Private SSH key for `deployer` user |

---

## Server setup

The VPS runs Ubuntu 22.04 on Hetzner. Key configuration decisions:

**Non-root deploy user** — GitHub Actions SSHs in as `deployer`, not `root`. The `deployer` user has Docker group membership but no sudo access. Blast radius of a compromised deploy key is limited.

**Cloudflare Full Strict SSL** — two separate TLS connections exist: browser ↔ Cloudflare (Cloudflare's own cert) and Cloudflare ↔ VPS (Cloudflare Origin Certificate). The origin cert is validated on every request. Traffic between Apache and Node.js is localhost-only HTTP — no encryption needed on the loopback interface.

**UFW firewall** — port 22 open for SSH. Ports 80 and 443 open only to Cloudflare IP ranges. Direct access to the server IP on port 80/443 is blocked — all web traffic must enter through Cloudflare.

**Apache rate limiting** — `mod_ratelimit` limits each IP to 10 requests/second with a burst of 20. Returns `429 Too Many Requests` when exceeded. The `/health` endpoint is excluded from rate limiting.

---

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Returns app status and current version |
| GET | `/health` | Health check — used by pipeline and monitoring |

**GET /**
```json
{
  "status": "ok",
  "version": "abc1234"
}
```

**GET /health**
```json
{
  "healthy": true
}
```

---

## Dockerfile decisions

The image uses a two-stage build:

**Stage 1 (deps)** — installs only production dependencies (`npm ci --only=production`) in an isolated layer. Dev dependencies never make it into the final image.

**Stage 2 (runner)** — copies only `node_modules` and `app.js` from stage 1. Creates a non-root user. Final image is ~60MB versus ~400MB for a naive single-stage build.

The `HEALTHCHECK` instruction means `docker ps` shows container health status, and Docker will mark the container unhealthy if `/health` stops responding — giving the host OS visibility into application health, not just process health.

---

## Security decisions

| Decision | Reason |
|---|---|
| Non-root container user | Process running as root inside Docker is a container escape risk |
| Multi-stage build | Dev dependencies (Jest, Supertest) never enter production image |
| Cloudflare Full Strict | Validates origin cert — prevents CF connecting to a spoofed server |
| UFW IP allowlist | Bypassing Cloudflare to hit VPS directly exposes the server to unfiltered traffic |
| No credentials in code | All secrets via GitHub Actions secrets and environment variables |
| HSTS header | Forces browsers to always use HTTPS — prevents SSL stripping attacks |

---

## What I'd add next

- [ ] Prometheus metrics endpoint + Grafana dashboard
- [ ] Structured JSON logging with log levels
- [ ] Staging environment with branch-based deploys
- [ ] Terraform to provision the VPS infrastructure as code
- [ ] Docker image vulnerability scanning in the pipeline (Trivy)