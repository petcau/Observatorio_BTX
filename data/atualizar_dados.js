#!/usr/bin/env node
/*
 * atualizar_dados — pipeline de dados do Painel BTX
 *
 * Entrada:  data/pesquisadores.csv   (base bruta, exportada da fonte)
 * Saída:    data/pesquisadores.json  (base tratada, usada pelo painel)
 *
 * Como rodar (na pasta do projeto):
 *   node data/atualizar_dados.js
 *
 * O pipeline é uma lista de etapas executadas em ordem (veja ETAPAS no fim do arquivo).
 * Cada etapa recebe a lista de registros e devolve a lista (alterada ou não).
 * Para criar uma rotina de transformação, escreva uma função e acrescente em ETAPAS.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const PASTA = __dirname;
const ENTRADA = path.join(PASTA, "pesquisadores.csv");
const SAIDA = path.join(PASTA, "pesquisadores.json");

// ---------------------------------------------------------------------------
// Leitura do CSV
// Aceita: BOM no início, campos entre aspas, aspas duplicadas ("") e
// quebras de linha dentro de campos. Separador: vírgula.
// ---------------------------------------------------------------------------
function lerCSV(texto) {
  const linhas = [];
  let linha = [];
  let campo = "";
  let entreAspas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i += 1; }
        else entreAspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreAspas = true;
    } else if (c === ",") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo.replace(/\r$/, ""));
      linhas.push(linha);
      linha = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo !== "" || linha.length) {
    linha.push(campo.replace(/\r$/, ""));
    linhas.push(linha);
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// ETAPA 1 — carregar: CSV bruto → lista de registros
// Mantém as colunas e os valores exatamente como vieram (texto).
// Campos sem dados ficam em branco (""). Nenhuma transformação é feita aqui.
// ---------------------------------------------------------------------------
function carregar() {
  if (!fs.existsSync(ENTRADA)) {
    throw new Error(`Arquivo de entrada não encontrado: ${ENTRADA}`);
  }
  const texto = fs.readFileSync(ENTRADA, "utf8").replace(/^﻿/, "");
  const linhas = lerCSV(texto).filter((l) => !(l.length === 1 && l[0].trim() === ""));
  if (!linhas.length) throw new Error("CSV vazio.");

  const colunas = linhas.shift().map((c) => c.trim());
  const problemas = [];

  const registros = linhas.map((celulas, indice) => {
    if (celulas.length !== colunas.length) {
      problemas.push(`linha ${indice + 2}: ${celulas.length} colunas (esperado ${colunas.length})`);
    }
    const registro = {};
    colunas.forEach((coluna, j) => {
      registro[coluna] = (celulas[j] ?? "").trim();
    });
    return registro;
  });

  return { colunas, registros, problemas };
}

// ---------------------------------------------------------------------------
// ETAPA — inferirSexo
// Infere F/M pelo primeiro nome, usando a frequência de nomes do Censo do IBGE.
// - Se o registro já trouxer sexo F/M da fonte, mantém (sexo_origem = "fonte").
// - Se ≥ LIMITE_SEXO das pessoas com aquele nome forem de um sexo, marca F ou M
//   (sexo_origem = "inferido_nome").
// - Nome ambíguo ou não encontrado no IBGE: deixa em branco.
// As consultas ao IBGE ficam guardadas em data/cache/nomes_ibge.json; nas próximas
// execuções só os nomes novos são consultados.
// Uso recomendado: contagens/proporções e concordância de texto, não exibição individual.
// ---------------------------------------------------------------------------
const LIMITE_SEXO = 0.9;
const CACHE_NOMES = path.join(PASTA, "cache", "nomes_ibge.json");
const API_NOMES = "https://servicodados.ibge.gov.br/api/v2/censos/nomes";

function primeiroNome(nome) {
  return String(nome || "")
    .trim()
    .split(/\s+/)[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

function lerCacheNomes() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_NOMES, "utf8"));
  } catch {
    return {};
  }
}

function gravarCacheNomes(cache) {
  fs.mkdirSync(path.dirname(CACHE_NOMES), { recursive: true });
  const ordenado = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
  fs.writeFileSync(CACHE_NOMES, JSON.stringify(ordenado, null, 1));
}

// Soma as frequências de todas as décadas, por nome, para um sexo
async function consultarIBGE(nomes, sexo) {
  const url = `${API_NOMES}/${nomes.map(encodeURIComponent).join("%7C")}?sexo=${sexo}`;
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      const resposta = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const lista = await resposta.json();
      const totais = {};
      for (const item of lista) {
        totais[item.nome] = (item.res || []).reduce((soma, r) => soma + (r.frequencia || 0), 0);
      }
      return totais;
    } catch (erro) {
      if (tentativa === 3) throw new Error(`IBGE indisponível (${erro.message})`);
      await new Promise((r) => setTimeout(r, 1500 * tentativa));
    }
  }
}

async function completarCacheNomes(nomes, cache) {
  const faltando = nomes.filter((n) => n && !(n in cache));
  if (!faltando.length) return 0;
  const LOTE = 40;
  let feitos = 0;
  for (let i = 0; i < faltando.length; i += LOTE) {
    const lote = faltando.slice(i, i + LOTE);
    const [fem, mas] = await Promise.all([consultarIBGE(lote, "F"), consultarIBGE(lote, "M")]);
    for (const nome of lote) cache[nome] = { F: fem[nome] || 0, M: mas[nome] || 0 };
    feitos += lote.length;
    if (feitos % 800 === 0 || feitos === faltando.length) {
      console.log(`    IBGE: ${feitos}/${faltando.length} nomes novos consultados`);
      gravarCacheNomes(cache); // salva aos poucos: se cair, continua de onde parou
    }
  }
  return faltando.length;
}

async function inferirSexo(registros) {
  const cache = lerCacheNomes();
  const nomes = [...new Set(registros.map((r) => primeiroNome(r.nome)))];
  const novos = await completarCacheNomes(nomes, cache);
  gravarCacheNomes(cache);

  const conta = { fonte: 0, F: 0, M: 0, ambiguo: 0, desconhecido: 0 };
  for (const r of registros) {
    const informado = String(r.sexo || "").trim().toUpperCase();
    if (informado === "F" || informado === "M") {
      r.sexo = informado;
      r.sexo_origem = "fonte";
      conta.fonte += 1;
      continue;
    }
    const freq = cache[primeiroNome(r.nome)];
    const total = freq ? freq.F + freq.M : 0;
    r.sexo = "";
    r.sexo_origem = "";
    if (!total) { conta.desconhecido += 1; continue; }
    if (freq.F / total >= LIMITE_SEXO) { r.sexo = "F"; r.sexo_origem = "inferido_nome"; conta.F += 1; }
    else if (freq.M / total >= LIMITE_SEXO) { r.sexo = "M"; r.sexo_origem = "inferido_nome"; conta.M += 1; }
    else conta.ambiguo += 1;
  }

  console.log(`    nomes: ${nomes.length} diferentes (${novos} consultados agora no IBGE)`);
  console.log(`    resultado: F ${conta.F} | M ${conta.M} | em branco: ambíguo ${conta.ambiguo}, nome não encontrado ${conta.desconhecido} | da fonte ${conta.fonte}`);
  validarSexo(registros);
  return registros;
}

// Confere a inferência com a base antiga (sexo informado), ligando pelo lattes_id
function validarSexo(registros) {
  const referencia = path.join(PASTA, "dados_simcc_completo.json");
  if (!fs.existsSync(referencia)) return;
  try {
    const antigos = JSON.parse(fs.readFileSync(referencia, "utf8")).data || [];
    const real = new Map(antigos.map((a) => [String(a.lattes_id), String(a.Sexo || "").toUpperCase()]));
    let comparados = 0, acertos = 0, branco = 0;
    for (const r of registros) {
      const esperado = real.get(String(r.lattes_id));
      if (esperado !== "F" && esperado !== "M") continue;
      comparados += 1;
      if (!r.sexo) branco += 1;
      else if (r.sexo === esperado) acertos += 1;
    }
    if (comparados) {
      const inferidos = comparados - branco;
      console.log(`    validação (base antiga): ${acertos}/${inferidos} acertos (${(acertos / inferidos * 100).toFixed(1)}%), ${branco} em branco, de ${comparados} comparados`);
    }
  } catch {
    // validação é só informativa
  }
}

// ---------------------------------------------------------------------------
// ETAPA — inferirSexoSufixoNome
// Para quem ficou sem sexo pelo primeiro nome: nome terminado em Neto, Filho,
// Júnior ou Sobrinho → M (99,2% de acerto medido na base).
// sexo_origem = "inferido_nome_sufixo".
// ---------------------------------------------------------------------------
const SUFIXOS_MASCULINOS = /\s(neto|filho|junior|jr\.?|sobrinho)$/;

function inferirSexoSufixoNome(registros) {
  let marcados = 0;
  for (const r of registros) {
    if (r.sexo) continue;
    const nome = String(r.nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    if (SUFIXOS_MASCULINOS.test(nome)) {
      r.sexo = "M";
      r.sexo_origem = "inferido_nome_sufixo";
      marcados += 1;
    }
  }
  console.log(`    preenchidos (Neto/Filho/Júnior/Sobrinho): M ${marcados}`);
  return registros;
}

// ---------------------------------------------------------------------------
// ETAPA — inferirSexoBiografia
// Para quem ficou SEM sexo após o nome, procura na biografia palavras de
// autodescrição com gênero (professora/professor, graduada/graduado, ...).
// Regra (assimétrica, porque mulheres às vezes usam o masculino genérico,
// mas o contrário é raro):
//   - F: alguma forma feminina, em quantidade >= às formas masculinas
//   - M: pelo menos 2 formas masculinas e nenhuma feminina
//   - senão: continua em branco
// Também gera data/relatorios/sexo_nome_x_biografia.csv com os casos em que o
// sexo inferido pelo nome e o indicado pela biografia discordam (para revisão).
// ---------------------------------------------------------------------------
const PARES_GENERO = [
  ["pesquisadora", "pesquisador"], ["professora", "professor"], ["mestranda", "mestrando"],
  ["doutoranda", "doutorando"], ["graduanda", "graduando"], ["pos-doutoranda", "pos-doutorando"],
  ["coordenadora", "coordenador"], ["vice-coordenadora", "vice-coordenador"], ["diretora", "diretor"],
  ["licenciada", "licenciado"], ["graduada", "graduado"], ["formada", "formado"], ["doutora", "doutor"],
  ["enfermeira", "enfermeiro"], ["engenheira", "engenheiro"],
  ["advogada", "advogado"], ["psicologa", "psicologo"], ["biologa", "biologo"], ["pedagoga", "pedagogo"],
  ["historiadora", "historiador"], ["sociologa", "sociologo"], ["antropologa", "antropologo"],
  ["geografa", "geografo"], ["arquiteta", "arquiteto"], ["aluna", "aluno"],
  ["fundadora", "fundador"], ["avaliadora", "avaliador"],
  ["consultora", "consultor"], ["aposentada", "aposentado"],
  ["casada", "casado"], ["nascida", "nascido"], ["egressa", "egresso"],
  // só femininas: o masculino (mestre, bacharel) é usado pelos dois sexos
  ["mestra", null], ["bacharela", null]   // mestra 99,7% F · bacharela 99,9% F
  // Retiradas por concordarem com coisas, não com a pessoa (medido na base):
  // especializada ("consultoria especializada", 19% eram mulheres), efetiva ("participação efetiva", 35%),
  // vinculada ("pesquisa vinculada", 39%), orientadora (53%), assessora (75%), autora (83%),
  // contratada / credenciada / concursada ("empresa contratada", "instituição credenciada").
].map(([f, m]) => [
  new RegExp(`(^|[^a-z-])${f}([^a-z-]|$)`, "g"),
  m ? new RegExp(`(^|[^a-z-])${m}([^a-z-]|$)`, "g") : /(?!)/g // sem par masculino: nunca casa
]);

function sexoPelaBiografia(biografia) {
  const texto = String(biografia || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (!texto.trim()) return "";
  let fem = 0, mas = 0;
  for (const [rf, rm] of PARES_GENERO) {
    fem += (texto.match(rf) || []).length;
    mas += (texto.match(rm) || []).length;
  }
  if (fem && fem >= mas) return "F";
  if (mas >= 2 && fem === 0) return "M";
  return "";
}

function inferirSexoBiografia(registros) {
  const conta = { F: 0, M: 0, semBio: 0, semPista: 0 };
  const divergencias = [];

  for (const r of registros) {
    const pelaBio = sexoPelaBiografia(r.biografia);
    if (r.sexo) {
      if (r.sexo_origem === "inferido_nome" && pelaBio && pelaBio !== r.sexo) {
        divergencias.push([r.id, r.nome, r.sexo, pelaBio]);
      }
      continue;
    }
    if (!String(r.biografia || "").trim()) { conta.semBio += 1; continue; }
    if (!pelaBio) { conta.semPista += 1; continue; }
    r.sexo = pelaBio;
    r.sexo_origem = "inferido_biografia";
    conta[pelaBio] += 1;
  }

  const pasta = path.join(PASTA, "relatorios");
  fs.mkdirSync(pasta, { recursive: true });
  const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
  fs.writeFileSync(
    path.join(pasta, "sexo_nome_x_biografia.csv"),
    "﻿" + ["id,nome,sexo_pelo_nome,sexo_pela_biografia", ...divergencias.map((d) => d.map(csv).join(","))].join("\n")
  );

  const restantes = registros.filter((r) => !r.sexo).length;
  console.log(`    preenchidos pela biografia: F ${conta.F} | M ${conta.M}`);
  console.log(`    continuam em branco: ${restantes} (sem biografia ${conta.semBio}, biografia sem pista ${conta.semPista})`);
  console.log(`    divergências nome x biografia: ${divergencias.length} → data/relatorios/sexo_nome_x_biografia.csv`);
  return registros;
}

// ---------------------------------------------------------------------------
// ETAPA — inferirSexoBiografia2 (segunda inferência pela biografia)
// Para quem AINDA está sem sexo: se a biografia contém "professor" ou
// "doutorando" (ou outra palavra da lista PALAVRAS_MASCULINAS_2) e nenhuma forma
// feminina, marca M (sexo_origem = "inferido_biografia_2").
// Atenção: menos segura que as anteriores. Na medição, "professor" sozinho
// acertou ~85% e "doutorando" sozinho ~98%.
// ---------------------------------------------------------------------------
// professor (~85%) e doutorando (~98%) + palavras que, sozinhas, acertaram ≥ 95% na medição:
// graduado 99,3% · licenciado 100% · advogado 100% · engenheiro 99,3% · formado 98,3% ·
// doutor 97,8% · mestrando 97,5% · coordenador 95,0%
const PALAVRAS_MASCULINAS_2 = [
  "professor", "doutorando", "graduado", "licenciado", "advogado", "engenheiro",
  "formado", "doutor", "mestrando", "coordenador"
].map((p) => new RegExp(`(^|[^a-z-])${p}([^a-z-]|$)`));

function inferirSexoBiografia2(registros) {
  let marcados = 0;
  for (const r of registros) {
    if (r.sexo) continue;
    const texto = String(r.biografia || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (!texto.trim()) continue;
    const temFeminino = PARES_GENERO.some(([rf]) => { rf.lastIndex = 0; return rf.test(texto); });
    if (temFeminino) continue;
    if (PALAVRAS_MASCULINAS_2.some((re) => re.test(texto))) {
      r.sexo = "M";
      r.sexo_origem = "inferido_biografia_2";
      marcados += 1;
    }
  }
  const restantes = registros.filter((r) => !r.sexo).length;
  console.log(`    preenchidos (professor/doutorando): M ${marcados}`);
  console.log(`    continuam em branco: ${restantes}`);
  return registros;
}

// ---------------------------------------------------------------------------
// ETAPA — inferirSexoBiografia3 (terceira inferência pela biografia)
// Para quem AINDA está sem sexo, usa pares definidos pela equipe:
//   aluno/aluna, graduando/graduanda, médico/médica, professor/professora, mestre/mestra,
//   pesquisador/pesquisadora, monitor/monitora, secretário/secretária (com acento),
//   estagiário/estagiária, voluntária, voluntário (só quando descreve a pessoa)
// - só formas femininas (desses pares ou da lista PARES_GENERO) → F
// - só formas masculinas desses pares (e nenhuma feminina)      → M
// - as duas ou nenhuma                                           → continua em branco
// sexo_origem = "inferido_biografia_3". É a regra menos segura do pipeline:
// "mestre" e "médico/médica" também aparecem em outros sentidos
// (ex.: "mestre em…" usado por mulheres, "clínica médica").
// ---------------------------------------------------------------------------
const PARES_GENERO_3 = [
  ["aluna", "aluno"], ["graduanda", "graduando"], ["medica", "medico"],
  ["professora", "professor"], ["mestra", "mestre"],
  ["pesquisadora", "pesquisador"], ["monitora", "monitor"],  // pesquisador 95,6% M · monitor 97,0% M · monitora 99,3% F
  ["estagiaria", "estagiario"],  // estagiária 99,7% F · estagiário 98,1% M
  ["voluntaria", null]   // voluntária 96,8% F
].map(([f, m]) => [
  new RegExp(`(^|[^a-z-])${f}([^a-z-]|$)`),
  m ? new RegExp(`(^|[^a-z-])${m}([^a-z-]|$)`) : /(?!)/ // sem par masculino: nunca casa
]);

// pares que dependem do acento (sem acento, "secretaria" é o órgão: "Secretaria de Educação")
// secretária 87,5% F · secretário 97,9% M
const PARES_COM_ACENTO_3 = [[/(^|[^a-zà-ú-])secretária([^a-zà-ú-]|$)/, /(^|[^a-zà-ú-])secretário([^a-zà-ú-]|$)/]];

// "voluntário" só quando descreve a pessoa ("foi voluntário", "atua como voluntário", "bolsista voluntário"):
// 96,1% M. Sozinho ("trabalho voluntário") acerta só 78,5%, por isso não entra.
PARES_GENERO_3.push([
  /(?!)/,
  /(^|[^a-z])(como|e|sou|foi|atua como|atuou como|sendo|um|aluno|estudante|pesquisador|professor|bolsista|monitor) voluntario([^a-z-]|$)/
]);

function inferirSexoBiografia3(registros) {
  const conta = { F: 0, M: 0, conflito: 0 };
  for (const r of registros) {
    if (r.sexo) continue;
    const texto = String(r.biografia || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (!texto.trim()) continue;
    const comAcento = String(r.biografia || "").toLowerCase();
    const fem = PARES_GENERO_3.some(([rf]) => rf.test(texto))
      || PARES_COM_ACENTO_3.some(([rf]) => rf.test(comAcento))
      || PARES_GENERO.some(([rf]) => { rf.lastIndex = 0; return rf.test(texto); });
    const mas = PARES_GENERO_3.some(([, rm]) => rm.test(texto))
      || PARES_COM_ACENTO_3.some(([, rm]) => rm.test(comAcento));
    if (fem && mas) { conta.conflito += 1; continue; }
    if (fem) { r.sexo = "F"; }
    else if (mas) { r.sexo = "M"; }
    else continue;
    r.sexo_origem = "inferido_biografia_3";
    conta[r.sexo] += 1;
  }
  const restantes = registros.filter((r) => !r.sexo).length;
  console.log(`    preenchidos: F ${conta.F} | M ${conta.M} | com os dois gêneros (mantidos em branco): ${conta.conflito}`);
  console.log(`    continuam em branco: ${restantes}`);
  return registros;
}

// ---------------------------------------------------------------------------
// ETAPA — inferirArea  →  grava area_ia e area_ia_origem
// 1. Se existir `area`: copia igual para area_ia (area_ia_origem = "fonte").
// 2. Senão, pelo CURSO citado na biografia ("graduado em…", "possui graduação em…",
//    "doutora em…"). A tabela curso → área é aprendida dos próprios dados: para cada
//    curso, a área mais comum entre quem já tem área; só vale se o curso aparece em
//    ≥ CURSO_MIN_CASOS pessoas e ≥ CURSO_MIN_PCT delas são da mesma área.
//    (area_ia_origem = "inferido_curso")
// 3. Senão, pelas PALAVRAS da biografia (classificador Naive Bayes treinado com
//    quem já tem área). Só grava se a confiança (diferença entre a 1ª e a 2ª área)
//    for ≥ AREA_MARGEM. (area_ia_origem = "inferido_biografia")
// 4. Senão: area_ia em branco.
// A cada execução, mede o acerto de cada regra em 20% dos que já têm área
// (separados antes do treino) e mostra no log.
// ---------------------------------------------------------------------------
const CURSO_MIN_CASOS = 5;
const CURSO_MIN_PCT = 0.85;
const AREA_MARGEM = 5;

const PALAVRAS_VAZIAS_AREA = new Set(("de da do das dos e em na no nas nos a o as os um uma para por com pela pelo " +
  "pelas pelos que se ao aos sua seu suas seus como mais entre sobre ate tem foi sao ser atualmente possui graduacao " +
  "mestrado doutorado universidade federal estadual bahia salvador area pesquisa professor professora curso programa " +
  "pos experiencia atuando principalmente seguintes temas enfase ano anos nivel").split(" "));

const semAcentoMin = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const areasDoRegistro = (r) => String(r.area || "").split(";").map((a) => a.trim()).filter(Boolean);
const palavrasBio = (t) => semAcentoMin(t).split(/[^a-z]+/).filter((w) => w.length > 2 && !PALAVRAS_VAZIAS_AREA.has(w));

// "graduado em engenharia florestal pela ..." → "engenharia florestal"
const RE_CURSO = /\b(graduad[oa]s?|graduand[oa]s?|licenciad[oa]s?|licenciatura|bacharela?d?[oa]?|bacharelado|graduacao|mestr[ea]|mestrand[oa]|mestrado|doutor[a]?|doutorand[oa]|doutorado|formad[oa]|especializacao|especialista|tecnolog[oa])\s+(?:plena\s+|academica\s+|profissional\s+)?em\s+([a-z\s-]{3,80})/;
const FIM_CURSO = /\s(pela|pelo|na|no|nas|nos|e|com|desde|em|ano|atualmente|sendo|onde|para)\s.*$/;

function cursoDaBiografia(biografia) {
  const texto = semAcentoMin(biografia).replace(/[(),.;:/]/g, " , ");
  const m = RE_CURSO.exec(texto);
  if (!m) return "";
  return m[2].split(",")[0].replace(FIM_CURSO, "").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ");
}

function aprenderCursos(rotulados) {
  const contagem = {};
  for (const r of rotulados) {
    const curso = cursoDaBiografia(r.biografia);
    if (!curso) continue;
    const c = (contagem[curso] = contagem[curso] || { total: 0, areas: {} });
    c.total += 1;
    for (const a of areasDoRegistro(r)) c.areas[a] = (c.areas[a] || 0) + 1;
  }
  const tabela = {};
  for (const [curso, c] of Object.entries(contagem)) {
    if (c.total < CURSO_MIN_CASOS) continue;
    const [area, n] = Object.entries(c.areas).sort((x, y) => y[1] - x[1])[0];
    if (n / c.total >= CURSO_MIN_PCT) tabela[curso] = area;
  }
  return tabela;
}

function treinarAreas(rotulados) {
  const docs = {}, palavras = {}, totalPal = {}, vocab = new Set();
  for (const r of rotulados) {
    const tk = new Set(palavrasBio(r.biografia));
    for (const a of areasDoRegistro(r)) {
      docs[a] = (docs[a] || 0) + 1;
      palavras[a] = palavras[a] || {};
      for (const w of tk) { palavras[a][w] = (palavras[a][w] || 0) + 1; totalPal[a] = (totalPal[a] || 0) + 1; vocab.add(w); }
    }
  }
  return { docs, palavras, totalPal, V: vocab.size, N: Object.values(docs).reduce((s, n) => s + n, 0) };
}

function preverArea(modelo, biografia) {
  const tk = new Set(palavrasBio(biografia));
  if (!tk.size) return { area: "", margem: 0 };
  const notas = Object.keys(modelo.docs).map((a) => {
    let s = Math.log(modelo.docs[a] / modelo.N);
    for (const w of tk) s += Math.log(((modelo.palavras[a][w] || 0) + 1) / (modelo.totalPal[a] + modelo.V));
    return [a, s];
  }).sort((x, y) => y[1] - x[1]);
  return { area: notas[0][0], margem: notas.length > 1 ? notas[0][1] - notas[1][1] : Infinity };
}

// decide a área de um registro sem `area`
function decidirArea(r, tabelaCursos, modelo) {
  if (!String(r.biografia || "").trim()) return null;
  const curso = cursoDaBiografia(r.biografia);
  if (curso && tabelaCursos[curso]) return { area: tabelaCursos[curso], origem: "inferido_curso" };
  const p = preverArea(modelo, r.biografia);
  if (p.area && p.margem >= AREA_MARGEM) return { area: p.area, origem: "inferido_biografia" };
  return null;
}

function inferirArea(registros) {
  const rotulados = registros.filter((r) => areasDoRegistro(r).length && String(r.biografia || "").trim());

  // validação: treina com 80% e confere nos 20% restantes
  const treino = [], teste = [];
  rotulados.forEach((r, i) => (i % 5 === 0 ? teste : treino).push(r));
  const tCursos = aprenderCursos(treino), tModelo = treinarAreas(treino);
  const val = { inferido_curso: [0, 0], inferido_biografia: [0, 0], branco: 0 };
  for (const r of teste) {
    const d = decidirArea(r, tCursos, tModelo);
    if (!d) { val.branco += 1; continue; }
    val[d.origem][0] += 1;
    if (areasDoRegistro(r).includes(d.area)) val[d.origem][1] += 1;
  }

  // execução: treina com todos os que têm área
  const tabelaCursos = aprenderCursos(rotulados);
  const modelo = treinarAreas(rotulados);
  const conta = { fonte: 0, inferido_curso: 0, inferido_biografia: 0, branco: 0 };
  for (const r of registros) {
    if (areasDoRegistro(r).length) {
      r.area_ia = r.area;
      r.area_ia_origem = "fonte";
      conta.fonte += 1;
      continue;
    }
    const d = decidirArea(r, tabelaCursos, modelo);
    r.area_ia = d ? d.area : "";
    r.area_ia_origem = d ? d.origem : "";
    conta[d ? d.origem : "branco"] += 1;
  }

  const pct = ([n, ok]) => (n ? `${(ok / n * 100).toFixed(1)}% em ${n}` : "-");
  console.log(`    cursos reconhecidos: ${Object.keys(tabelaCursos).length} (aprendidos de quem já tem área)`);
  console.log(`    resultado: da fonte ${conta.fonte} | pelo curso ${conta.inferido_curso} | pela biografia ${conta.inferido_biografia} | em branco ${conta.branco}`);
  console.log(`    validação (20% separados): curso ${pct(val.inferido_curso)} | biografia ${pct(val.inferido_biografia)} | sem decisão ${val.branco}`);
  return registros;
}

// ---------------------------------------------------------------------------
// ETAPA — inferirArea2 (segunda inferência de área)
// Para quem AINDA está com area_ia em branco e tem biografia: grava a área mais
// provável pelas palavras da biografia, sem exigir confiança mínima
// (area_ia_origem = "inferido_biografia_2").
// Cobre todos os que têm biografia; menos precisa que a primeira (~67% na validação).
// Obs.: testamos também usar o curso com regra relaxada, mas acertou menos (63,5%).
// Quem não tem biografia continua em branco.
// ---------------------------------------------------------------------------
function decidirArea2(r, modelo) {
  if (!String(r.biografia || "").trim()) return null;
  const p = preverArea(modelo, r.biografia);
  return p.area ? { area: p.area, origem: "inferido_biografia_2" } : null;
}

function inferirArea2(registros) {
  const rotulados = registros.filter((r) => areasDoRegistro(r).length && String(r.biografia || "").trim());

  // validação: só nos casos de teste que a 1ª inferência deixaria em branco
  const treino = [], teste = [];
  rotulados.forEach((r, i) => (i % 5 === 0 ? teste : treino).push(r));
  const tCursos = aprenderCursos(treino), tModelo = treinarAreas(treino);
  const val = { inferido_biografia_2: [0, 0] };
  for (const r of teste) {
    if (decidirArea(r, tCursos, tModelo)) continue; // a 1ª inferência já resolveria
    const d = decidirArea2(r, tModelo);
    if (!d) continue;
    val[d.origem][0] += 1;
    if (areasDoRegistro(r).includes(d.area)) val[d.origem][1] += 1;
  }

  const modelo = treinarAreas(rotulados);
  const conta = { inferido_biografia_2: 0 };
  for (const r of registros) {
    if (r.area_ia) continue;
    const d = decidirArea2(r, modelo);
    if (!d) continue;
    r.area_ia = d.area;
    r.area_ia_origem = d.origem;
    conta[d.origem] += 1;
  }

  const restantes = registros.filter((r) => !r.area_ia);
  const semBio = restantes.filter((r) => !String(r.biografia || "").trim()).length;
  const pct = ([n, ok]) => (n ? `${(ok / n * 100).toFixed(1)}% em ${n}` : "-");
  console.log(`    preenchidos pela biografia: ${conta.inferido_biografia_2}`);
  console.log(`    continuam em branco: ${restantes.length} (sem biografia ${semBio})`);
  console.log(`    validação (20% separados): ${pct(val.inferido_biografia_2)}`);
  return registros;
}

// ---------------------------------------------------------------------------
// ETAPA — extrairTema  →  grava tema_ia e tema_ia_origem
// Extrai da biografia os temas específicos de pesquisa (como no Lattes):
// 1. "atuando principalmente nos seguintes temas: A, B e C" (também "nos temas:",
//    "principais temas:", "temas de interesse:", "linha(s) de pesquisa:")  → "extraido_temas"
// 2. senão, "Tem experiência na área de X, com ênfase em Y"                → "extraido_enfase"
// Resultado no formato da base antiga: "A; B; C". Sem frase: em branco.
// ---------------------------------------------------------------------------
const RE_TEMAS = /(?:seguintes temas|nos temas|principais temas|temas de interesse|linhas? de pesquisa)\s*:?\s*([^]*?)(?:\.(?:\s|$)|$)/i;
const RE_ENFASE = /com [eê]nfase (?:em|na|no|nas|nos)\s+([^]*?)(?:[.;]|,\s*(?:atuando|tendo|trabalhando|com)|$)/i;

function listaDeTemas(trecho) {
  return String(trecho || "")
    .replace(/\s+/g, " ")
    .split(/\s*[,;]\s*|\s+e\s+(?=[^,;]*$)/)
    .map((t) => t.trim().replace(/^(e|a|o|as|os)\s+/i, "").replace(/[.:]+$/, ""))
    .filter((t) => t.length >= 3 && t.length <= 120)
    .slice(0, 12)
    .join("; ");
}

function extrairTema(registros) {
  const conta = { extraido_temas: 0, extraido_enfase: 0, branco: 0 };
  for (const r of registros) {
    const bio = String(r.biografia || "");
    const mTemas = RE_TEMAS.exec(bio);
    const temas = mTemas ? listaDeTemas(mTemas[1].slice(0, 400)) : "";
    if (temas) { r.tema_ia = temas; r.tema_ia_origem = "extraido_temas"; conta.extraido_temas += 1; continue; }
    const mEnf = RE_ENFASE.exec(bio);
    const enfase = mEnf ? listaDeTemas(mEnf[1].slice(0, 200)) : "";
    if (enfase) { r.tema_ia = enfase; r.tema_ia_origem = "extraido_enfase"; conta.extraido_enfase += 1; continue; }
    r.tema_ia = "";
    r.tema_ia_origem = "";
    conta.branco += 1;
  }
  console.log(`    resultado: lista de temas ${conta.extraido_temas} | "com ênfase em" ${conta.extraido_enfase} | em branco ${conta.branco}`);
  return registros;
}

// ---------------------------------------------------------------------------
// ETAPA — inferirTematica  →  grava tematica_ia e tematica_ia_origem
// Regras em data/regras/tematicas.json (57 temáticas da base antiga). Ordem:
// 1. bolsista da base antiga (dados_simcc_completo.json), pelo lattes_id → a temática que já tinha  ("fonte_antiga")
// 1b. palavras-chave nos temas de pesquisa extraídos (tema_ia), sem empate                 ("inferido_temas")
// 2. curso citado na biografia que bate com "curso" de uma temática (vence o padrão mais longo) ("inferido_curso")
// 3. palavras-chave: temática com mais termos diferentes encontrados, se ≥ 2 e sem empate ("inferido_palavras")
// 4. curso genérico ("curso_padrao", ex.: Ciências Biológicas)                               ("inferido_curso")
// 5. palavras-chave com 1 termo, sem empate                                                  ("inferido_palavras_fraco")
// 6. senão: em branco
// A validação compara as regras 2-5 com a temática real dos bolsistas da base antiga.
// ---------------------------------------------------------------------------
const REGRAS_TEMATICAS = path.join(PASTA, "regras", "tematicas.json");

function carregarRegrasTematicas() {
  const regras = JSON.parse(fs.readFileSync(REGRAS_TEMATICAS, "utf8"));
  const compilar = (lista) => (lista || []).map((p) => new RegExp(p));
  return {
    genericos: compilar(regras.cursos_genericos),
    tematicas: regras.tematicas.map((t) => ({
      nome: t.nome,
      curso: compilar(t.curso),
      padrao: compilar(t.curso_padrao),
      palavras: compilar(t.palavras)
    }))
  };
}

// tema cujo padrão de curso casa com o trecho mais longo do curso citado
function tematicaPeloCurso(curso, regras, campo) {
  if (!curso || regras.genericos.some((re) => re.test(curso))) return "";
  let melhor = "", tamanho = 0;
  for (const t of regras.tematicas) {
    for (const re of t[campo]) {
      const m = re.exec(curso);
      if (m && m[0].length > tamanho) { melhor = t.nome; tamanho = m[0].length; }
    }
  }
  return melhor;
}

function tematicaPelasPalavras(biografia, regras) {
  const texto = semAcentoMin(biografia);
  const notas = regras.tematicas
    .map((t) => [t.nome, t.palavras.filter((re) => re.test(texto)).length])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!notas.length) return { nome: "", nota: 0 };
  if (notas.length > 1 && notas[0][1] === notas[1][1]) return { nome: "", nota: notas[0][1] }; // empate
  return { nome: notas[0][0], nota: notas[0][1] };
}

function decidirTematica(r, regras) {
  if (!String(r.biografia || "").trim()) return null;
  // 0. temas de pesquisa extraídos (tema_ia) são a pista mais específica
  if (r.tema_ia) {
    const pelosTemas = tematicaPelasPalavras(r.tema_ia, regras);
    if (pelosTemas.nome) return { tematica: pelosTemas.nome, origem: "inferido_temas" };
  }
  const curso = cursoDaBiografia(r.biografia);
  const pCurso = tematicaPeloCurso(curso, regras, "curso");
  if (pCurso) return { tematica: pCurso, origem: "inferido_curso" };
  const pal = tematicaPelasPalavras(r.biografia, regras);
  if (pal.nome && pal.nota >= 2) return { tematica: pal.nome, origem: "inferido_palavras" };
  const pPadrao = tematicaPeloCurso(curso, regras, "padrao");
  if (pPadrao) return { tematica: pPadrao, origem: "inferido_curso" };
  if (pal.nome) return { tematica: pal.nome, origem: "inferido_palavras_fraco" };
  return null;
}

function inferirTematica(registros) {
  const regras = carregarRegrasTematicas();

  // temáticas da base antiga, pelo lattes_id
  const antiga = new Map();
  const arquivoAntigo = path.join(PASTA, "dados_simcc_completo.json");
  if (fs.existsSync(arquivoAntigo)) {
    for (const a of JSON.parse(fs.readFileSync(arquivoAntigo, "utf8")).data || []) {
      const t = String(a["TEMÁTICA IA"] || "").trim();
      if (t && t !== "null") antiga.set(String(a.lattes_id), t);
    }
  }

  const conta = {};
  const val = {};
  for (const r of registros) {
    const real = antiga.get(String(r.lattes_id));
    const d = decidirTematica(r, regras);
    if (real && d) { // validação: regras x temática real
      val[d.origem] = val[d.origem] || [0, 0];
      val[d.origem][0] += 1;
      if (d.tematica === real) val[d.origem][1] += 1;
    }
    if (real) { r.tematica_ia = real; r.tematica_ia_origem = "fonte_antiga"; }
    else if (d) { r.tematica_ia = d.tematica; r.tematica_ia_origem = d.origem; }
    else { r.tematica_ia = ""; r.tematica_ia_origem = ""; }
    const k = r.tematica_ia_origem || "branco";
    conta[k] = (conta[k] || 0) + 1;
  }

  const pct = ([n, ok]) => `${(ok / n * 100).toFixed(1)}% em ${n}`;
  console.log(`    regras: ${regras.tematicas.length} temáticas (data/regras/tematicas.json)`);
  console.log(`    resultado: ${Object.entries(conta).map(([k, v]) => `${k} ${v}`).join(" | ")}`);
  console.log(`    validação (bolsistas da base antiga): ${Object.entries(val).map(([k, v]) => `${k} ${pct(v)}`).join(" | ")}`);
  return registros;
}

// ---------------------------------------------------------------------------
// ETAPA — resumirBiografia  →  grava abstract_ai e abstract_ai_origem
// Resumo da biografia com no máximo LIMITE_RESUMO caracteres.
// - biografia até o limite             → usa o texto original            ("original")
// - resumo feito pela IA no cache      → usa o resumo                    ("ia")
//   (cache: data/cache/abstract_ai.json, por id + impressão digital da biografia;
//    se a biografia mudar, o resumo antigo deixa de valer e volta a ser pendente)
// - sem resumo ainda                   → biografia cortada no fim de uma frase ("provisorio")
//   e o id vai para data/cache/abstract_ai_pendentes.json (mais longas primeiro).
// Os resumos são gerados pela IA dentro do chat, com a ferramenta
// data/ferramentas/resumos.js (comandos "lote" e "gravar").
// ---------------------------------------------------------------------------
const LIMITE_RESUMO = 900;
const CACHE_RESUMOS = path.join(PASTA, "cache", "abstract_ai.json");
const PENDENTES_RESUMOS = path.join(PASTA, "cache", "abstract_ai_pendentes.json");

function impressaoDigital(texto) {
  return require("crypto").createHash("sha1").update(String(texto || "").trim()).digest("hex").slice(0, 12);
}

function cortarNoFimDeFrase(texto, limite) {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  if (t.length <= limite) return t;
  const trecho = t.slice(0, limite - 1);
  const fim = Math.max(trecho.lastIndexOf(". "), trecho.lastIndexOf("; "));
  if (fim > limite * 0.5) return trecho.slice(0, fim + 1).trim();
  return trecho.slice(0, trecho.lastIndexOf(" ")).trim() + "…";
}

function resumirBiografia(registros) {
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE_RESUMOS, "utf8")); } catch { cache = {}; }

  const conta = { original: 0, ia: 0, provisorio: 0, branco: 0, desatualizado: 0 };
  const pendentes = [];
  for (const r of registros) {
    const bio = String(r.biografia || "").replace(/\s+/g, " ").trim();
    if (!bio) { r.abstract_ai = ""; r.abstract_ai_origem = ""; conta.branco += 1; continue; }
    if (bio.length <= LIMITE_RESUMO) { r.abstract_ai = bio; r.abstract_ai_origem = "original"; conta.original += 1; continue; }

    const hash = impressaoDigital(bio);
    const salvo = cache[r.id];
    if (salvo && salvo.hash === hash && salvo.resumo && salvo.resumo.length <= LIMITE_RESUMO) {
      r.abstract_ai = salvo.resumo;
      r.abstract_ai_origem = "ia";
      conta.ia += 1;
      continue;
    }
    if (salvo && salvo.hash !== hash) conta.desatualizado += 1;
    r.abstract_ai = cortarNoFimDeFrase(bio, LIMITE_RESUMO);
    r.abstract_ai_origem = "provisorio";
    conta.provisorio += 1;
    pendentes.push({ id: r.id, nome: r.nome, tamanho: bio.length, hash });
  }

  pendentes.sort((a, b) => b.tamanho - a.tamanho); // mais longas primeiro
  fs.mkdirSync(path.dirname(PENDENTES_RESUMOS), { recursive: true });
  fs.writeFileSync(PENDENTES_RESUMOS, JSON.stringify({ gerado_em: new Date().toISOString(), limite: LIMITE_RESUMO, total: pendentes.length, pendentes }, null, 1));

  console.log(`    resultado: original (≤ ${LIMITE_RESUMO}) ${conta.original} | resumo IA ${conta.ia} | provisório ${conta.provisorio} | sem biografia ${conta.branco}`);
  console.log(`    pendentes de resumo pela IA: ${pendentes.length}${conta.desatualizado ? ` (${conta.desatualizado} por biografia alterada)` : ""} → data/cache/abstract_ai_pendentes.json`);
  return registros;
}

// ---------------------------------------------------------------------------
// ETAPA — resumirTopicos  →  grava biografia_topicos e biografia_topicos_origem
// Resumo da biografia em tópicos (na ordem em que aparecem no texto),
// com no máximo LIMITE_TOPICOS caracteres no total. Formato: uma linha por tópico, "• texto".
// - resumo em tópicos feito pela IA no cache → usa os tópicos            ("ia")
//   (cache: data/cache/biografia_topicos.json, por id + impressão digital da biografia)
// - sem resumo ainda → frases da biografia viram tópicos, até o limite   ("provisorio")
//   e o id vai para data/cache/biografia_topicos_pendentes.json (mais longas primeiro).
// Gerados pela IA no chat com: node data/ferramentas/resumos.js topicos lote|gravar
// Regras de escrita (o que entra, o que sai, como condensar): data/regras/biografia_topicos.md
// ---------------------------------------------------------------------------
const LIMITE_TOPICOS = 600;
const CACHE_TOPICOS = path.join(PASTA, "cache", "biografia_topicos.json");
const PENDENTES_TOPICOS = path.join(PASTA, "cache", "biografia_topicos_pendentes.json");

// Estratégia de lotes por importância
const TAMANHO_LOTE = 25;
const FAIXA_CLASSIFICACAO = { "A+": 1, A: 2, "B+": 3, B: 4, "C+": 5, C: 6, "D+": 7, D: 8, "E+": 9, E: 10 };
const PESO_TITULACAO = { "Pós-Doutorado": 5, Doutorado: 4, Mestrado: 3, "Especialização": 2, "Graduação": 1 };

function juntarTopicos(lista) {
  return lista.map((t) => `• ${t}`).join("\n");
}

function frasesEmTopicos(texto, limite) {
  const frases = String(texto || "").replace(/\s+/g, " ").trim()
    .split(/(?<=[.;!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9])/)
    .map((f) => f.replace(/[.;]+$/, "").trim())
    .filter(Boolean);
  const escolhidas = [];
  for (const f of frases) {
    const teste = juntarTopicos([...escolhidas, f]);
    if (teste.length > limite) {
      if (!escolhidas.length) escolhidas.push(cortarNoFimDeFrase(f, limite - 2));
      break;
    }
    escolhidas.push(f);
  }
  return juntarTopicos(escolhidas);
}

function resumirTopicos(registros) {
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE_TOPICOS, "utf8")); } catch { cache = {}; }

  const conta = { ia: 0, provisorio: 0, branco: 0, desatualizado: 0 };
  const pendentes = [];
  for (const r of registros) {
    const bio = String(r.biografia || "").replace(/\s+/g, " ").trim();
    if (!bio) { r.biografia_topicos = ""; r.biografia_topicos_origem = ""; conta.branco += 1; continue; }

    const hash = impressaoDigital(bio);
    const salvo = cache[r.id];
    if (salvo && salvo.hash === hash && Array.isArray(salvo.topicos) && salvo.topicos.length) {
      r.biografia_topicos = juntarTopicos(salvo.topicos);
      r.biografia_topicos_origem = "ia";
      conta.ia += 1;
      continue;
    }
    if (salvo && salvo.hash !== hash) conta.desatualizado += 1;
    r.biografia_topicos = frasesEmTopicos(bio, LIMITE_TOPICOS);
    r.biografia_topicos_origem = "provisorio";
    conta.provisorio += 1;
    pendentes.push({ id: r.id, nome: r.nome, tamanho: bio.length, hash });
  }

  // Ordem dos lotes: importância do pesquisador (faixa da classificação),
  // depois titulação, número de artigos e tamanho da biografia.
  const porId = new Map(registros.map((r) => [r.id, r]));
  for (const p of pendentes) {
    const r = porId.get(p.id);
    p.faixa = FAIXA_CLASSIFICACAO[r.classificacao] || 10;
    p.classificacao = r.classificacao || "";
    p.titulacao = r.graduacao || "";
    p.artigos = Number(r.artigos) || 0;
  }
  pendentes.sort((a, b) =>
    a.faixa - b.faixa ||
    (PESO_TITULACAO[b.titulacao] || 0) - (PESO_TITULACAO[a.titulacao] || 0) ||
    b.artigos - a.artigos ||
    b.tamanho - a.tamanho);
  pendentes.forEach((p, i) => { p.lote = Math.floor(i / TAMANHO_LOTE) + 1; });
  fs.mkdirSync(path.dirname(PENDENTES_TOPICOS), { recursive: true });
  fs.writeFileSync(PENDENTES_TOPICOS, JSON.stringify({ gerado_em: new Date().toISOString(), limite: LIMITE_TOPICOS, tamanho_lote: TAMANHO_LOTE, total: pendentes.length, pendentes }, null, 1));

  console.log(`    resultado: tópicos IA ${conta.ia} | provisório ${conta.provisorio} | sem biografia ${conta.branco}`);
  console.log(`    pendentes de tópicos pela IA: ${pendentes.length}${conta.desatualizado ? ` (${conta.desatualizado} por biografia alterada)` : ""} → data/cache/biografia_topicos_pendentes.json`);
  return registros;
}

// ---------------------------------------------------------------------------
// ETAPAS de transformação (executadas em ordem depois de carregar)
// Cada etapa recebe a lista de registros e devolve a lista (pode ser async).
// ---------------------------------------------------------------------------
const ETAPAS = [
  inferirSexo,             // 1. pelo nome (IBGE)
  inferirSexoSufixoNome,   // 1b. nome terminado em Neto/Filho/Júnior/Sobrinho → M
  inferirSexoBiografia,    // 2. primeira inferência pela biografia
  inferirSexoBiografia2,   // 3. segunda inferência: 1 palavra masculina confiável → M
  inferirSexoBiografia3,   // 4. terceira inferência: aluno, graduando, médico, professor, mestre (e femininos)
  inferirArea,             // 5. area_ia: copia a área da fonte ou infere pelo curso / biografia
  inferirArea2,            // 6. area_ia: segunda inferência (biografia, sem confiança mínima)
  extrairTema,             // 7a. tema_ia: temas de pesquisa extraídos da biografia
  inferirTematica,         // 7. tematica_ia: base antiga / curso / palavras-chave (regras em data/regras/tematicas.json)
  resumirBiografia,        // 8. abstract_ai: resumo da biografia (≤ 900 caracteres) feito pela IA no chat
  resumirTopicos,          // 9. biografia_topicos: resumo em tópicos (≤ 600 caracteres) feito pela IA no chat
];

// Descrição de cada etapa (aparece na aba Pipeline de data/dados.html)
const DESCRICOES = {
  carregar: { titulo: "Carregar CSV", tipo: "entrada", texto: "Lê pesquisadores.csv e cria um registro por linha, mantendo colunas e valores como vieram. Campos sem dados ficam em branco." },
  inferirSexo: { titulo: "Sexo pelo nome", tipo: "transformacao", texto: "Infere F/M pelo primeiro nome com a frequência do Censo IBGE (≥ 90% de um sexo). Ambíguos ou não encontrados ficam em branco." },
  inferirSexoSufixoNome: { titulo: "Sexo pelo sufixo", tipo: "transformacao", texto: "Para quem ficou sem sexo: nome terminado em Neto, Filho, Júnior ou Sobrinho → M (99,2%)." },
  inferirSexoBiografia: { titulo: "Sexo pela biografia", tipo: "transformacao", texto: "Palavras de autodescrição com gênero (professora, graduado…). F se há forma feminina ≥ masculina; M se 2+ masculinas e nenhuma feminina." },
  inferirSexoBiografia2: { titulo: "Sexo pela biografia 2", tipo: "transformacao", texto: "Uma palavra masculina confiável sozinha (graduado, licenciado, doutorando, professor…) e nenhuma feminina → M." },
  inferirArea: { titulo: "Área (area_ia)", tipo: "transformacao", texto: "Se existe area, copia para area_ia. Senão, infere pelo curso citado na biografia (tabela curso → área aprendida dos dados) ou pelas palavras da biografia (só com confiança média ou alta)." },
  inferirArea2: { titulo: "Área 2 (area_ia)", tipo: "transformacao", texto: "Para quem ainda está sem area_ia e tem biografia: a área mais provável pelas palavras da biografia, sem exigir confiança mínima. Menos precisa que a primeira (~67%)." },
  extrairTema: { titulo: "Tema (tema_ia)", tipo: "transformacao", texto: "Extrai da biografia os temas de pesquisa: a lista após \"seguintes temas:\" ou, se não houver, o trecho \"com ênfase em…\". Formato: A; B; C." },
  resumirBiografia: { titulo: "Resumo (abstract_ai)", tipo: "transformacao", texto: "Resumo da biografia com até 900 caracteres. Biografias curtas usam o texto original; as longas usam o resumo feito pela IA no chat (cache em data/cache/abstract_ai.json) ou, enquanto não houver, a biografia cortada no fim de uma frase." },
  resumirTopicos: { titulo: "Tópicos (biografia_topicos)", tipo: "transformacao", texto: "Resumo da biografia em tópicos, na ordem em que aparecem no texto, com até 600 caracteres. Usa os tópicos feitos pela IA no chat (cache em data/cache/biografia_topicos.json) ou, enquanto não houver, as frases da biografia como tópicos até o limite. Regras de escrita em data/regras/biografia_topicos.md." },
  inferirTematica: { titulo: "Temática (tematica_ia)", tipo: "transformacao", texto: "Classifica nas 57 temáticas: bolsistas antigos mantêm a sua; os demais pelo curso citado ou pelas palavras-chave da biografia. Regras editáveis em data/regras/tematicas.json." },
  inferirSexoBiografia3: { titulo: "Sexo pela biografia 3", tipo: "transformacao", texto: "Pares escolhidos pela equipe (aluno, graduando, médico, professor, mestre, pesquisador, monitor, secretário, estagiário, voluntário). Só um gênero presente → esse gênero." }
};

// Executa uma etapa guardando o log, o tempo e as contagens (para o desenho do pipeline)
async function executarEtapa(nome, funcao) {
  const linhas = [];
  const logOriginal = console.log;
  console.log = (...args) => { const t = args.join(" "); linhas.push(t.trim()); logOriginal(...args); };
  const inicio = Date.now();
  try {
    return { resultado: await funcao(), linhas, duracao_ms: Date.now() - inicio };
  } finally {
    console.log = logOriginal;
  }
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------
async function main() {
  const inicio = Date.now();
  console.log("atualizar_dados: iniciando");
  const pipeline = [];

  const passo = await executarEtapa("carregar", () => carregar());
  const { colunas, registros: carregados, problemas } = passo.resultado;
  console.log(`  carregar: ${carregados.length} registros, ${colunas.length} colunas`);
  if (problemas.length) {
    console.warn(`  atenção: ${problemas.length} linha(s) com número de colunas diferente`);
    problemas.slice(0, 10).forEach((p) => console.warn(`    - ${p}`));
  }
  pipeline.push({
    nome: "carregar", ...DESCRICOES.carregar, entrada: carregados.length, saida: carregados.length,
    duracao_ms: passo.duracao_ms,
    log: [
      `${carregados.length} registros, ${colunas.length} colunas`,
      ...(problemas.length ? [`${problemas.length} linha(s) com número de colunas diferente`] : [])
    ]
  });

  let registros = carregados;
  for (const etapa of ETAPAS) {
    const antes = registros.length;
    console.log(`  ${etapa.name}: executando...`);
    const r = await executarEtapa(etapa.name, () => etapa(registros));
    registros = r.resultado;
    console.log(`  ${etapa.name}: ${antes} → ${registros.length} registros`);
    pipeline.push({
      nome: etapa.name,
      ...(DESCRICOES[etapa.name] || { titulo: etapa.name, tipo: "transformacao", texto: "" }),
      entrada: antes, saida: registros.length, duracao_ms: r.duracao_ms,
      log: r.linhas.filter((l) => l && !l.startsWith("IBGE:"))
    });
  }

  // campos = colunas do CSV + colunas criadas pelas etapas (na ordem em que aparecem)
  const campos = [...new Set([...colunas, ...registros.flatMap((r) => Object.keys(r))])];

  pipeline.push({
    nome: "gravar", titulo: "Gravar JSON", tipo: "saida",
    texto: "Grava data/pesquisadores.json completo (uso local, fora do git) e a versão do site: data/publico/indice.json (campos curtos) + data/publico/detalhes/XX.json (biografia e resumos, em partes pelo início do id).",
    entrada: registros.length, saida: registros.length, duracao_ms: 0,
    log: [`${campos.length} campos`]
  });

  const saida = {
    metadata: {
      fonte: path.basename(ENTRADA),
      gerado_em: new Date().toISOString(),
      total_registros: registros.length,
      campos,
      etapas: ["carregar", ...ETAPAS.map((e) => e.name)],
      pipeline,
      duracao_total_ms: Date.now() - inicio
    },
    data: registros
  };

  fs.writeFileSync(SAIDA, JSON.stringify(saida));
  const mb = (fs.statSync(SAIDA).size / 1024 / 1024).toFixed(1);
  console.log(`atualizar_dados: ${path.basename(SAIDA)} gravado (${mb} MB) em ${((Date.now() - inicio) / 1000).toFixed(1)}s`);

  gravarPublico(saida);
}

// ---------------------------------------------------------------------------
// Saída para o site (versionada no git): índice leve + detalhes em partes
//   data/publico/indice.json         campos curtos de todos os registros, em colunas
//                                    ({ metadata, campos, linhas: [[...], ...] })
//   data/publico/detalhes/XX.json    textos longos, por id, agrupados pelos 2
//                                    primeiros caracteres do id (00 … ff)
// O pesquisadores.json completo continua sendo gravado, mas só para uso local
// (data/dados.html e data/ferramentas/resumos.js) e fica fora do git.
// ---------------------------------------------------------------------------
const PUBLICO = path.join(PASTA, "publico");
const CAMPOS_DETALHE = [
  "biografia", "abstract_ai", "abstract_ai_origem",
  "biografia_topicos", "biografia_topicos_origem",
  "tema_ia", "tema_ia_origem",
];
const parteDoId = (id) => {
  const p = String(id || "").slice(0, 2).toLowerCase();
  return /^[0-9a-f]{2}$/.test(p) ? p : "xx";
};

function gravarPublico(saida) {
  const { metadata, data: registros } = saida;
  const camposIndice = metadata.campos.filter((c) => !CAMPOS_DETALHE.includes(c));

  const indice = {
    metadata: { ...metadata, pipeline: undefined, campos_indice: camposIndice, campos_detalhe: CAMPOS_DETALHE },
    campos: camposIndice,
    linhas: registros.map((r) => camposIndice.map((c) => r[c] ?? "")),
  };

  const partes = {};
  for (const r of registros) {
    const detalhe = {};
    for (const c of CAMPOS_DETALHE) if (r[c] !== undefined && r[c] !== "") detalhe[c] = r[c];
    (partes[parteDoId(r.id)] ||= {})[r.id] = detalhe;
  }

  const pastaDetalhes = path.join(PUBLICO, "detalhes");
  fs.rmSync(pastaDetalhes, { recursive: true, force: true }); // remove partes antigas
  fs.mkdirSync(pastaDetalhes, { recursive: true });
  fs.writeFileSync(path.join(PUBLICO, "indice.json"), JSON.stringify(indice));
  for (const [parte, conteudo] of Object.entries(partes)) {
    fs.writeFileSync(path.join(pastaDetalhes, `${parte}.json`), JSON.stringify(conteudo));
  }

  const tamanho = (f) => fs.statSync(f).size / 1024 / 1024;
  const arquivos = Object.keys(partes).map((p) => path.join(pastaDetalhes, `${p}.json`));
  const maior = Math.max(...arquivos.map(tamanho));
  console.log(
    `atualizar_dados: publico/indice.json (${tamanho(path.join(PUBLICO, "indice.json")).toFixed(1)} MB) ` +
    `+ ${arquivos.length} partes em publico/detalhes (maior: ${(maior * 1024).toFixed(0)} KB)`
  );
}

main().catch((erro) => {
  console.error(`atualizar_dados: ERRO — ${erro.message}`);
  process.exit(1);
});
