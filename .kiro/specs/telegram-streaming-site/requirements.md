# Requisitos - Site de Streaming (estilo Netflix) com vídeos do Telegram

## Introdução

O objetivo é criar um site de streaming de vídeo no estilo Netflix, aberto ao público
mas com login individual, para assistir a séries cujos episódios estão hospedados em
canais/grupos do Telegram (mais de 500 vídeos de ~1h cada).

Cada grupo/canal do Telegram corresponde a uma série, e a ordem das mensagens com vídeo
dentro do canal define a sequência dos episódios (ep 1, 2, 3...).

Os vídeos permanecem armazenados no Telegram. O site acessa esses vídeos via MTProto
(a API de cliente do Telegram, que suporta arquivos grandes e download por pedaços),
faz streaming sob demanda para o navegador e guarda cópias em cache para reduzir a
carga sobre o Telegram.

### Stack definida
- **Linguagem:** TypeScript
- **Front-end + API:** Next.js (App Router) + Tailwind CSS
- **Login/sessão:** Auth.js (NextAuth)
- **Banco de dados:** SQLite (via Prisma ORM) — arquivo único, sem custo e sem
  servidor de banco separado; suficiente para a carga de leitura deste site. Poderá
  ser migrado para PostgreSQL futuramente se necessário.
- **Integração com Telegram:** GramJS (MTProto)
- **Player:** vídeo HTML5 com suporte a HTTP Range (permite adiantar/voltar)
- **Empacotamento:** Docker / Docker Compose (para instalação guiada por quem não programa)

### Decisão de hospedagem (custo-alvo: R$0)
- O site será implantado em uma **VM Oracle Cloud "Always Free"** (2 OCPU / 12GB RAM,
  200GB de disco, cota mensal de tráfego generosa), que é gratuita de forma permanente
  e, ao contrário de CDNs gratuitas, não restringe entrega de vídeo.
- Justificativa: hosts "fáceis" (Railway/Render) não são gratuitos para servidor
  sempre ligado, e CDNs gratuitas (ex.: Cloudflare) proíbem streaming de vídeo em
  planos gratuitos.
- O cache de vídeo usará o disco de 200GB da própria VM.
- Alternativa paga e mais simples (~US$5/mês): Railway plano Hobby.
- Alternativa gratuita: auto-hospedagem em máquina própria (limitada pelo upload da
  internet residencial).

### Estrutura de conteúdo (confirmada)
- Cada **canal do Telegram** contém uma sequência de capítulos (ex.: canal
  "malhacao 1995" com 179 capítulos numerados 1, 2, 3...).
- Uma **série** pode agrupar vários canais como **temporadas** (ex.: série "Malhação"
  com temporadas "1995", "1998", "2000", cada uma vinda de um canal).
- Séries avulsas (um único canal) são representadas como uma série com uma temporada.
- Mapeamento adotado: **1 canal = 1 temporada**; **1 mensagem com vídeo = 1 capítulo**,
  numerado pela ordem no canal.
- O sistema deve tentar sugerir automaticamente o nome da série e o rótulo da temporada
  a partir do nome do canal (ex.: "malhacao 1995" -> série "Malhação", temporada "1995").

## Requisitos

### Requisito 1 - Cadastro e login de usuários
**História de usuário:** Como visitante, quero criar uma conta e fazer login, para que
o site lembre em qual episódio eu parei.

#### Critérios de aceitação
1. QUANDO um visitante acessa o site sem estar logado ENTÃO o sistema DEVE permitir
   navegar pelo catálogo, mas DEVE exigir login para dar play em um episódio.
2. QUANDO um visitante se cadastra com e-mail e senha ENTÃO o sistema DEVE criar uma
   conta e iniciar a sessão.
3. QUANDO um usuário faz login com credenciais válidas ENTÃO o sistema DEVE autenticá-lo
   e manter a sessão ativa entre visitas.
4. QUANDO um usuário faz login com credenciais inválidas ENTÃO o sistema DEVE recusar o
   acesso e exibir uma mensagem de erro clara.
5. O sistema DEVE armazenar as senhas de forma segura (hash), nunca em texto puro.

### Requisito 2 - Catálogo estilo Netflix
**História de usuário:** Como usuário, quero ver todas as séries em uma tela inicial
visual, para escolher o que assistir.

#### Critérios de aceitação
1. QUANDO um usuário acessa a página inicial ENTÃO o sistema DEVE exibir as séries em
   fileiras com miniaturas/capas, no estilo Netflix.
2. QUANDO existem muitas séries ENTÃO o sistema DEVE permitir rolar e navegar sem travar.
3. QUANDO um usuário clica em uma série ENTÃO o sistema DEVE abrir a página da série com
   a lista de episódios.
4. O sistema DEVE oferecer um campo de busca por nome de série.

### Requisito 3 - Página da série e lista de episódios
**História de usuário:** Como usuário, quero ver os episódios de uma série em ordem,
para assistir na sequência certa.

#### Critérios de aceitação
1. QUANDO um usuário abre uma série ENTÃO o sistema DEVE listar os episódios numerados na
   ordem correta (ep 1, 2, 3...).
2. QUANDO uma série tem mais de uma temporada ENTÃO o sistema DEVE permitir alternar entre
   temporadas.
3. QUANDO um episódio já foi assistido parcialmente ENTÃO o sistema DEVE indicar o
   progresso visualmente (barra de progresso).
4. QUANDO um episódio possui miniatura e duração ENTÃO o sistema DEVE exibi-las.

### Requisito 4 - Reprodução com streaming do Telegram
**História de usuário:** Como usuário, quero dar play em um episódio e conseguir avançar
e voltar o vídeo, para assistir confortavelmente.

#### Critérios de aceitação
1. QUANDO um usuário logado dá play em um episódio ENTÃO o sistema DEVE transmitir o vídeo
   correspondente que está armazenado no Telegram.
2. QUANDO um usuário adianta ou volta o vídeo (seek) ENTÃO o sistema DEVE responder a
   requisições HTTP Range e entregar apenas o trecho solicitado.
3. QUANDO o vídeo está sendo transmitido ENTÃO o sistema DEVE começar a reprodução sem
   precisar baixar o arquivo inteiro antes.
4. QUANDO um usuário não está logado e tenta acessar o endpoint de streaming diretamente
   ENTÃO o sistema DEVE negar o acesso.

### Requisito 5 - Continuar assistindo (progresso por usuário)
**História de usuário:** Como usuário, quero que o site salve onde parei, para retomar de
onde parei em qualquer episódio.

#### Critérios de aceitação
1. ENQUANTO um usuário assiste a um episódio O sistema DEVE salvar periodicamente a
   posição atual de reprodução.
2. QUANDO um usuário volta a um episódio começado ENTÃO o sistema DEVE retomar a partir da
   posição salva.
3. QUANDO um usuário termina um episódio ENTÃO o sistema DEVE marcá-lo como assistido.
4. QUANDO um usuário acessa a página inicial ENTÃO o sistema DEVE exibir uma fileira
   "Continuar assistindo" com os episódios em andamento.
5. QUANDO um usuário termina um episódio E existe um próximo ENTÃO o sistema DEVE sugerir
   ou iniciar o próximo episódio.

### Requisito 6 - Indexação dos canais do Telegram
**História de usuário:** Como administrador, quero importar automaticamente os vídeos dos
meus canais, para não precisar cadastrar 500 episódios na mão.

#### Critérios de aceitação
1. QUANDO o administrador informa um canal/grupo ENTÃO o sistema DEVE ler o histórico de
   mensagens e identificar todas as que contêm vídeo.
2. QUANDO o sistema lê os vídeos de um canal ENTÃO ele DEVE registrar, para cada um,
   uma referência ao Telegram (identificadores da mensagem e do arquivo), o tamanho, a
   duração e a miniatura, quando disponíveis.
3. QUANDO os vídeos são importados ENTÃO o sistema DEVE numerá-los como episódios na ordem
   em que aparecem no canal.
4. QUANDO a indexação roda novamente ENTÃO o sistema DEVE importar apenas os vídeos novos,
   sem duplicar os já existentes.
5. SE uma mensagem tiver legenda ENTÃO o sistema DEVE guardá-la como possível título do
   episódio.

### Requisito 7 - Integração segura com o Telegram (MTProto)
**História de usuário:** Como administrador, quero conectar minha conta do Telegram uma
única vez de forma segura, para que o site consiga acessar os vídeos.

#### Critérios de aceitação
1. O sistema DEVE autenticar no Telegram usando MTProto com credenciais de API
   (api_id/api_hash) e uma sessão salva de forma segura.
2. O sistema DEVE tratar as credenciais e a sessão do Telegram como segredos, nunca
   expondo-as no front-end nem no versionamento do código.
3. QUANDO o Telegram limitar as requisições (FLOOD_WAIT) ENTÃO o sistema DEVE aguardar e
   tentar novamente de forma controlada, sem derrubar a aplicação.
4. O sistema DEVE fornecer um passo de configuração guiado para gerar a sessão do Telegram
   (adequado para quem não programa).

### Requisito 8 - Cache dos vídeos
**História de usuário:** Como dono do site, quero que os vídeos assistidos fiquem em
cache, para reduzir o risco de bloqueio pelo Telegram e deixar a reprodução mais rápida.

#### Critérios de aceitação
1. QUANDO um trecho de vídeo é transmitido do Telegram pela primeira vez ENTÃO o sistema
   DEVE armazená-lo em cache.
2. QUANDO um trecho já está em cache ENTÃO o sistema DEVE servi-lo do cache em vez de
   buscar no Telegram novamente.
3. QUANDO o espaço de cache atinge um limite configurado ENTÃO o sistema DEVE remover os
   itens menos usados.

### Requisito 9 - Painel de administração
**História de usuário:** Como administrador, quero organizar séries, temporadas e
episódios, para corrigir títulos, capas e a ordem quando necessário.

#### Critérios de aceitação
1. QUANDO o administrador acessa o painel ENTÃO o sistema DEVE exigir permissão de
   administrador.
2. O administrador DEVE poder editar o nome, a descrição e a capa de uma série.
3. O administrador DEVE poder reordenar episódios e movê-los entre temporadas.
4. O administrador DEVE poder ocultar ou exibir uma série ou episódio no catálogo.
5. O administrador DEVE poder disparar a indexação de um canal a partir do painel.

### Requisito 10 - Implantação e operação
**História de usuário:** Como dono do site (que não programa), quero conseguir colocar o
site no ar e mantê-lo funcionando sem precisar programar.

#### Critérios de aceitação
1. O sistema DEVE rodar em uma plataforma com servidor persistente adequada a streaming.
2. O sistema DEVE incluir instruções passo a passo de configuração e implantação.
3. O sistema DEVE usar variáveis de ambiente para todas as configurações sensíveis.
4. QUANDO ocorre um erro em produção ENTÃO o sistema DEVE registrar logs úteis para
   diagnóstico.
