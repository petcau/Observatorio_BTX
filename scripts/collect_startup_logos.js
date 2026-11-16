const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.join(ROOT, "data", "startups.csv");
const OUTPUT_DIR = path.join(ROOT, "assets", "startups", "logos");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36";
const VALIDATED_FIELD = "Site validado manualmente";
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "live.com", "icloud.com",
  "yahoo.com", "yahoo.com.br", "uol.com.br", "bol.com.br", "terra.com.br"
]);
const PLATFORM_HOSTS = /(^|\.)(google\.com|googleusercontent\.com|canva\.com|canva\.link|youtube\.com|youtu\.be|sharepoint\.com|1drv\.ms|zohoexternal\.com)$/i;
// Imagens descartadas depois da conferência visual: eram marcas de parceiros,
// fornecedores ou capturas de conteúdo, e não a identidade da startup indicada.
const VISUAL_REJECTIONS = new Map([
  [6, "a imagem encontrada é da plataforma eFirma, não da Moradia Legal"],
  [28, "a imagem encontrada é uma fotografia, não a logo da Capim Pimenta"],
  [38, "a imagem encontrada é o ícone do LinkedIn, não a logo da Levolt"],
  [41, "o arquivo encontrado é um ícone vazio e não identifica a UZE Collection Center"],
  [48, "a imagem encontrada é uma ilustração de etapa, não a logo da C2C Seller"],
  [53, "a imagem encontrada é um banner, não uma logo isolada"]
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
  const decoded = String(value).replace(/&amp;/gi, "&").replace(/&#x2F;/gi, "/");
  try { return new URL(decoded, pageURL).href; } catch { return null; }
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
    const srcset = String(properties.srcset || properties["data-srcset"] || "").split(",")[0].trim().split(/\s+/)[0];
    const source = properties.src || properties["data-src"] || properties["data-lazy-src"] || properties["data-original"] || srcset;
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

  for (const match of html.matchAll(/["']logo["']\s*:\s*["']([^"']+)["']/gi)) {
    add(match[1], 130, "logo declarada nos dados estruturados do site");
  }

  for (const match of html.matchAll(/(?:logo|logotipo|site-brand)[^{}]{0,180}url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    add(match[1], 115, "logo declarada no estilo do site");
  }

  const isSocialPlatform = /(^|\.)(instagram\.com|linkedin\.com)$/i.test(new URL(pageURL).hostname);
  return [...new Map(candidates.sort((a, b) => b.score - a.score).map((item) => [item.url, item])).values()]
    .filter((item) => item.score >= 55 || (!isSocialPlatform && item.score >= 35 && /ícone|favicon/.test(item.method)));
}

function imageExtension(contentType, url, buffer) {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("svg") || buffer.subarray(0, 200).toString("utf8").includes("<svg")) return ".svg";
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("gif")) return ".gif";
  if (type.includes("icon") || type.includes("ico")) return ".ico";
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  const found = new URL(url).pathname.match(/\.(svg|png|webp|gif|ico|jpe?g)$/i);
  return found ? `.${found[1].toLowerCase().replace("jpeg", "jpg")}` : null;
}

function isHtmlDocument(buffer) {
  return /<(?:!doctype\s+html|html)\b/i.test(buffer.subarray(0, 512).toString("utf8"));
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
  try {
    const site = new URL(String(record.Site || "").trim());
    pages.push(site.href);
    if (site.pathname !== "/" || site.search || site.hash) pages.push(`${site.origin}/`);
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
          if (isHtmlDocument(buffer)) continue;
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

  try {
    const site = new URL(String(record.Site || "").trim());
    const isSocialPlatform = /(^|\.)(instagram\.com|linkedin\.com)$/i.test(site.hostname);
    const commonPaths = [
      "/logo.svg", "/logo.png", "/assets/logo.svg", "/assets/logo.png",
      "/images/logo.svg", "/images/logo.png", "/img/logo.svg", "/img/logo.png",
      "/apple-touch-icon.png", "/favicon.png", "/favicon.ico"
    ];
    if (!isSocialPlatform) {
      for (const commonPath of commonPaths) {
        const imageURL = new URL(commonPath, site.origin).href;
        try {
          const imageResponse = await fetchWithTimeout(imageURL, { headers: { accept: "image/*,*/*" } }, 3000);
          if (!imageResponse.ok) continue;
          const arrayBuffer = await imageResponse.arrayBuffer();
          if (!arrayBuffer.byteLength || arrayBuffer.byteLength > 12 * 1024 * 1024) continue;
          const buffer = Buffer.from(arrayBuffer);
          if (isHtmlDocument(buffer)) continue;
          const extension = imageExtension(imageResponse.headers.get("content-type"), imageResponse.url, buffer);
          if (!extension) continue;
          const fileName = `${baseName}${extension}`;
          fs.writeFileSync(path.join(OUTPUT_DIR, fileName), buffer);
          return {
            rank: Number(record.Rank), startup: record.Startup, status: "baixada", arquivo: fileName,
            origem_pagina: site.href, origem_imagem: imageResponse.url, metodo: "arquivo institucional no domínio validado",
            pitch_deck: record["Pitch deck"], observacao: ""
          };
        } catch { /* tenta o próximo caminho conhecido */ }
      }
    }
  } catch { /* URL inválida já será registrada abaixo */ }

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
  for (const name of fs.readdirSync(OUTPUT_DIR)) {
    if (/\.(?:svg|png|webp|gif|ico|jpe?g)$/i.test(name)) fs.rmSync(path.join(OUTPUT_DIR, name));
  }
  const bytes = fs.readFileSync(CSV_PATH);
  const hasUtf8Bom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
  const source = new TextDecoder(hasUtf8Bom ? "utf-8" : "windows-1252").decode(bytes);
  const records = parseCSV(source).filter((record) => /^(?:sim|yes|true|1|x|validado)$/i.test(String(record[VALIDATED_FIELD] || "").trim()));
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
