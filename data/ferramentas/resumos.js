#!/usr/bin/env node
/*
 * Ferramenta dos resumos (abstract_ai) — usada pela IA dentro do chat.
 *
 *   node data/ferramentas/resumos.js status
 *       Mostra quantos resumos já existem e quantos faltam.
 *
 *   node data/ferramentas/resumos.js lote [quantidade]
 *       Mostra o próximo lote de biografias pendentes (padrão: 10), as mais longas primeiro,
 *       e grava o lote em data/cache/lote_resumos.json (para conferência).
 *
 *   node data/ferramentas/resumos.js gravar <arquivo.json>
 *       Grava no cache os resumos feitos pela IA. O arquivo é uma lista:
 *         [ { "id": "...", "resumo": "..." }, ... ]
 *       Cada resumo é conferido: até 900 caracteres e biografia existente.
 *
 * Depois de gravar, rode o pipeline (node data/atualizar_dados.js) para aplicar.
 * Os pendentes são atualizados a cada execução do pipeline.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA = path.resolve(__dirname, "..");
const BASE = path.join(DATA, "pesquisadores.json");
const CACHE = path.join(DATA, "cache", "abstract_ai.json");
const PENDENTES = path.join(DATA, "cache", "abstract_ai_pendentes.json");
const LOTE = path.join(DATA, "cache", "lote_resumos.json");
const LIMITE = 900;

const lerJSON = (f, padrao) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return padrao; } };
const limpa = (t) => String(t || "").replace(/\s+/g, " ").trim();
const digital = (t) => crypto.createHash("sha1").update(limpa(t)).digest("hex").slice(0, 12);

function biografias() {
  const base = lerJSON(BASE, null);
  if (!base) throw new Error("pesquisadores.json não encontrado: rode o pipeline primeiro.");
  return new Map(base.data.map((r) => [r.id, r]));
}

function status() {
  const cache = lerJSON(CACHE, {});
  const pend = lerJSON(PENDENTES, { total: 0, pendentes: [] });
  console.log(`resumos no cache: ${Object.keys(cache).length}`);
  console.log(`pendentes (na última execução do pipeline): ${pend.total}`);
  if (pend.pendentes.length) console.log(`próximo: ${pend.pendentes[0].nome} (${pend.pendentes[0].tamanho} caracteres)`);
}

function lote(qtd) {
  const cache = lerJSON(CACHE, {});
  const pend = lerJSON(PENDENTES, { pendentes: [] }).pendentes;
  const base = biografias();
  const escolhidos = [];
  for (const p of pend) {
    if (escolhidos.length >= qtd) break;
    const r = base.get(p.id);
    if (!r) continue;
    const bio = limpa(r.biografia);
    const salvo = cache[p.id];
    if (salvo && salvo.hash === digital(bio)) continue; // já resumido depois da última execução
    escolhidos.push({ id: r.id, nome: r.nome, tamanho: bio.length, biografia: bio });
  }
  fs.writeFileSync(LOTE, JSON.stringify(escolhidos, null, 1));
  for (const e of escolhidos) {
    console.log(`\n### id: ${e.id}\n### nome: ${e.nome} (${e.tamanho} caracteres)\n${e.biografia}`);
  }
  console.log(`\n${escolhidos.length} biografias no lote (gravado em data/cache/lote_resumos.json)`);
}

function gravar(arquivo) {
  const novos = lerJSON(arquivo, null);
  if (!Array.isArray(novos)) throw new Error("O arquivo precisa ser uma lista [{id, resumo}].");
  const cache = lerJSON(CACHE, {});
  const base = biografias();
  let ok = 0;
  const problemas = [];
  for (const { id, resumo } of novos) {
    const r = base.get(id);
    const texto = limpa(resumo);
    if (!r) { problemas.push(`${id}: id não encontrado`); continue; }
    if (!texto) { problemas.push(`${id}: resumo vazio`); continue; }
    if (texto.length > LIMITE) { problemas.push(`${id}: ${texto.length} caracteres (máx. ${LIMITE})`); continue; }
    cache[id] = { hash: digital(r.biografia), resumo: texto, gerado_em: new Date().toISOString() };
    ok += 1;
  }
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  const ordenado = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
  fs.writeFileSync(CACHE, JSON.stringify(ordenado, null, 1));
  console.log(`gravados: ${ok} | recusados: ${problemas.length} | total no cache: ${Object.keys(cache).length}`);
  problemas.forEach((p) => console.log(`  - ${p}`));
}

const [comando, arg] = process.argv.slice(2);
try {
  if (comando === "status") status();
  else if (comando === "lote") lote(Math.max(1, Number(arg) || 10));
  else if (comando === "gravar" && arg) gravar(arg);
  else console.log("uso: node data/ferramentas/resumos.js status | lote [qtd] | gravar <arquivo.json>");
} catch (erro) {
  console.error(`ERRO: ${erro.message}`);
  process.exit(1);
}
