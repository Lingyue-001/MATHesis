#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() {
  printf '[setup-mac] %s\n' "$1"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

ensure_homebrew() {
  if command_exists brew; then
    return 0
  fi

  log "Homebrew not found. Installing Homebrew."
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

setup_brew_shellenv() {
  if command_exists brew; then
    return 0
  fi

  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

ensure_brew_packages() {
  local missing=()

  if ! command_exists fnm; then
    missing+=("fnm")
  fi
  if ! command_exists git; then
    missing+=("git")
  fi
  if ! command_exists python3; then
    missing+=("python")
  fi

  if [[ ${#missing[@]} -eq 0 ]]; then
    return 0
  fi

  log "Installing missing Homebrew packages: ${missing[*]}"
  brew install "${missing[@]}"
}

activate_node() {
  eval "$(fnm env --shell bash)"
  local node_version
  node_version="$(tr -d '[:space:]' < "${REPO_ROOT}/.nvmrc")"
  log "Installing and using Node ${node_version} via fnm."
  fnm install "${node_version}"
  fnm use "${node_version}"
}

ensure_env_file() {
  if [[ -f "${REPO_ROOT}/.env" || ! -f "${REPO_ROOT}/.env.example" ]]; then
    return 0
  fi

  log "Creating local .env from .env.example."
  cp "${REPO_ROOT}/.env.example" "${REPO_ROOT}/.env"
}

main() {
  cd "${REPO_ROOT}"

  ensure_homebrew
  setup_brew_shellenv
  ensure_brew_packages
  activate_node
  ensure_env_file

  log "Installing npm dependencies."
  npm ci

  log "Installing Python dependencies."
  python3 -m pip install --upgrade pip
  python3 -m pip install -r requirements.txt

  log "Installing Playwright Chromium browser."
  npx playwright install chromium

  log "Running installation verification."
  node scripts/verify-install.mjs

  log "Setup complete."
}

main "$@"
