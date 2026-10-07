#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu server. Run as root; safe to re-run.
# Usage: sudo SERVER_USER=deploy ./bootstrap.sh "ssh-ed25519 AAAA... comment"
set -euo pipefail

SERVER_USER="${SERVER_USER:-deploy}"
SSH_PUBLIC_KEY="${1:-}"

if [[ $EUID -ne 0 ]]; then
	echo "Run as root." >&2
	exit 1
fi
if [[ -z $SSH_PUBLIC_KEY ]]; then
	echo "Usage: $0 \"<ssh public key>\"" >&2
	exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Creating user $SERVER_USER"
if ! id "$SERVER_USER" >/dev/null 2>&1; then
	adduser --disabled-password --gecos "" "$SERVER_USER"
fi
usermod -aG sudo "$SERVER_USER"
# No password is set (key-only login), so sudo must not ask for one.
echo "$SERVER_USER ALL=(ALL) NOPASSWD:ALL" >"/etc/sudoers.d/90-$SERVER_USER"
chmod 440 "/etc/sudoers.d/90-$SERVER_USER"
visudo -cf "/etc/sudoers.d/90-$SERVER_USER" >/dev/null

echo "==> Installing SSH key"
home_dir=$(getent passwd "$SERVER_USER" | cut -d: -f6)
install -d -m 700 -o "$SERVER_USER" -g "$SERVER_USER" "$home_dir/.ssh"
touch "$home_dir/.ssh/authorized_keys"
grep -qxF "$SSH_PUBLIC_KEY" "$home_dir/.ssh/authorized_keys" || echo "$SSH_PUBLIC_KEY" >>"$home_dir/.ssh/authorized_keys"
chown "$SERVER_USER:$SERVER_USER" "$home_dir/.ssh/authorized_keys"
chmod 600 "$home_dir/.ssh/authorized_keys"

echo "==> Hardening SSH"
if [[ ! -s "$home_dir/.ssh/authorized_keys" ]]; then
	echo "authorized_keys missing for $SERVER_USER; refusing to harden SSH." >&2
	exit 1
fi
# 00- prefix: sshd uses the first value found, so this beats cloud-init drop-ins.
cat >/etc/ssh/sshd_config.d/00-hardening.conf <<CONF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
CONF
if sshd -t; then
	systemctl reload ssh || systemctl reload sshd
else
	rm -f /etc/ssh/sshd_config.d/00-hardening.conf
	echo "sshd config invalid; hardening reverted." >&2
	exit 1
fi

echo "==> Installing packages"
apt-get update -y
apt-get install -y ufw unattended-upgrades fail2ban ca-certificates curl gnupg rsync

echo "==> Configuring firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "==> Enabling unattended-upgrades and fail2ban"
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";' >/etc/apt/apt.conf.d/20auto-upgrades
systemctl enable --now unattended-upgrades fail2ban

echo "==> Installing Docker"
# shellcheck disable=SC1091
codename=$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
if ! curl -fsI "https://download.docker.com/linux/ubuntu/dists/$codename/Release" >/dev/null; then
	echo "Docker's apt repository has no packages for Ubuntu '$codename' yet." >&2
	echo "Wait for Docker to add support, or install Docker manually." >&2
	exit 1
fi
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" >/etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
usermod -aG docker "$SERVER_USER"

echo "==> Creating /opt/stack"
install -d -o "$SERVER_USER" -g "$SERVER_USER" /opt/stack

echo "==> Configuring swap"
if [[ -z $(swapon --show --noheadings) && ! -e /swapfile ]]; then
	fallocate -l 2G /swapfile
	chmod 600 /swapfile
	mkswap /swapfile
	swapon /swapfile
	grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi
echo 'vm.swappiness=10' >/etc/sysctl.d/99-swappiness.conf
sysctl -p /etc/sysctl.d/99-swappiness.conf

echo "Bootstrap complete. Test a NEW SSH session as $SERVER_USER before closing this one."
