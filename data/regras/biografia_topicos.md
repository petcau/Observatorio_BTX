# Regras do campo `biografia_topicos`

Resumo da biografia em tópicos, feito pela IA dentro do chat.
Ferramenta: `node data/ferramentas/resumos.js topicos lote 25` → escrever → `node data/ferramentas/resumos.js topicos gravar <arquivo.json>`.
Formato do arquivo: `[ { "id": "...", "topicos": ["...", "..."] } ]`.

## Formato
- Até **600 caracteres no total**, contando o "• " de cada tópico e as quebras de linha (a ferramenta recusa acima disso).
- Um tópico por linha; em geral 5 a 8 tópicos.
- **Ordem do texto:** os tópicos seguem a sequência em que as informações aparecem na biografia.
- Um assunto por tópico; se o texto volta a um assunto, juntar no tópico onde ele apareceu primeiro.
- Frases curtas, sem repetir o nome da pessoa ("Doutora em Educação (UFBA)").
- Usar o gênero da própria biografia. Escrever em português, mesmo se a biografia estiver em outra língua.
- Nada inventado: só o que está escrito na biografia.

## Como caber em 600 caracteres
**Primeiro condensar:**
- Escrita enxuta: "Doutora em Educação (UFBA)" em vez de "Possui doutorado em Educação pela Universidade Federal da Bahia".
- Siglas das instituições (UFBA, CNPq, CAPES…).
- Formação num tópico só: "Médico, mestre em Saúde Comunitária, PhD em Epidemiologia".
- Tirar anos e detalhes secundários; manter os que contam (período como reitor, ano de prêmio).
- Resumir listas: "Visitante em Harvard, Berkeley e Montreal".

**Se ainda não couber, cortar nesta ordem (o que sai primeiro):**
1. Contatos, e-mails, telefones, links, ORCID (saem sempre)
2. Trechos pessoais e narrativos
3. Formações complementares e cursos curtos
4. Listas de disciplinas, bancas, eventos e orientações uma a uma
5. Cargos antigos e intermediários (colegiados, comissões)

**Nunca sai:**
1. Titulação mais alta e área
2. Instituição e cargo atual
3. Temas de pesquisa
4. Liderança de grupos/laboratórios/programas e bolsa de produtividade do CNPq
5. Prêmios e reconhecimentos, livros e patentes de destaque
6. Cargos de gestão de peso (reitor, pró-reitor, diretor, presidente de associação)

## Ordem dos lotes (definida no pipeline)
Faixa de classificação (A+, A, B+, B, C+, C, D+, D, E+, E) → titulação → nº de artigos → tamanho da biografia.
Lotes de 25. Lista em `data/cache/biografia_topicos_pendentes.json` (campo `lote`).
