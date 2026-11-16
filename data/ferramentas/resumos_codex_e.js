#!/usr/bin/env node
"use strict";

// Fluxo isolado do Codex para biografia_topicos da faixa E.
// Não escreve no cache principal nem nos arquivos de lote compartilhados.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA = path.resolve(__dirname, "..");
const BASE = path.join(DATA, "pesquisadores.json");
const CACHE_PRINCIPAL = path.join(DATA, "cache", "biografia_topicos.json");
const CACHE_CODEX = path.join(DATA, "cache", "biografia_topicos_codex_E.json");
const LOTE_CODEX = path.join(DATA, "cache", "lote_resumos_codex_E.json");
const LIMITE = 600;
const PESO_TITULACAO = { "Pós-Doutorado": 5, Doutorado: 4, Mestrado: 3, "Especialização": 2, "Graduação": 1 };

const lerJSON = (arquivo, padrao) => {
  try { return JSON.parse(fs.readFileSync(arquivo, "utf8")); }
  catch { return padrao; }
};
const limpa = (texto) => String(texto || "").replace(/\s+/g, " ").trim();
const digital = (texto) => crypto.createHash("sha1").update(limpa(texto)).digest("hex").slice(0, 12);
const juntarTopicos = (topicos) => topicos.map((topico) => `• ${topico}`).join("\n");

function dados() {
  const base = lerJSON(BASE, null);
  if (!base || !Array.isArray(base.data)) throw new Error("pesquisadores.json não encontrado ou inválido");
  return base.data;
}

function cacheValido(cache, registro) {
  const salvo = cache[registro.id];
  return Boolean(
    salvo &&
    salvo.hash === digital(registro.biografia) &&
    Array.isArray(salvo.topicos) &&
    salvo.topicos.length
  );
}

function pendentes() {
  const principal = lerJSON(CACHE_PRINCIPAL, {});
  const codex = lerJSON(CACHE_CODEX, {});
  return dados()
    .filter((registro) => registro.classificacao === "E" && limpa(registro.biografia))
    .filter((registro) => !cacheValido(principal, registro) && !cacheValido(codex, registro))
    .sort((a, b) =>
      (PESO_TITULACAO[b.graduacao] || 0) - (PESO_TITULACAO[a.graduacao] || 0) ||
      (Number(b.artigos) || 0) - (Number(a.artigos) || 0) ||
      limpa(b.biografia).length - limpa(a.biografia).length
    );
}

function status() {
  const cache = lerJSON(CACHE_CODEX, {});
  const fila = pendentes();
  console.log(`cache Codex E: ${Object.keys(cache).length}`);
  console.log(`pendentes da faixa E: ${fila.length}`);
  if (fila.length) console.log(`próximo: ${fila[0].nome} (${limpa(fila[0].biografia).length} caracteres)`);
}

function lote(quantidade) {
  const escolhidos = pendentes().slice(0, quantidade).map((registro) => ({
    id: registro.id,
    nome: registro.nome,
    classificacao: registro.classificacao,
    titulacao: registro.graduacao || "",
    artigos: Number(registro.artigos) || 0,
    tamanho: limpa(registro.biografia).length,
    biografia: limpa(registro.biografia),
  }));
  fs.mkdirSync(path.dirname(LOTE_CODEX), { recursive: true });
  fs.writeFileSync(LOTE_CODEX, JSON.stringify(escolhidos, null, 1));
  for (const item of escolhidos) {
    console.log(`\n### id: ${item.id}\n### nome: ${item.nome} [E] (${item.tamanho} caracteres)\n${item.biografia}`);
  }
  console.log(`\n${escolhidos.length} biografias no lote Codex E`);
}

function gravar(arquivo) {
  const novos = lerJSON(path.resolve(arquivo), null);
  if (!Array.isArray(novos)) throw new Error("O arquivo precisa ser uma lista");
  const base = new Map(dados().map((registro) => [registro.id, registro]));
  const cache = lerJSON(CACHE_CODEX, {});
  const problemas = [];
  let gravados = 0;

  for (const item of novos) {
    const registro = base.get(item.id);
    if (!registro) { problemas.push(`${item.id}: id não encontrado`); continue; }
    if (registro.classificacao !== "E") { problemas.push(`${item.id}: classificação não é E`); continue; }
    if (!limpa(registro.biografia)) { problemas.push(`${item.id}: biografia vazia`); continue; }
    const topicos = (Array.isArray(item.topicos) ? item.topicos : []).map(limpa).filter(Boolean);
    if (!topicos.length) { problemas.push(`${item.id}: sem tópicos`); continue; }
    const tamanho = juntarTopicos(topicos).length;
    if (tamanho > LIMITE) { problemas.push(`${item.id}: ${tamanho} caracteres (máx. ${LIMITE})`); continue; }
    cache[item.id] = { hash: digital(registro.biografia), gerado_em: new Date().toISOString(), topicos };
    gravados += 1;
  }

  fs.writeFileSync(CACHE_CODEX, JSON.stringify(Object.fromEntries(Object.keys(cache).sort().map((id) => [id, cache[id]])), null, 1));
  console.log(`gravados no cache Codex E: ${gravados} | recusados: ${problemas.length} | total: ${Object.keys(cache).length}`);
  problemas.forEach((problema) => console.log(`  - ${problema}`));
  if (problemas.length) process.exitCode = 1;
}

const [comando, argumento] = process.argv.slice(2);
try {
  if (comando === "status") status();
  else if (comando === "lote") lote(Math.max(1, Number(argumento) || 25));
  else if (comando === "gravar" && argumento) gravar(argumento);
  else console.log("uso: node data/ferramentas/resumos_codex_e.js status | lote [qtd] | gravar <arquivo.json>");
} catch (erro) {
  console.error(`ERRO: ${erro.message}`);
  process.exit(1);
}
