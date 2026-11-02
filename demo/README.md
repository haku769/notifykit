# Demo: Minha Loja

Projeto **cliente** de exemplo. Ele simula uma loja virtual que instala a `notifykit`
como dependência, do mesmo jeito que qualquer desenvolvedor faria.

```bash
cd demo
npm install
npm start
```

| Arquivo | O que mostra |
|---|---|
| `app.ts` | Uso padrão: configuração do `Notifier`, envio simples, fallback (`push → email`), broadcast e eventos |
| `canais/DiscordChannel.ts` | Extensão: um canal que não existe na lib, criado pelo cliente herdando de `BaseChannel` |

Para a demo rodar sem contas reais, o e-mail usa um transporte falso que só imprime
na tela, e o canal `push` foi configurado para sempre falhar e mostrar o fallback.
