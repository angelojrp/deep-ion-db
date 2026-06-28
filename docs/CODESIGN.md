# Assinatura de código (Windows e macOS)

Instaladores assinados evitam os avisos de "desenvolvedor não identificado"
(SmartScreen no Windows, Gatekeeper no macOS). A assinatura é **opcional** e
totalmente dirigida por _secrets_ do repositório: sem eles, o build de release
continua funcionando e gera instaladores **não assinados**.

O fluxo já está pronto em `electron-builder.yml` e `.github/workflows/release.yml`.
Basta cadastrar os _secrets_ abaixo em **Settings → Secrets and variables →
Actions**.

## Secrets

| Secret | Plataforma | Descrição |
| --- | --- | --- |
| `CSC_LINK` | Windows e macOS | Certificado em **base64** (`.pfx` no Windows, `.p12`/Developer ID no macOS) |
| `CSC_KEY_PASSWORD` | Windows e macOS | Senha do certificado |
| `APPLE_ID` | macOS | Apple ID usada para notarização |
| `APPLE_APP_SPECIFIC_PASSWORD` | macOS | Senha de app específica (appleid.apple.com) |
| `APPLE_TEAM_ID` | macOS | Team ID da conta Apple Developer |

Quando `CSC_LINK` está vazio, `CSC_IDENTITY_AUTO_DISCOVERY` vira `false` e o
electron-builder pula a assinatura em ambas as plataformas.

## Windows

1. Obtenha um certificado **Code Signing** (OV ou EV) de uma CA (DigiCert,
   Sectigo, etc.) ou use **Azure Trusted Signing**.
2. Exporte como `.pfx` e gere o base64:
   ```bash
   base64 -w0 certificado.pfx > cert.b64   # Linux
   base64 -i certificado.pfx | tr -d '\n'  # macOS
   ```
3. Cadastre o conteúdo em `CSC_LINK` e a senha em `CSC_KEY_PASSWORD`.

> Certificados OV passaram a exigir armazenamento em HSM/token. Nesse caso,
> prefira **Azure Trusted Signing** e ajuste `win.signtoolOptions` conforme a
> documentação do electron-builder.

## macOS

1. Crie um certificado **Developer ID Application** no Apple Developer.
2. Exporte como `.p12`, gere o base64 e cadastre em `CSC_LINK` /
   `CSC_KEY_PASSWORD`.
3. Para notarização, crie uma **app-specific password** em appleid.apple.com e
   cadastre `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` e `APPLE_TEAM_ID`.

A configuração de macOS já habilita `hardenedRuntime`, `entitlements`
(`build/entitlements.mac.plist`) e `notarize: true`, requisitos do Gatekeeper.

## Teste local

```bash
# macOS, com certificado instalado no Keychain
npm run dist:mac

# Windows, com o .pfx disponível
set CSC_LINK=... & set CSC_KEY_PASSWORD=... & npm run dist:win
```
