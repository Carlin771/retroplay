# Guia de implantação (passo a passo)

Este guia é feito para quem **não programa**. Você vai seguir os passos e copiar/colar
comandos. O objetivo é colocar o site no ar de graça na Oracle Cloud.

---

## Visão geral do que você vai precisar

1. Uma conta no **Telegram** (a sua, que administra os canais).
2. Um **api_id** e **api_hash** do Telegram (grátis).
3. Uma conta gratuita na **Oracle Cloud** (pede cartão, mas não cobra o plano "Always Free").
4. Um subdomínio grátis no **DuckDNS** (ex.: `malhacao.duckdns.org`).

---

## Passo 1 — Pegar api_id e api_hash do Telegram

1. Acesse https://my.telegram.org e entre com seu número.
2. Clique em **API development tools**.
3. Crie um app (pode pôr qualquer nome, ex.: "meusite"). Plataforma: "Other".
4. Anote o **api_id** (números) e o **api_hash** (texto). Você vai usar depois.

---

## Passo 2 — Criar a máquina grátis na Oracle Cloud

1. Crie a conta em https://www.oracle.com/cloud/free/ (escolha uma região perto de você).
2. No painel, crie uma **Instance** (VM):
   - Image: **Ubuntu 22.04**.
   - Shape: **Ampere (ARM)** — o "always free" (2 OCPU / 12GB).
   - Em rede, marque para atribuir um **IP público**.
   - Baixe/guarde a chave SSH que ela oferecer.
3. Nas regras de rede (Security List / VCN), **libere as portas 80 e 443** (HTTP/HTTPS)
   para `0.0.0.0/0`.
4. Anote o **IP público** da máquina.

> Conecte-se à máquina pelo terminal/SSH usando a chave baixada
> (`ssh -i sua-chave.key ubuntu@SEU_IP`). No Windows, dá para usar o PuTTY.

---

## Passo 3 — Instalar o Docker na máquina

Já conectado na VM, cole estes comandos (um bloco de cada vez):

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
```

Saia (`exit`) e conecte de novo pelo SSH para o grupo do Docker valer.

---

## Passo 4 — Domínio grátis (DuckDNS)

1. Acesse https://www.duckdns.org e entre (com Google/GitHub).
2. Crie um subdomínio, ex.: `malhacao` → vira `malhacao.duckdns.org`.
3. No campo **current ip**, coloque o **IP público** da sua VM Oracle e salve.

---

## Passo 5 — Colocar o projeto na máquina

Copie a pasta do projeto para a VM. A forma mais fácil é subir para um repositório
Git (privado) e clonar, ou usar `scp`. Depois, dentro da pasta do projeto na VM:

```bash
cp .env.example .env
nano .env
```

Preencha o `.env` (Ctrl+O salva, Ctrl+X sai):

```
AUTH_SECRET="cole-aqui-uma-chave-bem-grande-e-aleatoria"
ADMIN_EMAIL="seu-email@exemplo.com"
ADMIN_PASSWORD="uma-senha-forte"
TELEGRAM_API_ID="123456"
TELEGRAM_API_HASH="seu_api_hash"
TELEGRAM_SESSION=""
SITE_DOMAIN="malhacao.duckdns.org"
```

> Para gerar o AUTH_SECRET, dá para rodar:
> `docker run --rm node:22-slim node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

---

## Passo 6 — Subir o site

```bash
docker compose up -d --build
```

A primeira vez demora alguns minutos (baixa e monta tudo). Depois disso o Caddy já
pega o certificado HTTPS sozinho. Acesse **https://SEU_DOMINIO** para ver o site.

Veja os logs se precisar:

```bash
docker compose logs -f app
```

---

## Passo 7 — Conectar sua conta do Telegram (uma vez só)

Ainda faltou a `TELEGRAM_SESSION`. Gere assim (é interativo, ele pede telefone e código):

```bash
docker compose exec app npm run tg:login
```

- Digite o telefone com DDI (ex.: `+5511999999999`).
- Digite o código que chegar no seu Telegram.
- Se você usa verificação em 2 etapas, digite a senha.

No fim ele imprime uma linha grande (a sessão). Copie ela para `TELEGRAM_SESSION` no
`.env` e reinicie:

```bash
nano .env          # cole em TELEGRAM_SESSION="..."
docker compose up -d
```

---

## Passo 8 — Criar seu usuário admin e importar os canais

Crie o administrador (usa ADMIN_EMAIL/ADMIN_PASSWORD do .env):

```bash
docker compose exec app npm run create:admin
```

Agora entre no site com esse e-mail/senha, clique em **Admin** e use
**"Importar canal do Telegram"**:

- Cole o `@usuario` do canal ou o link `t.me/...` (ex.: `@malhacao1995`).
- O sistema detecta sozinho a série ("Malhação") e a temporada ("1995"). Você pode
  corrigir nos campos se quiser.
- Repita para cada canal. Séries com o mesmo nome viram temporadas da mesma série.

> Também dá para importar pela linha de comando:
> `docker compose exec app npm run index:channel -- @malhacao1995`

Pronto! O catálogo já aparece na home, com login e "continuar assistindo".

---

## Atualizar o site depois de mudanças

```bash
git pull        # se estiver usando git
docker compose up -d --build
```

## Custos e limites (resumo honesto)

- A VM "Always Free" da Oracle e o domínio DuckDNS são **grátis**.
- Os vídeos continuam no Telegram; o site faz streaming sob demanda e guarda em cache.
- Para um público pequeno/médio, isso roda de graça. Se **muita** gente assistir ao
  mesmo tempo, o Telegram pode limitar (o cache ajuda) e a VM pode ficar apertada.
  Nesse caso, o próximo passo é mover os vídeos mais assistidos para um armazenamento
  com CDN barata (ex.: Cloudflare R2) — a arquitetura já foi pensada para isso.
