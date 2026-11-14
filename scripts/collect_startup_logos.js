const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.join(ROOT, "data", "startups.csv");
const OUTPUT_DIR = path.join(ROOT, "assets", "startups", "logos");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36";
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "live.com", "icloud.com",
  "yahoo.com", "yahoo.com.br", "uol.com.br", "bol.com.br", "terra.com.br"
]);
const PLATFORM_HOSTS = /(^|\.)(google\.com|googleusercontent\.com|canva\.com|canva\.link|youtube\.com|youtu\.be|sharepoint\.com|1drv\.ms|zohoexternal\.com)$/i;
// Imagens descartadas depois da conferência visual: eram marcas de parceiros,
// fornecedores ou capturas de conteúdo, e não a identidade da startup indicada.
const VISUAL_REJECTIONS = new Map([
  [13, "a imagem encontrada é da Inforeis, não da Greenchat"],
  [20, "a imagem encontrada é da Sistemas Connecta, não da TempusMed"],
  [24, "a imagem é um diagrama e não a logo da Maker Lab 3D"],
  [38, "a imagem encontrada é o ícone do LinkedIn, não a logo da Levolt"],
  [39, "a imagem encontrada pertence ao Instituto Gaia Soul, não à Imersão Azul"],
  [46, "o ícone encontrado não identifica a startup O.S.10"],
  [48, "a imagem encontrada é uma ilustração de etapa, não a logo da C2C Seller"],
  [53, "a imagem encontrada é um banner, não uma logo isolada"],
  [54, "a imagem encontrada é uma captura de quadro, não a logo da TRILHA-i"],
  [59, "a imagem encontrada é da Eletro Segurança, não da Eletroid"],
  [63, "a imagem encontrada é do Instituto Brasil Solidário, não da Impactaê"],
  [65, "a imagem encontrada é da Ignix AI, não da RitMEI"],
  [66, "a imagem encontrada é da Drones Solution, não da Voxel4D"],
  [87, "a imagem encontrada é uma fotografia, não a logo da Prolytiq"],
  [93, "a imagem encontrada é da InterAtiva, não da QLIFE"],
  [96, "a imagem encontrada é da Hub Conquista, não da Orzon"],
  [116, "a imagem encontrada é da Advice Group, não da Kontulari"]
]);

function parseCSV(text, separator = ";") {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === separator && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  const headers = (rows.shift() || []).map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.map((cells) => Object.fromEntries(headers.map((header, i) => [header, cells[i] || ""])));
}

function slug(value) {
  return String(value || "startup")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "startup";
}

function attrs(tag) {
  const result = {};
  const expression = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = expression.exec(tag))) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  return result;
}

function absoluteURL(value, pageURL) {
  if (!value || /^(data:|javascript:|#)/i.test(value)) return null;
  try { return new URL(value, pageURL).href; } catch { return null; }
}

function extractImageCandidates(html, pageURL, startupName) {
  const candidates = [];
  const tokens = slug(startupName).split("-").filter((token) => token.length >= 4).slice(0, 4);
  const add = (url, score, method) => {
    const absolute = absoluteURL(url, pageURL);
    if (!absolute || !/^https?:/i.test(absolute)) return;
    if (/sprite|pixel|tracking|spacer|loader|avatar|facebook|instagram|linkedin|whatsapp/i.test(absolute)) score -= 60;
    candidates.push({ url: absolute, score, method });
  };

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const properties = attrs(tag);
    const source = properties.src || properties["data-src"] || properties["data-lazy-src"] || properties["data-original"];
    const start = Math.max(0, match.index - 220);
    const context = `${html.slice(start, match.index)} ${tag}`.toLowerCase();
    let score = 0;
    if (/logo|logotipo|brand|marca/.test(context)) score += 120;
    if (tokens.some((token) => context.includes(token))) score += 35;
    if (/header|navbar|menu-principal|site-brand/.test(context)) score += 25;
    if (/\.svg(?:\?|$)/i.test(source || "")) score += 15;
    if (properties.width && Number(properties.width) < 24) score -= 60;
    add(source, score, "imagem marcada como logo no site");
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const properties = attrs(tag);
    const rel = String(properties.rel || "").toLowerCase();
    if (!rel.includes("icon")) continue;
    const score = rel.includes("apple-touch-icon") ? 65 : rel.includes("mask-icon") ? 60 : 35;
    add(properties.href, score, rel.includes("apple") ? "ícone institucional do site" : "favicon do site");
  }

  return [...new Map(candidates.sort((a, b) => b.score - a.score).map((item) => [item.url, item])).values()]
    .filter((item) => item.score >= 55);
}

function imageExtension(contentType, url, buffer) {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("svg") || buffer.subarray(0, 200).toString("utf8").includes("<svg")) return ".svg";
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("gif")) return ".gif";
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  const found = new URL(url).pathname.match(/\.(svg|png|webp|gif|jpe?g)$/i);
  return found ? `.${found[1].toLowerCase().replace("jpeg", "jpg")}` : null;
}

async function fetchWithTimeout(url, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...options,
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, "accept-language": "pt-BR,pt;q=0.9,en;q=0.7", ...(options.headers || {}) }
    });
  } finally {
    clearTimeout(timer);
  }
}

function candidatePages(record) {
  const pages = [];
  const emailDomain = String(record["E-mail"] || "").split("@").pop().toLowerCase();
  if (emailDomain && !GENERIC_EMAIL_DOMAINS.has(emailDomain) && !emailDomain.endsWith(".edu.br")) {
    pages.push(`https://${emailDomain}/`, `https://www.${emailDomain}/`);
  }
  try {
    const pitch = new URL(record["Pitch deck"]);
    if (!PLATFORM_HOSTS.test(pitch.hostname)) pages.push(pitch.href, pitch.origin);
  } catch { /* URL inválida é registrada no manifesto */ }
  return [...new Set(pages)];
}

async function collectOne(record) {
  const rank = String(record.Rank || "0").padStart(3, "0");
  const baseName = `${rank}-${slug(record.Startup)}`;
  const pages = candidatePages(record);
  const pageErrors = [];

  for (const page of pages) {
    try {
      const response = await fetchWithTimeout(page, { headers: { accept: "text/html,application/xhtml+xml" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("html")) throw new Error(`conteúdo ${contentType || "desconhecido"}`);
      const html = await response.text();
      const candidates = extractImageCandidates(html, response.url, record.Startup);

      for (const candidate of candidates.slice(0, 10)) {
        try {
          const imageResponse = await fetchWithTimeout(candidate.url, {
            headers: { accept: "image/avif,image/webp,image/svg+xml,image/png,image/jpeg,*/*", referer: response.url }
          });
          if (!imageResponse.ok) continue;
          const arrayBuffer = await imageResponse.arrayBuffer();
          if (!arrayBuffer.byteLength || arrayBuffer.byteLength > 12 * 1024 * 1024) continue;
          const buffer = Buffer.from(arrayBuffer);
          const extension = imageExtension(imageResponse.headers.get("content-type"), imageResponse.url, buffer);
          if (!extension) continue;
          const fileName = `${baseName}${extension}`;
          fs.writeFileSync(path.join(OUTPUT_DIR, fileName), buffer);
          return {
            rank: Number(record.Rank), startup: record.Startup, status: "baixada", arquivo: fileName,
            origem_pagina: response.url, origem_imagem: imageResponse.url, metodo: candidate.method,
            pitch_deck: record["Pitch deck"], observacao: ""
          };
        } catch (error) {
          pageErrors.push(`${candidate.url}: ${error.message}`);
        }
      }
      pageErrors.push(`${response.url}: nenhuma imagem identificada explicitamente como logo`);
    } catch (error) {
      pageErrors.push(`${page}: ${error.message}`);
    }
  }

  return {
    rank: Number(record.Rank), startup: record.Startup, status: "não encontrada", arquivo: "",
    origem_pagina: "", origem_imagem: "", metodo: "", pitch_deck: record["Pitch deck"],
    observacao: pages.length ? pageErrors.slice(0, 4).join(" | ") : "sem domínio empresarial ou site próprio no pitch"
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const source = new TextDecoder("windows-1252").decode(fs.readFileSync(CSV_PATH));
  const records = parseCSV(source);
  const results = new Array(records.length);
  let cursor = 0;
  const workers = Array.from({ length: 8 }, async () => {
    while (cursor < records.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await collectOne(records[index]);
      const marker = results[index].status === "baixada" ? "OK" : "--";
      console.log(`[${marker}] ${records[index].Rank}. ${records[index].Startup}`);
    }
  });
  await Promise.all(workers);
  results.sort((a, b) => a.rank - b.rank);
  for (const result of results) {
    const rejection = VISUAL_REJECTIONS.get(result.rank);
    if (!rejection || result.status !== "baixada") continue;
    const filePath = path.join(OUTPUT_DIR, result.arquivo);
    if (fs.existsSync(filePath)) fs.rmSync(filePath);
    result.status = "rejeitada na revisão";
    result.arquivo = "";
    result.observacao = rejection;
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify({ gerado_em: new Date().toISOString(), total: results.length, resultados: results }, null, 2)}\n`);
  const columns = ["rank", "startup", "status", "arquivo", "metodo", "origem_pagina", "origem_imagem", "pitch_deck", "observacao"];
  const csv = [columns.join(";"), ...results.map((item) => columns.map((column) => csvEscape(item[column])).join(";"))].join("\r\n");
  fs.writeFileSync(path.join(OUTPUT_DIR, "manifest.csv"), `\uFEFF${csv}\r\n`);
  const downloaded = results.filter((item) => item.status === "baixada").length;
  console.log(`Concluído: ${downloaded}/${results.length} logos baixadas em ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
