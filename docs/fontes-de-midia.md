# Vídeo do episódio: o que funciona e o que não funciona

Este arquivo é a resposta honesta para "que tipo de link o Yōkira aceita?". Ele existe
porque a pergunta tem quatro respostas diferentes, e prometer uma só seria mentira.

## As quatro origens

| Origem                  | O que é                                        | O servidor baixa?        | Player      |
| ----------------------- | ---------------------------------------------- | ------------------------ | ----------- |
| **Arquivo enviado**     | Você manda o arquivo do computador             | Sim, e converte para HLS | Nosso       |
| **Link direto**         | Endereço que devolve o arquivo de vídeo        | Não                      | Nosso       |
| **Playlist HLS remota** | Endereço de um `.m3u8` que já existe na origem | Não                      | Nosso       |
| **YouTube / Vimeo**     | Endereço de uma página de vídeo do provedor    | Não                      | Do provedor |

A regra que separa as duas do meio da primeira: **link que a origem já sabe servir não é
copiado**. Só cai no download e na conversão o que o navegador não tocaria — um `.mkv`,
por exemplo.

## O que é verificado ao colar um link

O botão **Verificar vídeo** abre o endereço no servidor e olha, nesta ordem de confiança:

1. **Os primeiros bytes do corpo.** É o sinal mais forte. A caixa `ftyp` de um MP4, o
   cabeçalho EBML do Matroska, a primeira linha `#EXTM3U` de uma playlist.
2. **O `content-type`.** Vale quando os bytes não disseram nada.
3. **A extensão do caminho.** Último recurso, e por bom motivo: extensão mente nos dois
   sentidos. Um `.mp4` que devolve página de login é o caso mais comum de "o link não
   funciona"; um endereço assinado sem extensão nenhuma costuma ser vídeo válido.

Além do formato, a verificação confere:

- **Status da resposta**, com os redirecionamentos seguidos à mão (no máximo 4).
- **Corpo vazio**, que vence o `content-type`: quem anuncia vídeo e não entrega nada não
  tem vídeo.
- **Playlist mestre**: abre também a qualidade mais leve. Playlist que lista qualidades
  cujos endereços não respondem é o defeito que só aparece no play.
- **`accept-ranges`**: sem ele, avançar o vídeo pode ficar lento, e isso vira aviso.
- **`access-control-allow-origin`** nas playlists: sem ele, alguns navegadores recusam.
- **Endereço com prazo** (`X-Amz-Expires`, `token`, `signature`): vira aviso de que o
  episódio para de tocar quando o endereço vencer.
- **YouTube e Vimeo**: pergunta ao próprio provedor, pelo oEmbed oficial, se aquele vídeo
  pode ser incorporado. Vídeo privado, apagado ou com incorporação bloqueada é recusado
  antes de virar episódio.

O veredito tem quatro estados: **Vídeo pronto**, **Precisa converter**, **Indisponível** e
**Não dá para usar**. Cada um diz o que aconteceu e o que dá para fazer.

## Verificar não é reproduzir

O servidor diz que o endereço responde e que o formato é conhecido. Ele **não** diz que o
vídeo vai tocar no navegador de quem assiste. Codec recusado, DRM, CORS e bloqueio de
incorporação só aparecem no cliente.

Por isso a tela mostra as duas coisas separadas: o veredito do servidor e uma **prévia**
que roda neste navegador. A prévia diz "aberta neste navegador" — não "vai funcionar para
todo mundo".

## O que a proteção contra SSRF barra

Quem abre a conexão é o servidor, então o endereço colado é uma porta para dentro da
infraestrutura. O que está fechado:

- Só `http` e `https`.
- O nome é resolvido e **todos** os IPs conferidos: basta um interno para recusar.
- O IP validado é **fixado** na conexão. Sem isso, o nome poderia mudar de destino entre a
  checagem e a conexão (DNS rebinding).
- Faixas recusadas: loopback, privadas (10, 172.16/12, 192.168), CGNAT, link-local
  (incluindo `169.254.169.254`, onde mora o metadado de nuvem), multicast, reservadas, e
  as mesmas em IPv6 — inclusive IPv4 disfarçado (`::ffff:127.0.0.1`).
- **Cada salto** de redirecionamento passa pela mesma validação.
- Tempo limite, teto de bytes lidos e teto de verificações simultâneas por pessoa.
- Nenhuma credencial do site vai junto no pedido a terceiro.

Não existe atalho de configuração para desligar isso. Os testes que precisam de resposta
controlada injetam o transporte (`testes/unitarios/verificar-fonte.teste.ts`); os que
precisam de rede de verdade usam endereços públicos e são pulados sem internet.

## O que a gente não promete

- **Nem todo link vai funcionar.** CORS, codec, DRM, login na origem, bloqueio de
  incorporação e endereço vencido impedem a reprodução, e alguns só se descobrem no play.
- **Controles de terceiro não são os nossos.** Num vídeo do YouTube ou do Vimeo, quem manda
  na qualidade, na retomada e nos atalhos é o player deles. A moldura é nossa; o resto,
  não. A tela diz isso em vez de fingir o contrário.
- **Não contornamos proteção de provedor.** Se a origem bloqueia, a saída é outro link ou
  o arquivo.
- **Endereço com prazo vence.** Quando vencer, o episódio para. A fonte fica gravada com o
  aviso e dá para revalidar sem apagar nada.

## Trocar de origem

Um episódio pode ter várias origens gravadas, e só uma no ar. Trocar é um clique e **não
apaga** a anterior — dá para testar um link novo sem perder o vídeo que já funcionava.
Remover a que está no ar é recusado: primeiro ative outra.

Quem assiste também escolhe, quando há mais de uma pronta. A troca interrompe a anterior
antes de montar a nova e tenta manter o ponto onde o vídeo estava.

## Fila de conversão

Arquivo enviado entra numa fila com estado no banco, com dono (`executor`) e prazo
(`leaseAte`). Se o processo cair no meio, o prazo vence e outro executor retoma o trabalho
— até três tentativas. É o que evita o episódio preso em "sendo preparado" para sempre.

A fonte nova **só entra no ar quando a conversão termina**. Enquanto isso, o vídeo antigo
continua tocando.

Hoje o trabalhador roda dentro do processo web, o que serve para uma instalação só. A fila
já foi escrita para aguentar um processo separado lendo a mesma tabela; veja o README.
