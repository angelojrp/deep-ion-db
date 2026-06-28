# Identidade visual

A marca do **Deep Ion DB** combina um cilindro de banco de dados com órbitas de
elétrons (o "íon"), em azul profundo. O arquivo-fonte é vetorial e todos os
ícones de plataforma são derivados dele.

## Arquivos

| Arquivo | Uso |
| --- | --- |
| `build/logo.svg` | Fonte vetorial (edite só este) |
| `build/icon.png` (1024×1024) | Ícone base; electron-builder gera `.icns` (macOS) e ícones Linux a partir dele |
| `build/icon.ico` | Ícone do instalador/executável Windows (multi-resolução) |
| `src/renderer/public/icon.png` (256×256) | Logo exibido no cabeçalho da app |
| `src/renderer/public/favicon.svg` | Favicon da janela/web |

## Regenerar os ícones

Após editar `build/logo.svg`, rode:

```bash
npm run icons
```

O script `scripts/gen-icons.mjs` rasteriza o SVG (via `sharp`) e regrava todos os
PNG/ICO acima. As dependências `sharp` e `png-to-ico` são apenas de
desenvolvimento — o build de release usa os PNG/ICO já versionados.

## Cores da marca

- Fundo: `#0b1e3b` → `#15324f` (gradiente)
- Banco de dados: `#38bdf8` / `#7dd3fc`
- Acentos: `#f472b6`, `#facc15`
