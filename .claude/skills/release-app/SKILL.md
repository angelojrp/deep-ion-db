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

## ⚠️ `main` é protegida — NUNCA empurre commit/tag-bump direto

A branch `main` tem um ruleset que exige **PR + checks obrigatórios** (`quality` + `e2e`).
Qualquer push direto (commit de bump) é rejeitado com `GH013: Repository rule violations`.
Foi o que gerou a release botada v0.3.5 (tag sem o bump → assets com versão antiga). Ver issue #210.

Por isso o **bump de versão vai por uma branch `release/*` + PR** (o gitflow-policy aceita
`release/*` → main). A tag só é criada **depois** que o bump está mergeado em `main`.

## Caminho automatizado (preferível)

Dispare o workflow **Version Bump** (`version-bump.yml`):

```bash
gh workflow run version-bump.yml -f bump_type=patch   # ou minor | major
```

Ele cria `release/vX.Y.Z` com o bump, abre PR para `main` e habilita auto-merge. Ao mergear,
o `tag-release.yml` cria a tag `vX.Y.Z` → dispara `release.yml`.

> **Requer o secret `RELEASE_PAT`** (PAT com `repo`/`workflow`, ou fine-grained com
> Contents + Pull requests: read/write). O `GITHUB_TOKEN` padrão **não** dispara a CI no PR
> nem o `release.yml` na tag (o GitHub suprime workflows acionados por ele mesmo). Sem o PAT,
> o PR é criado mas o merge/checks/tag precisam de ação manual (ver caminho abaixo).

## Caminho manual (fallback — validado)

1. Garanta que `develop` está mergeado em `main` (PR `develop` → `main`).
2. Crie a branch de release a partir de `main`, faça o bump e abra PR:

   ```bash
   git fetch origin main && git switch -c release/vX.Y.Z origin/main
   npm version X.Y.Z --no-git-tag-version
   git commit -am "chore(release): bump versao para vX.Y.Z"
   git push -u origin release/vX.Y.Z
   gh pr create --base main --head release/vX.Y.Z --title "chore(release): bump versao para vX.Y.Z" --body "..."
   ```

3. Aguarde os checks e mergeie o PR. Depois, crie a tag no HEAD de `main`
   (via API evita problemas de objeto local):

   ```bash
   SHA=$(gh api repos/<owner>/<repo>/git/ref/heads/main --jq '.object.sha')
   gh api repos/<owner>/<repo>/git/refs -X POST -f ref="refs/tags/vX.Y.Z" -f sha="$SHA"
   ```

4. Acompanhe o CI e verifique os assets:

   ```bash
   gh run list --workflow=release.yml --limit 1
   gh run watch <run-id> --exit-status
   gh release view vX.Y.Z --json isDraft,assets -q '.isDraft, (.assets[].name)'
   ```

   Os assets devem estar nomeados com a versão NOVA (`...-X.Y.Z-...`). Se vierem com a versão
   antiga, o bump não foi aplicado antes da tag — refaça (ver abaixo).

5. **Sincronize `develop`**: após o release, `develop` fica uma versão atrás. Abra um PR
   `chore/sync-version-X.Y.Z` → `develop` com o mesmo bump, senão o próximo merge
   `develop` → `main` regride a versão.

## Se algo der errado

- Para refazer a mesma versão: apague a release e a tag, corrija e recrie a tag.

  ```bash
  gh release delete vX.Y.Z --yes
  git push --delete origin vX.Y.Z && git tag -d vX.Y.Z
  ```

- Builds não são assinados ainda (issue #36): avisos de SmartScreen/Gatekeeper são esperados.
