# Keycloak como IdP (OIDC)

O servidor web do **Deep Ion DB** atua como **Resource Server**: ele apenas
valida o token Bearer (`Authorization: Bearer <token>`) enviado pela UI usando o
JWKS do provedor. Este guia mostra como configurar o [Keycloak](https://www.keycloak.org/)
como provedor de identidade (IdP).

> Variáveis relacionadas no servidor: `OIDC_ISSUER`, `OIDC_AUDIENCE`,
> `OIDC_JWKS_URI` (ver [DEPLOY.md](./DEPLOY.md)).

## 1. Realm dedicado

Crie um realm separado (ex.: `deepion`) em vez de usar o `master`. Isso isola
usuários, sessões e clients do Deep Ion DB de outros sistemas.

## 2. Client

Crie um client (ex.: `deepion`) com:

- **Client authentication: Off** (público — o fluxo Authorization Code + PKCE da
  UI não usa client secret).
- **Standard flow: On** (Authorization Code, usado pela UI — issue #106).
- **Direct access grants: On** — útil para obter tokens via `curl` em dev.
- **Valid redirect URIs:** a URL pública da UI, ex.: `http://localhost:4000/*`.
- **Web origins:** `+` (ecoa os redirect URIs) ou a origem da UI.

### Audience mapper (obrigatório se usar `OIDC_AUDIENCE`)

Por padrão o Keycloak **não** coloca o nome do client no claim `aud` do _access
token_. Como o servidor valida `aud` quando `OIDC_AUDIENCE` está definido, adicione
um **Protocol Mapper** do tipo **Audience**:

- Mapper type: `Audience`
- Included Client Audience: `deepion`
- Add to access token: `On`

Sem ele, a validação falha com `ERR_JWT_CLAIM_VALIDATION_FAILED` mesmo com issuer
e JWKS corretos. (Alternativa: não definir `OIDC_AUDIENCE` no servidor.)

## 3. `OIDC_ISSUER` vs `OIDC_JWKS_URI` em containers

O claim `iss` do token usa o hostname **público** do Keycloak. Mas, dentro do
Docker/Kubernetes, esse hostname (`localhost`) não é acessível pelo container do
servidor. Por isso o JWKS deve apontar para a URL **interna**:

```env
# URL pública (precisa bater com o claim `iss` do token)
OIDC_ISSUER=http://localhost:8080/realms/deepion
# URL interna (rede do Docker/K8s) usada para baixar as chaves
OIDC_JWKS_URI=http://keycloak:8080/realms/deepion/protocol/openid-connect/certs
OIDC_AUDIENCE=deepion
```

Se servidor e Keycloak compartilharem o mesmo hostname (ex.: ambos atrás do mesmo
proxy), basta `OIDC_ISSUER` — o JWKS é derivado dele automaticamente.

## 4. Obter um token em dev

Com **Direct access grants** habilitado:

```sh
curl -s -X POST \
  http://localhost:8080/realms/deepion/protocol/openid-connect/token \
  -d 'grant_type=password&client_id=deepion&username=SEU_USUARIO&password=SUA_SENHA' \
  | jq -r .access_token
```

Cole o `access_token` no campo de token da UI (ou deixe o fluxo de login da UI
fazer o redirect — issue #106).

## 5. Realm de exemplo

O arquivo [`deploy/keycloak/realm-deepion.json`](../deploy/keycloak/realm-deepion.json)
traz um realm `deepion` mínimo, já com o client público `deepion` e o audience
mapper configurado. Importe ao subir o Keycloak:

```sh
docker run --rm -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin \
  -v "$PWD/deploy/keycloak:/opt/keycloak/data/import:ro" \
  quay.io/keycloak/keycloak:latest start-dev --import-realm
```

Depois crie um usuário no realm `deepion` (aba **Users → Add user**, defina uma
senha em **Credentials**) e use-o para autenticar.
