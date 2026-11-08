# Deployment Guide

This app is a static site: plain HTML, CSS, and JavaScript with no build step,
no server-side database, and no external dependencies. That makes it easy to
host on a Raspberry Pi (or any small always-on computer) and use from other
devices on your home network.

- [What the server actually does](#what-the-server-actually-does)
- [Quick test on the Pi](#quick-test-on-the-pi)
- [Run it automatically with systemd](#run-it-automatically-with-systemd)
- [Keep it on your local network](#keep-it-on-your-local-network)
- [Optional: Caddy with basic auth](#optional-caddy-with-basic-auth)
- [Remote access](#remote-access)
- [Updating the app](#updating-the-app)
- [Backups and moving data](#backups-and-moving-data)
- [Troubleshooting](#troubleshooting)

## What the server actually does

The Pi only serves the static files. It does **not** store jobs. Each browser
keeps its own job list in `localStorage`, tied to the exact URL you use.

That has three practical consequences:

1. The same job list is **not shared** between your phone and laptop. Each
   device/browser has its own data.
2. These are different storage origins, even though they serve the same files:
   - `http://raspberrypi.local:8000`
   - `http://192.168.1.50:8000`
   - `http://raspberrypi.local` (port 80)
3. Changing the hostname or port makes existing jobs appear to vanish. They are
   still stored under the old origin. Export a backup before changing URLs.

If you need one shared list across devices, the app needs a small server-side
store (for example SQLite behind a tiny API). That is a separate change from
static hosting.

## Quick test on the Pi

These commands assume Raspberry Pi OS and a project folder in your home
directory. Replace `serenasews-job-tracker` and the user name as needed.

### 1. Copy the project to the Pi

From your computer:

```bash
scp -r serenasews-job-tracker <user>@raspberrypi.local:~/
```

Or use `rsync`:

```bash
rsync -av serenasews-job-tracker/ <user>@raspberrypi.local:~/serenasews-job-tracker/
```

### 2. Start a temporary server

```bash
ssh <user>@raspberrypi.local
cd ~/serenasews-job-tracker
python3 -m http.server 8000 --bind 0.0.0.0
```

`--bind 0.0.0.0` listens on all network interfaces so other devices can reach
it. Leave this terminal open while testing.

### 3. Open it from another device

Find the Pi's address:

```bash
hostname -I
```

Then visit one of these from a phone or computer on the same network:

```text
http://raspberrypi.local:8000
http://<pi-lan-ip>:8000
```

If `raspberrypi.local` does not resolve, use the IP address. mDNS support varies
by device and network.

**Use one URL consistently.** Whichever one you choose becomes that browser's
storage origin.

Stop the temporary server with `Ctrl+C` when you are done testing.

## Run it automatically with systemd

Use a service so the app starts at boot and restarts after a failure.

Create `/etc/systemd/system/serena-jobs.service`:

```ini
[Unit]
Description=Serena Dang Job Tracker
After=network-online.target
Wants=network-online.target

[Service]
User=<user>
ExecStart=/usr/bin/python3 -m http.server 8000 --bind 0.0.0.0 --directory /home/<user>/serenasews-job-tracker
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
```

Replace `<user>` with your Pi user name. Then enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now serena-jobs
```

Check that it is running:

```bash
systemctl status serena-jobs
```

Follow the logs:

```bash
journalctl -u serena-jobs -f
```

Restart after changes:

```bash
sudo systemctl restart serena-jobs
```

`python3 -m http.server` is single-threaded and intended for light personal use.
That is usually fine for a household. For a more robust server, use Caddy or
nginx as described below.

## Keep it on your local network

### Do not forward the port

Do **not** create a port-forwarding rule for port 8000 on your router. Keeping
the service reachable only from inside the LAN is the main protection.

### Restrict the Pi firewall

If `ufw` is available, allow only your local subnet:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 8000 proto tcp
sudo ufw enable
```

Adjust `192.168.1.0/24` to match your network. Common alternatives are
`192.168.0.0/24` and `10.0.0.0/24`.

Check the rules:

```bash
sudo ufw status verbose
```

### Use a stable address

Set a DHCP reservation for the Pi in your router so its IP does not change. If
you prefer the hostname, make sure Avahi/mDNS is installed and working:

```bash
sudo apt install avahi-daemon
```

### Check what is listening

```bash
ss -ltnp | grep 8000
```

To listen only on the Pi's LAN address instead of all interfaces:

```bash
python3 -m http.server 8000 --bind 192.168.1.50
```

That is stricter, but the address must stay stable. Using `0.0.0.0` plus a
firewall rule is usually simpler.

### About access control

The app has no built-in login. However, because data lives in each browser's
`localStorage`, another person on the LAN who opens the app from their own
device sees their own empty list, not your jobs. They cannot read your browser's
stored data through the server.

If you want to prevent other LAN users from loading the app at all, add basic
auth with Caddy or nginx. Do not send credentials over plain HTTP on an
untrusted network. On a trusted home LAN, basic auth is mainly a speed bump.

## Optional: Caddy with basic auth

Caddy is a good fit for a Pi: one small binary, simple configuration, and
optional password protection.

Install Caddy using the official instructions for your OS, then create a
`Caddyfile`:

```caddyfile
:8000 {
    root * /home/<user>/serenasews-job-tracker
    file_server

    basic_auth {
        serena <password-hash>
    }
}
```

Generate the password hash:

```bash
caddy hash-password --plaintext 'choose-a-password'
```

Paste the resulting hash into `<password-hash>`. Start Caddy with:

```bash
caddy run --config /path/to/Caddyfile
```

For an always-on setup, run Caddy as a systemd service using the package's
provided unit, or create your own.

Caddy can also serve HTTPS with a locally trusted certificate, but every client
device must trust Caddy's local root certificate. For a simple home-LAN setup,
HTTP is usually enough.

## Remote access

If you want to use the app away from home, use a VPN rather than exposing the Pi
to the internet:

- **Tailscale** is the easiest option.
- **WireGuard** is a good self-hosted alternative.

With Tailscale, install it on the Pi and on your phone/laptop, then use the Pi's
Tailscale address. Do not forward ports on your router.

Remember that remote access does not change the storage model: each browser
still has its own job list.

## Updating the app

Because the app is static, updating means replacing the files and refreshing the
browser.

```bash
rsync -av serenasews-job-tracker/ <user>@raspberrypi.local:~/serenasews-job-tracker/
```

The Python server does not need a restart for file changes. If the browser
serves an old cached version, do a hard refresh:

- Linux/Windows: `Ctrl+Shift+R`
- macOS: `Cmd+Shift+R`

If you use systemd, restarting is harmless:

```bash
sudo systemctl restart serena-jobs
```

## Backups and moving data

Jobs are stored by the browser, not on the Pi. Use **Export spreadsheet** or
**Export CSV** regularly from each device you use.

Before changing any of the following, export your data first:

- hostname (`raspberrypi.local` to an IP)
- port (8000 to 80 or 443)
- HTTP to HTTPS
- browser or browser profile
- clearing site data / browser history

Those changes can create a new storage origin, leaving the old jobs behind under
the old URL.

If you later add server-side storage, back up the Pi's database file and keep a
copy off the Pi.

## Troubleshooting

### Other devices cannot connect

- Confirm the server is running: `systemctl status serena-jobs`
- Confirm it listens on the expected interface: `ss -ltnp | grep 8000`
- Confirm the device is on the same LAN.
- Check the Pi firewall: `sudo ufw status`
- Try the Pi's IP instead of `raspberrypi.local`.
- Some guest Wi-Fi networks block device-to-device traffic.

### The service fails to start

```bash
systemctl status serena-jobs
journalctl -u serena-jobs --no-pager -n 50
```

Common causes:

- wrong path in `--directory`
- wrong `User=` value
- the project folder is not readable by that user
- port 8000 is already in use (`ss -ltnp | grep 8000`)

### Jobs disappeared

Check whether the URL or port changed. `localStorage` is per origin. Also confirm
the browser did not clear site data. Restore from an exported `.xlsx` or `.csv`
file if needed.

### Page loads without styling or scripts

Confirm `styles.css`, `app.js`, and `xlsx.js` are next to `index.html` in the
served directory. Hard-refresh the browser.

### Downloads do not work

Exports are generated entirely in the browser. If downloads are blocked, check
the browser's download permissions and available storage on the device.
