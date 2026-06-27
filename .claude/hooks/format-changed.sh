#!/usr/bin/env bash
# PostToolUse hook: formata (Prettier) e corrige (ESLint) o arquivo recém-editado.
# Recebe o payload do Claude Code via stdin (JSON com tool_input.file_path).
set -u

input=$(cat)

# Resolve Node via nvm (no WSL o `npm`/`node` do PATH é o do Windows).
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  nvm use --lts >/dev/null 2>&1 || true
fi
command -v node >/dev/null 2>&1 || exit 0

file=$(printf '%s' "$input" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch{process.stdout.write("")}})')
[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$dir" || exit 0

case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs)
    npx --no-install eslint --fix "$file" >/dev/null 2>&1 || true
    npx --no-install prettier --write "$file" >/dev/null 2>&1 || true
    ;;
  *.json | *.css | *.html | *.yml | *.yaml)
    npx --no-install prettier --write "$file" >/dev/null 2>&1 || true
    ;;
esac

exit 0
