# Deploy do ambiente web empresarial

A versão web do Deep Ion DB (épico [#53](https://github.com/angelojrp/deep-ion-db/issues/53)) é
composta por:

- **server** — backend Node/Fastify que reaproveita a camada de drivers de banco.
- **meta** — PostgreSQL de metadados (usuários, data sources, grants, auditoria).

> Estado atual (MVP): o `server` expõe `/health` e endpoints de acesso a PostgreSQL. Autenticação
> (OIDC), data sources gerenciados, grants e auditoria estão sendo adicionados nas issues
> [#56](https://github.com/angelojrp/deep-ion-db/issues/56),
> [#59](https://github.com/angelojrp/deep-ion-db/issues/59),
> [#60](https://github.com/angelojrp/deep-ion-db/issues/60),
> [#63](https://github.com/angelojrp/deep-ion-db/issues/63). **Não exponha publicamente antes do OIDC.**

---

## Opção A — Docker Compose (recomendado para uso pessoal / self-host)

Pré-requisitos: Docker Desktop (ou Docker Engine) com o plugin Compose v2.

```bash
# 1. Configure as variáveis (opcional; há defaults)
cp .env.example .env
# edite .env e troque META_DB_PASSWORD

# 2. Suba a stack (builda a imagem do server na primeira vez)
docker compose up -d

# 3. Verifique
curl http://localhost:4000/health
# {"ok":true,"service":"deep-ion-db-server","version":"..."}

# logs / parar
docker compose logs -f server
docker compose down            # mantém os dados (volume meta-data)
docker compose down -v         # remove também os dados
```

Variáveis (`.env`): `SERVER_PORT` (padrão 4000), `META_DB_USER`, `META_DB_PASSWORD`, `META_DB_NAME`,
`META_ENCRYPTION_KEY` (cofre de credenciais), e autenticação `AUTH_DISABLED`/`OIDC_ISSUER`/`OIDC_AUDIENCE`/`OIDC_JWKS_URI`.

### Autenticação (OIDC)

- **Uso pessoal / self-host:** deixe `AUTH_DISABLED=true` (a API usa um usuário admin de dev).
- **Produção:** `AUTH_DISABLED=false` e configure o IdP (ex.: Keycloak):
  `OIDC_ISSUER=https://idp.exemplo/realms/seu-realm`, `OIDC_AUDIENCE=deepion`. O JWKS é derivado do
  issuer (Keycloak) ou informe `OIDC_JWKS_URI`. O primeiro usuário autenticado vira **admin**; os
  demais entram como `user` (RBAC). Defina sempre `META_ENCRYPTION_KEY`.

---

## Opção B — Kubernetes

Pré-requisitos: um cluster (Docker Desktop, kind, minikube ou gerenciado) e `kubectl`.
Manifests em [`deploy/k8s/`](../deploy/k8s).

### 1. Publique a imagem do server

```bash
# build + tag para o seu registry
docker build -t ghcr.io/angelojrp/deep-ion-db-server:0.2.0 .
docker push ghcr.io/angelojrp/deep-ion-db-server:0.2.0
# ajuste `image:` em deploy/k8s/server.yaml para essa tag
```

> Em clusters locais (Docker Desktop / kind), você pode usar a imagem local sem registry:
> Docker Desktop K8s já enxerga `deep-ion-db-server:latest`; no kind use
> `kind load docker-image deep-ion-db-server:latest`.

### 2. Crie o Secret de metadados

```bash
cp deploy/k8s/secret.example.yaml deploy/k8s/secret.yaml
# edite os valores (senha, URL) — NÃO versione secret.yaml
```

### 3. Aplique

```bash
# com kustomize (recomendado)
kubectl apply -k deploy/k8s

# ou aplicando os arquivos individualmente
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/secret.yaml
kubectl apply -f deploy/k8s/postgres.yaml
kubectl apply -f deploy/k8s/server.yaml
# kubectl apply -f deploy/k8s/ingress.yaml   # opcional
```

### 4. Acesse e valide

```bash
kubectl -n deep-ion-db rollout status deploy/deepion-server
kubectl -n deep-ion-db port-forward svc/deepion-server 4000:80
curl http://localhost:4000/health
```

Para acesso externo, habilite o `ingress.yaml` (requer um ingress controller, ex.: nginx) e aponte
o host `deepion.local` para o cluster.

### Produção

- Prefira um **PostgreSQL gerenciado** para os metadados: remova `postgres.yaml` e aponte
  `META_DATABASE_URL` (no Secret) para o banco gerenciado.
- Coloque o `server` atrás de TLS (Ingress + cert-manager) e só libere após o OIDC (#56).
- Gerencie segredos com o cofre da sua plataforma (Sealed Secrets, External Secrets, Vault).
