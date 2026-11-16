#!/usr/bin/env node
"use strict";

// Gera apenas arquivos e cache isolados do Codex para a faixa E.
// Não incorpora resultados ao cache principal e não executa o pipeline.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const DATA = path.resolve(__dirname, "..");
const BASE = path.join(DATA, "pesquisadores.json");
const CACHE_PRINCIPAL = path.join(DATA, "cache", "biografia_topicos.json");
const CACHE_CODEX = path.join(DATA, "cache", "biografia_topicos_codex_E.json");
const HELPER = path.join(__dirname, "resumos_codex_e.js");
const PESO = { "Pós-Doutorado": 5, Doutorado: 4, Mestrado: 3, "Especialização": 2, Graduação: 1 };

const ler = (arquivo, padrao) => {
  try { return JSON.parse(fs.readFileSync(arquivo, "utf8")); }
  catch { return padrao; }
};
const limpa = (texto) => String(texto || "").replace(/\s+/g, " ").trim();
const hash = (texto) => crypto.createHash("sha1").update(limpa(texto)).digest("hex").slice(0, 12);
const tamanho = (topicos) => topicos.map((t) => `• ${t}`).join("\n").length;
const valido = (cache, r) => Boolean(cache[r.id] && cache[r.id].hash === hash(r.biografia) && cache[r.id].topicos?.length);

const siglas = [
  [/Universidade Federal da Bahia/gi, "UFBA"],
  [/Universidade Estadual da Bahia/gi, "UNEB"],
  [/Universidade do Estado da Bahia/gi, "UNEB"],
  [/Universidade Estadual de Feira de Santana/gi, "UEFS"],
  [/Universidade Estadual do Sudoeste da Bahia/gi, "UESB"],
  [/Universidade Estadual de Santa Cruz/gi, "UESC"],
  [/Universidade Federal do Recôncavo da Bahia/gi, "UFRB"],
  [/Universidade Federal do Sul da Bahia/gi, "UFSB"],
  [/Universidade Federal do Oeste da Bahia/gi, "UFOB"],
  [/Universidade Federal de Pernambuco/gi, "UFPE"],
  [/Universidade Federal da Paraíba/gi, "UFPB"],
  [/Universidade Federal do Rio de Janeiro/gi, "UFRJ"],
  [/Universidade Federal de Minas Gerais/gi, "UFMG"],
  [/Universidade Federal de São Carlos/gi, "UFSCar"],
  [/Universidade Federal de Mato Grosso do Sul/gi, "UFMS"],
  [/Universidade Federal de Mato Grosso/gi, "UFMT"],
  [/Universidade Federal do Paraná/gi, "UFPR"],
  [/Universidade Federal do Ceará/gi, "UFC"],
  [/Universidade Federal de Campina Grande/gi, "UFCG"],
  [/Universidade de São Paulo/gi, "USP"],
  [/Universidade Estadual de Campinas/gi, "Unicamp"],
  [/Pontifícia Universidade Católica de São Paulo/gi, "PUC-SP"],
  [/Instituto Federal de Educação, Ciência e Tecnologia da Bahia/gi, "IFBA"],
  [/Instituto Federal de Educação, Ciência e Tecnologia Baiano/gi, "IF Baiano"],
  [/Coordenação de Aperfeiçoamento de Pessoal de Nível Superior/gi, "CAPES"],
];

function enxuga(texto) {
  let t = limpa(texto)
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\(http[^)]*\)|https?:\/\/\S+|\S+@\S+/gi, "")
    .replace(/^(?:O|A) pesquisador(?:a)?\s+/i, "")
    .replace(/^Possui graduação em /i, "Graduação em ")
    .replace(/^possui bacharelado em /i, "Bacharelado em ")
    .replace(/^Tem experiência na área de /i, "Experiência em ")
    .replace(/^Tem experiência nas (?:seguintes )?áreas(?: de)?:? /i, "Experiência em ")
    .replace(/^Atualmente,? (?:é|exerce o cargo de) /i, "Atualmente, ")
    .replace(/^Também atua /i, "Atua também ")
    .replace(/^Meus principais interesses de pesquisa incluem /i, "Pesquisa ")
    .replace(/^Minha especialidade abrange /i, "Especialidade em ")
    .replace(/^Tem experiência em /i, "Experiência em ")
    .replace(/^Tem formação /i, "Formação ")
    .replace(/\s*\.\s*$/, "");
  for (const [de, para] of siglas) t = t.replace(de, para);
  t = t
    .replace(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁ-ú.-]+)\s*\(\1\)/g, "$1")
    .replace(/\b(UNICAMP|UFBA|UNEB|UEFS|UESB|UESC|UFRB|UFSB|UFOB|UFPE|UFPB|UFRJ|UFMG|UFSCar|UFMS|UFMT|UFPR|UFC|UFCG|USP)\s*[-/]\s*\1\b/g, "$1");
  t = limpa(t);
  return t ? t[0].toLocaleUpperCase("pt-BR") + t.slice(1) : t;
}

function separar(texto, nome) {
  const nomeEscapado = String(nome || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let origem = limpa(texto).replace(/&#10;|&#13;|<br\s*\/?\s*>/gi, ". ");
  if (nomeEscapado) origem = origem.replace(new RegExp(nomeEscapado, "gi"), "").replace(/^\s*[,;-]\s*/, "");
  const base = origem
    .replace(/([.!?])(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g, "$1 ")
    .split(/(?<=[.!?])\s+/)
    .flatMap((p) => p.length > 230 ? p.split(/;\s+|,\s+(?=(?:atuando|com ênfase|onde|tendo|além|bem como)\b)/i) : [p])
    .map(enxuga)
    .filter((p) => p.length > 2 && !/^(?:contato|e-mail|email|lattes|orcid)\b/i.test(p));

  const topicos = [];
  for (const parte of base) {
    if (parte.length <= 260) topicos.push(parte);
    else {
      const pedacos = parte.split(/,\s+(?=(?:atuando|pesquisando|com experiência|com foco|principalmente|além disso)\b)/i).map(enxuga).filter(Boolean);
      topicos.push(...pedacos);
    }
  }
  return topicos;
}

function pontua(topico) {
  let p = 1;
  if (/doutor|mestr|graduad|bacharel|licenciad|especializa/i.test(topico)) p += 15;
  if (/atualmente|professor efetiv|docente atual|cargo atual/i.test(topico)) p += 25;
  else if (/professor|docente|pesquisador|técnic|artista|médic|psicólog/i.test(topico)) p += 14;
  if (/pesquis|linha|interesse|tema|ênfase|experiência|atua em/i.test(topico)) p += 13;
  if (/coordena|diretor|lider|grupo|laboratório|programa|pró-reitor|reitor/i.test(topico)) p += 11;
  if (/prêmio|premiad|livro|patente|obra|reconhec|bolsa de produtividade/i.test(topico)) p += 10;
  if (/ministrou|participou|integrou|colaborou|consultor|extensão/i.test(topico)) p += 4;
  if (/^(?:foi|participou|atuou|ministrou|trabalhou|realizou)/i.test(topico)) p -= 3;
  if (/contato|e-mail|email|telefone|http|orcid/i.test(topico)) p -= 100;
  return p;
}

function encurta(topico, maximo = 175) {
  let t = enxuga(topico)
    .replace(/sob (?:a )?orientação[^,;.]+/gi, "")
    .replace(/(?:Professor|Professora) Dr\.?[aª]?\.?\s+[^,;.]+/gi, "")
    .replace(/\s*\((?:19|20)\d{2}(?:[-–/]\d{2,4})?\)/g, "")
    .replace(/atuando principalmente nos seguintes temas:?/gi, "Temas:")
    .replace(/tem experiência na área de/gi, "Experiência em");
  if (t.length <= maximo) return enxuga(t);
  const cortes = [...t.matchAll(/[,;:]\s+/g)].map((m) => m.index).filter((n) => n >= 90 && n <= maximo);
  const corte = cortes.length ? cortes[cortes.length - 1] : t.lastIndexOf(" ", maximo);
  let limite = corte > 80 ? corte : t.lastIndexOf(" ", maximo);
  if (limite < 50) limite = maximo;
  let curto = enxuga(t.slice(0, limite));
  curto = curto.replace(/\s+\b(?:de|da|do|das|dos|em|na|no|nas|nos|com|e|ou|para|pela|pelo|sob)\s*$/i, "");
  return enxuga(curto);
}

function selecionar(topicos) {
  const itens = topicos.map((texto, indice) => ({ indice, texto: encurta(texto), pontos: pontua(texto) })).filter((x) => x.texto);
  const escolhidos = new Set();
  const reservar = (regex) => {
    const candidatos = itens.filter((x) => regex.test(x.texto));
    candidatos.sort((a, b) => b.pontos - a.pontos || a.indice - b.indice);
    if (candidatos[0]) escolhidos.add(candidatos[0].indice);
  };
  reservar(/doutor|mestr|graduad|bacharel|licenciad/i);
  reservar(/atualmente|professor efetiv|docente|pesquisador|técnic|artista|médic|psicólog/i);
  reservar(/pesquis|linha|interesse|tema|ênfase|experiência|atua em/i);
  reservar(/coordena|diretor|lider|grupo|laboratório|programa|pró-reitor|reitor/i);
  reservar(/prêmio|premiad|livro|patente|obra|reconhec/i);
  const ordem = [...itens].sort((a, b) => b.pontos - a.pontos || a.indice - b.indice);
  for (const item of ordem) {
    if (escolhidos.size >= 8) break;
    const tentativa = itens.filter((x) => escolhidos.has(x.indice) || x.indice === item.indice).sort((a, b) => a.indice - b.indice).map((x) => x.texto);
    if (tamanho(tentativa) <= 595 || escolhidos.size < 5) escolhidos.add(item.indice);
  }
  let saida = itens.filter((x) => escolhidos.has(x.indice)).sort((a, b) => a.indice - b.indice).map((x) => x.texto);
  while (tamanho(saida) > 600) {
    const indice = saida.reduce((maior, t, i) => t.length > saida[maior].length ? i : maior, 0);
    const novoMaximo = Math.max(75, saida[indice].length - (tamanho(saida) - 595));
    const novo = encurta(saida[indice], novoMaximo);
    if (novo === saida[indice] && saida.length > 5) saida.splice(indice, 1);
    else if (novo === saida[indice]) {
      const limite = saida[indice].lastIndexOf(" ", Math.max(40, novoMaximo - 10));
      saida[indice] = saida[indice].slice(0, limite > 30 ? limite : Math.max(40, novoMaximo - 10)).replace(/\s+\b(?:de|da|do|das|dos|em|na|no|nas|nos|com|e|ou|para|pela|pelo|sob)\s*$/i, "");
    }
    else saida[indice] = novo;
  }
  return saida;
}

function ajustar(topicos) {
  let saida = topicos.map(enxuga).filter(Boolean);
  const substituicoes = [
    [/Possui /gi, ""],
    [/Atualmente /gi, ""],
    [/ na área de /gi, " em "],
    [/atuando principalmente nos seguintes temas:? /gi, "atua em "],
    [/atuando principalmente em /gi, "atua em "],
    [/com ênfase em /gi, "com foco em "],
    [/Professor(?:a)? (?:Adjunto|Associado|Titular)(?:a)?(?: [IVX]+)? da /g, (m) => m.replace(/ (?:Adjunto|Associado|Titular)(?:a)?(?: [IVX]+)?/, "")],
    [/\s*\((?:19|20)\d{2}\)/g, ""],
  ];
  for (const [de, para] of substituicoes) {
    if (tamanho(saida) <= 595) break;
    saida = saida.map((t) => enxuga(t.replace(de, para)));
  }
  if (tamanho(saida) > 600 || saida.length > 8) saida = selecionar(saida);
  return saida;
}

function pendentes() {
  const principal = ler(CACHE_PRINCIPAL, {});
  const codex = ler(CACHE_CODEX, {});
  const base = ler(BASE, {}).data || [];
  return base.filter((r) => r.classificacao === "E" && limpa(r.biografia))
    .filter((r) => !valido(principal, r) && !valido(codex, r))
    .sort((a, b) => (PESO[b.graduacao] || 0) - (PESO[a.graduacao] || 0) ||
      (Number(b.artigos) || 0) - (Number(a.artigos) || 0) || limpa(b.biografia).length - limpa(a.biografia).length);
}

const inicio = Number(process.argv[2] || 49);
const quantidadeLotes = Number(process.argv[3] || 1);
for (let passo = 0; passo < quantidadeLotes; passo += 1) {
  const numero = inicio + passo;
  const registros = pendentes().slice(0, 25);
  if (!registros.length) break;
  const lote = registros.map((r) => ({ id: r.id, topicos: ajustar(separar(r.biografia, r.nome)) }));
  const arquivo = path.join(DATA, "cache", `topicos_codex_E_lote_${String(numero).padStart(4, "0")}.json`);
  fs.writeFileSync(arquivo, `${JSON.stringify(lote, null, 1)}\n`);
  const resultado = spawnSync(process.execPath, [HELPER, "gravar", arquivo], { encoding: "utf8" });
  process.stdout.write(resultado.stdout);
  process.stderr.write(resultado.stderr);
  if (resultado.status) process.exit(resultado.status);
  console.log(`lote ${String(numero).padStart(4, "0")}: ${lote.length} registros, máximo ${Math.max(...lote.map((x) => tamanho(x.topicos)))} caracteres`);
}
