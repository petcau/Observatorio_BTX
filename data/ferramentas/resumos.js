#!/usr/bin/env node
/*
 * Ferramenta dos resumos feitos pela IA dentro do chat.
 *
 * Dois tipos de resumo:
 *   - abstract_ai        → texto corrido, até 900 caracteres
 *   - biografia_topicos  → tópicos na ordem do texto, até 600 caracteres (prefixo "topicos")
 *                          regras de escrita: data/regras/biografia_topicos.md
 *
 *   node data/ferramentas/resumos.js [topicos] status
 *       Mostra quantos resumos já existem e quantos faltam.
 *
 *   node data/ferramentas/resumos.js [topicos] lote [quantidade]
 *       Mostra o próximo lote de biografias pendentes (padrão: 10), as mais longas primeiro,
 *       e grava o lote em data/cache/lote_resumos.json (para conferência).
 *
 *   node data/ferramentas/resumos.js gravar <arquivo.json>
 *       abstract_ai: lista [ { "id": "...", "resumo": "..." }, ... ]
 *   node data/ferramentas/resumos.js topicos gravar <arquivo.json>
 *       biografia_topicos: lista [ { "id": "...", "topicos": ["...", "..."] }, ... ]
 *       O total ("• tópico" por linha) precisa ter até 600 caracteres.
 *
 * Depois de gravar, rode o pipeline (node data/atualizar_dados.js) para aplicar.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA = path.resolve(__dirname, "..");
const BASE = path.join(DATA, "pesquisadores.json");
const LOTE = path.join(DATA, "cache", "lote_resumos.json");

const MODOS = {
  abstract: {
    cache: path.join(DATA, "cache", "abstract_ai.json"),
    pendentes: path.join(DATA, "cache", "abstract_ai_pendentes.json"),
    limite: 900,
  },
  topicos: {
    cache: path.join(DATA, "cache", "biografia_topicos.json"),
    pendentes: path.join(DATA, "cache", "biografia_topicos_pendentes.json"),
    limite: 600,
  },
};

const lerJSON = (f, padrao) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return padrao; } };
const limpa = (t) => String(t || "").replace(/\s+/g, " ").trim();
const digital = (t) => crypto.createHash("sha1").update(limpa(t)).digest("hex").slice(0, 12);
const juntarTopicos = (lista) => lista.map((t) => `• ${t}`).join("\n");

function biografias() {
  const base = lerJSON(BASE, null);
  if (!base) throw new Error("pesquisadores.json não encontrado: rode o pipeline primeiro.");
  return new Map(base.data.map((r) => [r.id, r]));
}

function status(modo) {
  const cache = lerJSON(modo.cache, {});
  const pend = lerJSON(modo.pendentes, { total: 0, pendentes: [] });
  console.log(`resumos no cache: ${Object.keys(cache).length}`);
  console.log(`pendentes (na última execução do pipeline): ${pend.total}`);
  if (pend.pendentes.length) console.log(`próximo: ${pend.pendentes[0].nome} (${pend.pendentes[0].tamanho} caracteres)`);
}

function lote(modo, qtd) {
  const cache = lerJSON(modo.cache, {});
  const pend = lerJSON(modo.pendentes, { pendentes: [] }).pendentes;
  const base = biografias();
  const escolhidos = [];
  for (const p of pend) {
    if (escolhidos.length >= qtd) break;
    const r = base.get(p.id);
    if (!r) continue;
    const bio = limpa(r.biografia);
    const salvo = cache[p.id];
    if (salvo && salvo.hash === digital(bio)) continue; // já feito depois da última execução
    escolhidos.push({ id: r.id, nome: r.nome, classificacao: r.classificacao || "", tamanho: bio.length, biografia: bio });
  }
  fs.writeFileSync(LOTE, JSON.stringify(escolhidos, null, 1));
  for (const e of escolhidos) {
    console.log(`\n### id: ${e.id}\n### nome: ${e.nome} [${e.classificacao}] (${e.tamanho} caracteres)\n${e.biografia}`);
  }
  console.log(`\n${escolhidos.length} biografias no lote (gravado em data/cache/lote_resumos.json)`);
}

function gravar(modo, nomeModo, arquivo) {
  const novos = lerJSON(arquivo, null);
  if (!Array.isArray(novos)) throw new Error("O arquivo precisa ser uma lista.");
  const cache = lerJSON(modo.cache, {});
  const base = biografias();
  let ok = 0;
  const problemas = [];
  for (const item of novos) {
    const r = base.get(item.id);
    if (!r) { problemas.push(`${item.id}: id não encontrado`); continue; }
    const registro = { hash: digital(r.biografia), gerado_em: new Date().toISOString() };
    let tamanho;
    if (nomeModo === "topicos") {
      const topicos = (Array.isArray(item.topicos) ? item.topicos : []).map(limpa).filter(Boolean);
      if (!topicos.length) { problemas.push(`${item.id}: sem tópicos`); continue; }
      tamanho = juntarTopicos(topicos).length;
      registro.topicos = topicos;
    } else {
      const texto = limpa(item.resumo);
      if (!texto) { problemas.push(`${item.id}: resumo vazio`); continue; }
      tamanho = texto.length;
      registro.resumo = texto;
    }
    if (tamanho > modo.limite) { problemas.push(`${item.id}: ${tamanho} caracteres (máx. ${modo.limite})`); continue; }
    cache[item.id] = registro;
    ok += 1;
  }
  fs.mkdirSync(path.dirname(modo.cache), { recursive: true });
  const ordenado = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
  fs.writeFileSync(modo.cache, JSON.stringify(ordenado, null, 1));
  console.log(`gravados: ${ok} | recusados: ${problemas.length} | total no cache: ${Object.keys(cache).length}`);
  problemas.forEach((p) => console.log(`  - ${p}`));
}

let args = process.argv.slice(2);
let nomeModo = "abstract";
if (args[0] === "topicos") { nomeModo = "topicos"; args = args.slice(1); }
const modo = MODOS[nomeModo];
const [comando, arg] = args;
try {
  if (comando === "status") status(modo);
  else if (comando === "lote") lote(modo, Math.max(1, Number(arg) || 10));
  else if (comando === "gravar" && arg) gravar(modo, nomeModo, arg);
  else console.log("uso: node data/ferramentas/resumos.js [topicos] status | lote [qtd] | gravar <arquivo.json>");
} catch (erro) {
  console.error(`ERRO: ${erro.message}`);
  process.exit(1);
}
