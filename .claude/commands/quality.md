---
description: Roda o gate de qualidade (typecheck + lint + format) e corrige o que for possível
allowed-tools: Bash(npm run:*), Read, Edit
---

Execute o gate de qualidade do projeto e deixe a árvore limpa:

1. Rode `npm run quality` (typecheck + lint + format:check).
2. Se o **format** falhar, rode `npm run format` para aplicar.
3. Se o **lint** falhar, rode `npm run lint:fix`; corrija manualmente o que restar.
4. Se o **typecheck** falhar, corrija os erros de tipo.
5. Rode `npm run quality` novamente e confirme que passa.

Lembre de usar o Node do nvm (`nvm use --lts`) antes dos comandos npm.
Ao final, resuma o que foi corrigido. Não faça commit a menos que solicitado.
