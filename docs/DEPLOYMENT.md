# Deployment plan

Status: **the repository is ready, and this session could not reach the Droplet.** No SSH key, `doctl` config, or Droplet address is available here, so no SSH session, DNS change, certificate request, or container was made. The Compose files, Nginx template, and backup script are in the repo for the release sequence below.

Target hostname: `playchess.akshaybhatnagar.in`.

Hosting: the existing DigitalOcean Droplet. This plan does not create, resize, rebuild, or destroy a Droplet.

## What stays untouched until you approve it

- Droplet OS, packages, users, and SSH config
- Nginx, including the global config and every current site
- Firewall rules
- Docker containers, images, volumes, and networks already on the machine
- DNS records and nameservers for `akshaybhatnagar.in`
- Ports 80 and 443, beyond reading what already uses them
- Any secret material

Destructive commands are out of scope even after approval unless you ask for that specific command. That includes `docker system prune -a`, deleting volumes, and resetting UFW.

## Proposed shape

```
Internet
  -> Nginx on the Droplet (80/443, SNI for playchess.akshaybhatnagar.in)
    -> PlayChess web/API container on a private Compose network
    -> PostgreSQL container, no host port, named volume
```

Compose project name: `playchess`. Project directory on the server: a new directory, not an existing app's folder.

| Piece | Rule |
| --- | --- |
| Web and API | One image built from this repository. Listens on a container port. No public host binding. |
| PostgreSQL | Private network only. No `5432` published on the host. Docker published ports can bypass UFW assumptions, so private services get no host port at all. |
| Nginx | A new site file for this hostname. `nginx -t` before reload. WebSocket `Upgrade` and `Connection` headers preserved, with proxy timeouts long enough for a game socket. |
| TLS | Let's Encrypt via Certbot after the A record resolves to this Droplet and port 80 can complete the challenge. HTTP redirects to HTTPS after the certificate exists. Renewal is checked, not assumed. |
| Secrets | A root-owned env file on the server, mode `0600`. Never in Git, never in a `VITE_` variable. Inside the container `API_HOST` stays `0.0.0.0` so Docker can forward the published port. The host binding is `127.0.0.1:4318` in Compose, and Nginx is the public listener. |
| Process | Compose restart policies and a health endpoint. The API shuts down on SIGTERM. |
| CI deploy | Not in this repository. GitHub Actions currently runs checks only. A deploy workflow waits until a manual deploy has worked and a dedicated deploy key is stored as a repository secret. |

## Before any server edit

Inspect and record, without changing:

1. OS version and whether it is Ubuntu LTS. Do not assume the distro.
2. CPU, memory, and free disk.
3. `ss` listeners, especially 22, 80, 443, 5432, and any app ports.
4. Nginx sites under `sites-enabled` and `conf.d`.
5. Running systemd units and Docker containers.
6. Firewall (`ufw status`, and any DigitalOcean cloud firewall).
7. The Droplet's public IPv4, and whether IPv6 is enabled.

If Nginx already serves other hostnames, add a dedicated virtual host. Do not replace `nginx.conf`.

## DNS

The parent zone is `akshaybhatnagar.in`. The registrar has been GoDaddy, and DNS has previously been managed at Vercel. Those can differ.

1. Find the authoritative nameservers (`dig NS akshaybhatnagar.in`) and edit DNS only at that provider.
2. Do not change nameservers.
3. Add an A record for host `playchess` to the Droplet's public IPv4.
4. If an AAAA record exists, confirm IPv6 reaches this Droplet or leave it alone until you decide. Do not delete it as a shortcut.
5. Wait until `dig playchess.akshaybhatnagar.in` shows the Droplet address before requesting a certificate.

Public DNS, read during this session and not changed: `akshaybhatnagar.in` is delegated to `ns1.digitalocean.com`, `ns2.digitalocean.com`, and `ns3.digitalocean.com`. `playchess.akshaybhatnagar.in` already has an A record, `206.189.129.16`, the same address as the apex. There is no AAAA record. Do not add a second A record.

From this environment, TCP to that address on 22, 80, and 443 connects and then returns no data. There is no SSH key here, so the release sequence has not been run.

## Server env file

Create `/opt/playchess/.env` on the Droplet, owner root, mode `0600`. Generate the password and session secret there. Do not copy the local `playchess` database password. `POSTGRES_PASSWORD` and the password inside `DATABASE_URL` are the same value. Compose reads this file for both substitution and the API container.

```
NODE_ENV=production
POSTGRES_PASSWORD=<generated>
DATABASE_URL=postgresql://playchess:<generated>@postgres:5432/playchess
SESSION_SECRET=<generated, at least 32 characters>
WEB_ORIGIN=https://playchess.akshaybhatnagar.in
API_HOST=0.0.0.0
API_PORT=4318
LOG_LEVEL=info
```

## Release sequence, after approval

1. Push the reviewed commit. CI is green.
2. Complete the inspection above.
3. Create the DNS record and confirm resolution.
4. Install Docker only if it is missing and you have agreed to that install.
5. Create `/opt/playchess` or another empty directory you choose. Copy the Compose file and the server env file.
6. Build the image. Run migrations against an empty database with a backup and rollback note, even when the database is new.
7. Add the Nginx site, test the config, reload Nginx.
8. Issue the certificate. Confirm HTTP redirects to HTTPS and that renewal is scheduled.
9. Check the health endpoint, a page load, an API call, a Socket.IO upgrade, and that PostgreSQL is not reachable from the public internet.
10. Play one game in two browsers. Restart the containers and confirm the game can be read again.
11. Write down the previous image tag so a rollback is a redeploy, not a reconstruction.

## Rollback and backups

- Keep the last known-good image tag or git SHA.
- Rollback is: point Compose at that tag, start it, and confirm health. Do not run down unrelated projects.
- Database backups: `deploy/backup-postgres.sh` runs `pg_dump` inside the `playchess` Compose project and writes a custom-format dump outside the database volume. Schedule it on the server. Test a restore before launch.
- Restore, against a stopped API and the same empty database:

  ```bash
  docker compose -p playchess -f /opt/playchess/docker-compose.prod.yml stop api
  docker compose -p playchess -f /opt/playchess/docker-compose.prod.yml exec -T postgres \
    pg_restore -U playchess --clean --if-exists --no-owner -d playchess < /var/backups/playchess/playchess-STAMP.dump
  docker compose -p playchess -f /opt/playchess/docker-compose.prod.yml start api
  ```

- Rollback of the app is the previous git SHA. On the server: check out that SHA, rebuild the image, `docker compose -p playchess -f docker-compose.prod.yml up -d`, and confirm `/api/v1/health`. Do not run down unrelated projects.
- Migrations ship forward. A bad migration is restored from the dump, not edited in place on production.

## Health, logs, and secrets

- `GET /api/v1/health` reports `{ ok, db }` and does not include the database URL or secrets.
- Logs are structured and omit tokens, passwords, and move-command secrets.
- GitHub Actions deployment, when added, uses a dedicated SSH key, pins actions to commit SHAs, deploys a known SHA, and checks health before it finishes. It will not expose an unauthenticated deploy endpoint.

## Reference

The general pattern matches DigitalOcean's guide for a containerized Node.js app behind Nginx and Let's Encrypt:

https://www.digitalocean.com/community/tutorials/how-to-secure-a-containerized-node-js-application-with-nginx-let-s-encrypt-and-docker-compose

That guide is background. The Droplet's current services override any generic step that would collide with them.
