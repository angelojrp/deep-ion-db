#!/usr/bin/env bash
# Stop hook: impede finalizar com erros de tipo (gate de qualidade).
# Sai com código 2 e escreve no stderr para que o agente corrija antes de parar.
set -u

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  nvm use --lts >/dev/null 2>&1 || true
fi
command -v npm >/dev/null 2>&1 || exit 0

dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$dir" || exit 0

# Só roda se houver fontes TypeScript (evita ruído em repositórios vazios).
ls src/**/*.ts >/dev/null 2>&1 || ls src/*.ts >/dev/null 2>&1 || [ -d src ] || exit 0

if ! out=$(npm run -s typecheck 2>&1); then
  {
    echo "❌ Typecheck falhou — corrija os erros de tipo antes de finalizar:"
    echo "$out" | tail -n 40
  } >&2
  exit 2
fi

exit 0
