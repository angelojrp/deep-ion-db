# Capturas de tela (showcase)

Esta pasta guarda as imagens/GIFs usados no [`README.md`](../../README.md) e na documentação.

As capturas precisam ser geradas com o app rodando (`npm run dev` ou um build), portanto
não são versionadas automaticamente. Ao adicionar uma imagem, mantenha estes nomes para
que a tabela de "Capturas de tela" do README funcione sem edição:

| Arquivo | Tela | O que mostrar |
| --- | --- | --- |
| `editor.png` | Editor + resultados | Query no Monaco + grade com linhas, tempo de execução e abas |
| `explorer.png` | Database Explorer | Árvore multi-conexão com tabelas/colunas expandidas |
| `ai.png` | Assistente de IA | Painel de IA respondendo um NL→SQL ou explicação de query |
| `admin.png` | Admin web (SSO) | Painel de administração com data sources / grants / auditoria |

Recomendações:

- Largura ~1280 px, PNG otimizado (ou GIF curto < 3 MB para fluxos animados).
- Use dados de exemplo (nunca dados/credenciais reais de produção).
- Tema claro **ou** escuro de forma consistente entre as imagens.

Depois de adicionar os arquivos, troque os `_em breve_` da tabela do README por
`![Editor](docs/img/editor.png)` etc.
