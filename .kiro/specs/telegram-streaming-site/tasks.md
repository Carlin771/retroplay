# Tarefas de Implementação

Ordem de construção. Cada item é incremental e verificável. As referências (Req X)
apontam para os requisitos correspondentes.

- [x] 1. Estrutura base do projeto
  - Criar app Next.js (App Router) com TypeScript e Tailwind CSS
  - Configurar estrutura de pastas, ESLint/Prettier e variáveis de ambiente (`.env`)
  - Página inicial mínima rodando (`next dev`)
  - _Req 10_

- [x] 2. Banco de dados e modelo (Prisma + SQLite)
  - Instalar Prisma, configurar `DATABASE_URL` para SQLite
  - Criar schema (User, Series, Season, Episode, WatchProgress) e gerar migração
  - Script de criação do primeiro usuário admin (a partir de `ADMIN_EMAIL`)
  - _Req 1, 3, 5, 6, 9_

- [x] 3. Autenticação e sessão (Auth.js)
  - Configurar Auth.js com provedor de credenciais (e-mail + senha)
  - Cadastro com hash de senha (argon2/bcrypt) e login
  - Papéis USER/ADMIN e utilitários de proteção de rota
  - _Req 1_

- [x] 4. Módulo Telegram (GramJS) + login único
  - Cliente MTProto compartilhado lendo credenciais/sessão do ambiente
  - Envelope com retentativa e tratamento de FLOOD_WAIT
  - Script guiado `tg:login` para gerar a StringSession (telefone + código)
  - _Req 7_

- [x] 5. Indexador de canais
  - Ler histórico do canal, filtrar mensagens com vídeo
  - Criar Série/Temporada a partir do canal, com auto-detecção do nome
    (ex.: "malhacao 1995" → série "Malhação", temporada "1995")
  - Criar Capítulos numerados pela ordem, com título/duração/tamanho/miniatura
  - Deduplicação por `(temporada, mensagem)`; reindexação importa só o novo
  - _Req 6_

- [x] 6. Cache em disco
  - Armazenamento de segmentos por capítulo em `CACHE_DIR`
  - Política LRU com teto `CACHE_MAX_BYTES` e remoção dos menos usados
  - _Req 8_

- [x] 7. Endpoint de streaming com Range
  - `/api/stream/[episodeId]` com resposta 206 e cabeçalhos corretos
  - Buscar segmentos no cache; em falta, baixar do Telegram por offset e cachear
  - Renovar `file_reference` expirado; exigir sessão logada
  - _Req 4, 7, 8_

- [x] 8. Front-end: catálogo (home)
  - Layout global (tema escuro estilo Netflix) + navegação + busca
  - Fileiras de séries com capas e fileira "Continuar assistindo"
  - _Req 2, 5_

- [x] 9. Front-end: página da série
  - Seletor de temporadas e lista de capítulos em ordem
  - Indicador de progresso e miniatura/duração por capítulo
  - _Req 3, 5_

- [x] 10. Front-end: player e progresso
  - Página de player com `<video>` apontando para o endpoint de streaming
  - Salvar posição periodicamente, retomar de onde parou, sugerir próximo capítulo
  - _Req 4, 5_

- [x] 11. Painel de administração
  - Proteção por papel ADMIN
  - Importar canal (dispara indexação), editar série (nome/descrição/capa)
  - Reordenar capítulos, mover entre temporadas, ocultar/exibir
  - _Req 9_

- [x] 12. Empacotamento e implantação (Oracle Cloud grátis)
  - Dockerfile de produção e `docker-compose` (app + Caddy com HTTPS automático)
  - Configuração de subdomínio grátis (DuckDNS) e variáveis de ambiente
  - Guia passo a passo (clique-a-clique) de deploy na VM Oracle Always Free
  - _Req 10_

- [x] 13. Verificação final
  - `next build` sem erros e checagem de tipos
  - Checklist do que depende das credenciais do usuário (login Telegram, canais)
  - Fluxo ponta a ponta documentado
  - _Req 1-10_
