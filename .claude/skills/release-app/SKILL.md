---
name: release-app
description: Procedimento para publicar uma nova versão desktop (instaladores Windows/macOS/Linux) nas Releases do GitHub via CI. Use quando a tarefa for "lançar/release vX.Y.Z" ou publicar binários.
---

# Publicar uma release desktop

A release é feita pelo workflow `.github/workflows/release.yml`, disparado por **tags `v*`**.

## Modelo (importante)

O workflow tem dois estágios para evitar corrida entre os SOs:

1. **build** (matriz win/mac/linux): cada SO roda `electron-builder --publish never` e sobe os
   instaladores como **artifacts** (`actions/upload-artifact`).
2. **release** (job único): baixa todos os artifacts e publica **uma** release com
   `softprops/action-gh-release`.

> Nunca volte ao modelo antigo de `--publish always` em cada job da matriz: ele cria releases/drafts
> concorrentes com a mesma tag e perde assets.

## Passos

1. Garanta que `develop` está pronto e mergeado em `main` (gitflow). A tag é criada em `main`.
2. Atualize a versão em `package.json` (`version`) seguindo SemVer. Commit `chore(release): vX.Y.Z`.
3. Crie e empurre a tag a partir de `main`:

   ```bash
   git checkout main && git pull
   git tag -a vX.Y.Z -m "Deep Ion DB vX.Y.Z"
   git push origin vX.Y.Z
   ```

4. Acompanhe o CI:

   ```bash
   gh run list --workflow=release.yml --limit 1
   gh run watch <run-id> --exit-status
   ```

5. Verifique os assets (deve haver `.exe`, `.dmg`, `.zip`, `.AppImage`, `.deb` + `latest*.yml`):

   ```bash
   gh release view vX.Y.Z --json isDraft,assets -q '.isDraft, (.assets[].name)'
   ```

## Se algo der errado

- Para refazer a mesma versão: apague a release e a tag, corrija e recrie a tag.

  ```bash
  gh release delete vX.Y.Z --yes
  git push --delete origin vX.Y.Z && git tag -d vX.Y.Z
  ```

- Builds não são assinados ainda (issue #36): avisos de SmartScreen/Gatekeeper são esperados.
