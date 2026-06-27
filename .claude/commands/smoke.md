---
description: Builda o app e faz um smoke test (a janela do Electron sobe sem crashar)
allowed-tools: Bash
---

Faça um smoke test do app:

1. Garanta o Node do nvm: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --lts`.
2. `npm run build`.
3. Lance o app empacotado por alguns segundos e meça se ele se mantém vivo:

   ```bash
   start=$(date +%s)
   timeout --preserve-status 12s ./node_modules/.bin/electron --no-sandbox out/main/index.js >/tmp/deepion-smoke.log 2>&1
   echo "duração: $(( $(date +%s) - start ))s (>=12 = subiu OK)"
   ```

4. Se a duração for ~12s, o app inicializou sem crashar. Caso contrário, mostre `/tmp/deepion-smoke.log`.

Opcional: validar o caminho de query do SQLite sob o ABI do Electron com
`ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron <script>`.
