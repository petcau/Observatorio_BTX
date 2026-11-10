(() => {
  "use strict";

  const CSV_URL = "data/pesquisadoras.csv";
  const JSON_URL = "data/dados_simcc_completo.json";
  const PAULO_TEMPLATE_IMAGE = "assets/perfil-template-btx.png";
  // no celular a ficha não mostra o brasão do Estado
  const PAULO_TEMPLATE_IMAGE_PHONE = "assets/perfil-template-btx-celular.png";
  const isPhoneScreen = () => document.documentElement.classList.contains("is-handheld") || window.matchMedia("(max-width: 760px)").matches;
  const RESEARCHER_PAGE_SIZE = 10;
  const SHOWCASE_METRIC_THRESHOLDS = {
    publications: 10,
    citations: 100,
    hindex: 5
  };
  const LAST_DISCOVERY_KEY = "cienciaDelasLastResearcherId";
  const LOVE_STORAGE_KEY = "cienciaDelasLoveCounts";
  const AUTO_ROTATION_STORAGE_KEY = "cienciaDelasAutoRotation";
  const AUTO_ROTATION_DELAY = 30_000;
  const PRIMARY_METRICS = [
    { key: "publications", label: "Publicações", icon: "document", threshold: SHOWCASE_METRIC_THRESHOLDS.publications },
    { key: "citations", label: "Citações", icon: "quote", threshold: SHOWCASE_METRIC_THRESHOLDS.citations },
    { key: "hindex", label: "Índice h", icon: "chart", threshold: SHOWCASE_METRIC_THRESHOLDS.hindex }
  ];
  const FALLBACK_METRICS = [
    { key: "books", label: "Livros", icon: "book", threshold: 1 },
    { key: "patents", label: "Patentes", icon: "patent", threshold: 1 },
    { key: "programs", label: "Programas de computador", icon: "code", threshold: 1 }
  ];
  const INSTITUTION_LOGOS = {
    EBMSP: "assets/instituicoes/ebmsp.png",
    "FIOCRUZ-BA": "assets/instituicoes/fiocruz-ba.png",
    IFBA: "assets/instituicoes/ifba.png",
    UNEB: "assets/instituicoes/uneb.png",
    UEFS: "assets/instituicoes/uefs.png",
    UESC: "assets/instituicoes/uesc.png",
    UESB: "assets/instituicoes/uesb.png",
    UFBA: "assets/instituicoes/ufba.png",
    UFOB: "assets/instituicoes/ufob.png",
    UFRB: "assets/instituicoes/ufrb.png",
    UFSB: "assets/instituicoes/ufsb.png"
  };

  const page = document.body.dataset.page;
  const params = new URLSearchParams(window.location.search);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let researchers = [];
  let dataSourceLabel = "";
  let currentProfileId = null;
  let autoRotationEnabled = false;
  let autoRotationTimer = null;

  const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);

  function validText(value) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text && !["null", "undefined", "nan"].includes(text.toLowerCase()) ? text : null;
  }

  function firstText(...values) {
    for (const value of values) {
      const text = validText(value);
      if (text) return text;
    }
    return null;
  }

  function toNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const text = validText(value);
    if (!text) return null;
    const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  const numberFormatter = new Intl.NumberFormat("pt-BR");
  const formatNumber = (value) => Number.isFinite(Number(value)) ? numberFormatter.format(Number(value)) : "0";
  const displayOrFallback = (value) => validText(value) || "Não informado";
  const displayPublicText = (value) => displayOrFallback(value)
    .replace(/\\n/g, "\n")
    .replace(/\bsoftwares\b/gi, "programas de computador")
    .replace(/\bsoftware\b/gi, "programa de computador");

  function normalizeKey(value) {
    return String(value || "")
      .replace(/^\uFEFF/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  const areaLabels = {
    CIENCIAS_AGRARIAS: "Ciências Agrárias",
    CIENCIAS_BIOLOGICAS: "Ciências Biológicas",
    CIENCIAS_DA_SAUDE: "Ciências da Saúde",
    CIENCIAS_EXATAS_E_DA_TERRA: "Ciências Exatas e da Terra",
    CIENCIAS_HUMANAS: "Ciências Humanas",
    CIENCIAS_SOCIAIS_APLICADAS: "Ciências Sociais Aplicadas",
    ENGENHARIAS: "Engenharias",
    LINGUISTICA_LETRAS_E_ARTES: "Linguística, Letras e Artes"
  };

  function areaKey(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .toUpperCase();
  }

  function displayArea(value) {
    const text = validText(value);
    if (!text) return null;
    const key = areaKey(text);
    if (areaLabels[key]) return areaLabels[key];
    return text.toLocaleLowerCase("pt-BR").replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("pt-BR"));
  }

  function displayInstitutionName(value) {
    const text = validText(value);
    if (!text) return null;
    const lowercaseWords = new Set(["da", "de", "do", "das", "dos", "e"]);
    return text
      .toLocaleLowerCase("pt-BR")
      .replace(/(^|\s|-)\S/g, (match) => {
        const prefix = match.slice(0, -1);
        const letter = match.slice(-1);
        return `${prefix}${letter.toLocaleUpperCase("pt-BR")}`;
      })
      .replace(/\b(da|de|do|das|dos|e)\b/gi, (word) => lowercaseWords.has(word.toLocaleLowerCase("pt-BR"))
        ? word.toLocaleLowerCase("pt-BR")
        : word);
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const next = text[index + 1];

      if (character === '"') {
        if (quoted && next === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
        continue;
      }

      if (character === "," && !quoted) {
        row.push(value);
        value = "";
        continue;
      }

      if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && next === "\n") index += 1;
        row.push(value);
        if (row.some((cell) => validText(cell))) rows.push(row);
        row = [];
        value = "";
        continue;
      }

      value += character;
    }

    if (value || row.length) {
      row.push(value);
      if (row.some((cell) => validText(cell))) rows.push(row);
    }

    if (!rows.length) return [];
    const headers = rows.shift().map(normalizeKey);
    return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
  }

  function csvValue(record, ...keys) {
    return firstText(...keys.map((key) => record[normalizeKey(key)]));
  }

  function jsonValue(record, ...keys) {
    for (const key of keys) {
      if (key.includes(".")) {
        const value = key.split(".").reduce((source, part) => source?.[part], record);
        const text = validText(value);
        if (text) return text;
      } else {
        const text = validText(record[key]);
        if (text) return text;
      }
    }
    return null;
  }

  function normalizeImagePath(value) {
    const text = validText(value);
    if (!text) return null;
    if (/^(https?:|data:)/i.test(text)) return text;
    if (/^[a-z]:\\/i.test(text) || /^file:/i.test(text)) return null;

    const normalized = text.replace(/\\/g, "/").replace(/^\.?\//, "");
    if (!normalized) return null;
    if (normalized.includes("/")) return normalized.replace(/^\/+/, "");
    return `assets/pesquisadoras/${normalized}`;
  }

  function makeAreas(rawArea, rawAreaIA) {
    const source = firstText(rawArea, rawAreaIA);
    if (!source) return [];
    return [...new Set(source.split(";").map((item) => displayArea(item)).filter(Boolean))];
  }

  function normalizeResearcher(record, source) {
    const pick = source === "csv" ? csvValue : jsonValue;

    const nome = pick(record, "nome", "name");
    const id = pick(record, "id", "lattes_id", "lattes_10_id") || nome;
    if (!id || !nome) return null;

    const rawArea = pick(record, "area");
    const rawAreaIA = pick(record, "area_ia", "ÁREA IA");
    const areas = makeAreas(rawArea, rawAreaIA);
    const institution = source === "csv"
      ? pick(record, "instituicao", "university")
      : pick(record, "university", "institution.name");
    const sigla = source === "csv"
      ? pick(record, "sigla", "SIGLA IA")
      : pick(record, "SIGLA IA", "institution.acronym");

    return {
      id,
      nome,
      sexo: (pick(record, "sexo", "Sexo") || "").toUpperCase(),
      lattesId: pick(record, "lattes_id"),
      lattes10Id: pick(record, "lattes_10_id"),
      orcid: pick(record, "orcid"),
      graduacao: pick(record, "graduacao", "graduation"),
      area: areas[0] || displayArea(rawAreaIA) || displayArea(rawArea) || "Área não informada",
      areas,
      tematica: pick(record, "tematica_ia", "TEMÁTICA IA") || "Temática não informada",
      tema: pick(record, "tema_ia", "TEMA IA"),
      cidade: pick(record, "cidade", "city") || "Cidade não informada",
      instituicao: displayInstitutionName(institution) || "Instituição não informada",
      sigla: sigla || displayInstitutionName(institution) || "Instituição",
      resumo: pick(record, "biografia", "abstract", "abstract_ai") || "Informação biográfica não disponível na base.",
      abstractAI: pick(record, "abstract_ai"),
      artigos: toNumber(pick(record, "artigos", "articles")),
      livros: toNumber(pick(record, "livros", "book")),
      capitulos: toNumber(pick(record, "capitulos", "book_chapters")),
      patentes: toNumber(pick(record, "patentes", "patent")),
      softwares: toNumber(pick(record, "softwares", "software")),
      marcas: toNumber(pick(record, "marcas", "brand")),
      indiceH: toNumber(pick(record, "indice_h", "h_index")),
      citacoes: toNumber(pick(record, "citacoes", "cited_by_count")),
      indiceI10: toNumber(pick(record, "indice_i10", "i10_index")),
      trabalhos: toNumber(pick(record, "trabalhos", "works_count")),
      openalex: pick(record, "openalex"),
      classificacao: pick(record, "classificacao", "classification"),
      imagem: normalizeImagePath(pick(record, "imagem", "image", "foto", "photo", "image_url", "url_image"))
    };
  }

  function dedupeResearcherList(items) {
    const unique = new Map();
    items.forEach((item) => {
      if (!item) return;
      const key = String(item.id || item.nome).toLocaleLowerCase("pt-BR");
      if (!unique.has(key)) unique.set(key, item);
    });
    return [...unique.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  async function loadCSVResearchers() {
    const response = await fetch(CSV_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Falha ao carregar CSV (${response.status})`);
    const records = parseCSV(await response.text());
    const normalized = dedupeResearcherList(records.map((record) => normalizeResearcher(record, "csv")));
    if (!normalized.length) throw new Error("CSV sem pesquisadoras válidas");
    return normalized;
  }

  async function loadJSONResearchers() {
    const response = await fetch(JSON_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Falha ao carregar JSON (${response.status})`);
    const payload = await response.json();
    const records = Array.isArray(payload) ? payload : payload.data || [];
    const normalized = dedupeResearcherList(records.map((record) => normalizeResearcher(record, "json")));
    if (!normalized.length) throw new Error("JSON sem pesquisadoras válidas");
    return normalized;
  }

  async function loadResearchers() {
    const errors = [];

    // JSON completo (homens e mulheres) é a fonte principal; CSV fica como reserva.
    try {
      const jsonResearchers = await loadJSONResearchers();
      dataSourceLabel = "Base carregada do JSON do Observatório";
      return jsonResearchers;
    } catch (error) {
      errors.push(error.message);
    }

    try {
      const csvResearchers = await loadCSVResearchers();
      dataSourceLabel = "Base carregada do CSV do Observatório";
      return csvResearchers;
    } catch (error) {
      errors.push(error.message);
    }

    if (Array.isArray(window.PESQUISADORAS) && window.PESQUISADORAS.length) {
      dataSourceLabel = "Base demonstrativa local";
      return dedupeResearcherList(window.PESQUISADORAS.map((record) => normalizeResearcher(record, "json")));
    }

    throw new Error(errors.join(" | ") || "Nenhuma base de pesquisadoras disponível");
  }

  function initials(name = "") {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toLocaleUpperCase("pt-BR");
  }

  function unique(key) {
    return [...new Set(researchers.map((item) => item[key]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function uniqueAreas() {
    return [...new Set(researchers.flatMap((item) => item.areas?.length ? item.areas : [item.area]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function navigate(path) {
    window.location.href = path;
  }

  function openProfile(id) {
    navigate(`perfil.html?id=${encodeURIComponent(id)}`);
  }

  function goHome() {
    navigate("index.html");
  }

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else goHome();
  }

  function iconSVG(name) {
    const paths = {
      person: '<circle cx="16" cy="10" r="5"/><path d="M7 28c1-7 4-10 9-10s8 3 9 10"/>',
      flask: '<path d="M12 3h8M14 3v7L7 24a4 4 0 0 0 3.5 6h11a4 4 0 0 0 3.5-6l-7-14V3"/><path d="M10 23h12"/>',
      degree: '<path d="m3 11 13-7 13 7-13 7-13-7Z"/><path d="M8 14v7c2 3 14 3 16 0v-7"/>',
      document: '<path d="M8 3h12l5 5v21H8V3Z"/><path d="M20 3v6h6M12 15h9m-9 5h9m-9 5h6"/>',
      institution: '<path d="M4 12h24L16 4 4 12Zm3 3v10m6-10v10m6-10v10m6-10v10M4 28h24"/>',
      location: '<path d="M16 29S7 21 7 13a9 9 0 1 1 18 0c0 8-9 16-9 16Z"/><circle cx="16" cy="13" r="3"/>',
      quote: '<path d="M12 10H7v6h4v2c0 2-1 3-4 4M25 10h-5v6h4v2c0 2-1 3-4 4"/>',
      chart: '<path d="M5 27V17h6v10m5 0V6h6v21m5 0V12h-5"/><path d="M3 27h26"/>',
      book: '<path d="M7 5h10a4 4 0 0 1 4 4v18H10a3 3 0 0 0-3 3V5Z"/><path d="M21 5h3a2 2 0 0 1 2 2v20h-5"/>',
      patent: '<path d="M9 4h14v24H9V4Z"/><path d="M13 9h6m-6 5h6m-6 5h4"/><path d="m19 22 2 2 4-5"/>',
      code: '<path d="m11 10-5 6 5 6M21 10l5 6-5 6M18 7l-4 18"/>',
      heart: '<path d="M16 28S5 21.5 5 12.5A6.5 6.5 0 0 1 16 8a6.5 6.5 0 0 1 11 4.5C27 21.5 16 28 16 28Z"/>',
      bookmark: '<path d="M9 4h14v25l-7-4-7 4V4Z"/>',
      spark: '<path d="M16 2v6m0 16v6M2 16h6m16 0h6M6 6l4 4m12 12 4 4M26 6l-4 4M10 22l-4 4"/><circle cx="16" cy="16" r="5"/>',
      megaphone: '<path d="M4 18v-5h5l12-6v17L9 18H4Zm5 0l2 8h4l-2-7"/>'
    };
    return `<svg viewBox="0 0 32 32" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
  }

  function setSourceNotes() {
    document.querySelectorAll("[data-source-note]").forEach((note) => {
      note.textContent = dataSourceLabel;
    });
  }

  function setLoadingState() {
    if (page === "perfil") {
      const status = document.querySelector("#profile-status");
      if (status) {
        status.classList.remove("is-complete");
        status.textContent = "Carregando dados do perfil...";
      }
    }

    if (page === "cientistas") {
      const grid = document.querySelector("#researcher-grid");
      const count = document.querySelector("#result-count");
      if (count) count.textContent = "Carregando base...";
      if (grid) grid.innerHTML = '<div class="empty-state"><h3>Carregando cientistas</h3></div>';
    }
  }

  function renderDataError(error) {
    console.error("Não foi possível carregar a base de pesquisadoras:", error);
    const markup = `<div class="empty-state" role="alert">
      <h3>Não foi possível carregar os dados</h3>
      <p>Execute o projeto por um servidor HTTP local para permitir a leitura dos arquivos em data/.</p>
    </div>`;
    document.querySelector("#profile-content")?.insertAdjacentHTML("afterbegin", markup);
    const grid = document.querySelector("#researcher-grid") || document.querySelector("#theme-grid") || document.querySelector("#territory-grid");
    if (grid) grid.innerHTML = markup;
    const status = document.querySelector("#profile-status") || document.querySelector("#result-count");
    if (status) {
      status.classList.remove("is-complete");
      status.textContent = "Falha ao carregar a base de cientistas.";
    }
  }

  function avatarMarkup(researcher, className = "avatar") {
    const fallback = escapeHTML(initials(researcher.nome));
    const photo = lattesPhotoURL(researcher);
    if (!photo) return `<span class="${className}" aria-hidden="true"><span>${fallback}</span></span>`;

    return `<span class="${className} has-photo" aria-hidden="true">
      <img src="${escapeHTML(photo)}" alt="" loading="lazy" decoding="async" />
      <span>${fallback}</span>
    </span>`;
  }

  function bindAvatarFallbacks(container = document) {
    container.querySelectorAll(".avatar img, .researcher-icon__photo img").forEach((image) => {
      image.addEventListener("error", () => {
        image.remove();
        image.closest(".has-photo")?.classList.remove("has-photo");
      }, { once: true });
    });
  }

  function renderResearcherCard(researcher) {
    return `
      <button class="researcher-card" type="button" data-researcher-id="${escapeHTML(researcher.id)}" aria-label="Conheça a trajetória de ${escapeHTML(researcher.nome)}">
        ${avatarMarkup(researcher)}
        <span class="researcher-card__info">
          <span class="researcher-card__institution">${escapeHTML(displayOrFallback(researcher.sigla))}</span>
          <h3>${escapeHTML(researcher.nome)}</h3>
          <span class="researcher-card__meta">
            <span>${escapeHTML(researcher.area)}</span><span>${escapeHTML(researcher.cidade)}</span>
          </span>
          ${researcher.tematica && researcher.tematica !== "Temática não informada" ? `<p class="researcher-card__theme">${escapeHTML(researcher.tematica)}</p>` : ""}
          <span class="researcher-card__action">Conheça a trajetória →</span>
        </span>
      </button>`;
  }

  function bindResearcherCards(container = document) {
    container.querySelectorAll("[data-researcher-id]").forEach((card) => {
      card.addEventListener("click", () => openProfile(card.dataset.researcherId));
    });
    bindAvatarFallbacks(container);
  }

  function fillSelect(id, values) {
    const select = document.querySelector(`#${id}`);
    if (!select) return;
    select.querySelectorAll("option:not(:first-child)").forEach((option) => option.remove());
    values.forEach((value) => {
      select.insertAdjacentHTML("beforeend", `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`);
    });
  }

  function matchesSelectedFilter(item, key, value) {
    if (!value) return true;
    if (key === "area") return (item.areas?.length ? item.areas : [item.area]).includes(value);
    return item[key] === value;
  }

  function institutionGroups() {
    const groups = researchers.reduce((map, item) => {
      const label = displayOrFallback(item.instituicao);
      const group = map.get(label) || { count: 0, sigla: item.sigla, label };
      group.count += 1;
      if (!group.sigla && item.sigla) group.sigla = item.sigla;
      map.set(label, group);
      return map;
    }, new Map());

    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }

  function institutionMark(group) {
    const sigla = displayOrFallback(group.sigla);
    if (sigla.length <= 10) return sigla;
    return initials(sigla || group.label);
  }

  function institutionLogoMarkup(group) {
    const sigla = displayOrFallback(group.sigla).toUpperCase();
    const logo = INSTITUTION_LOGOS[sigla];
    const mark = escapeHTML(institutionMark(group));
    if (!logo) {
      return `<span class="institution-tile__mark" aria-hidden="true"><span>${mark}</span></span>`;
    }

    return `<span class="institution-tile__mark has-logo" aria-hidden="true">
      <img src="${escapeHTML(logo)}" alt="" loading="lazy" decoding="async" />
      <span>${mark}</span>
    </span>`;
  }

  function renderCientistas() {
    const grid = document.querySelector("#researcher-grid");
    const count = document.querySelector("#result-count");
    const search = document.querySelector("#search");
    const listingTitle = document.querySelector("#listing-title");
    const institutionGrid = document.querySelector("#institution-grid");
    const institutionCount = document.querySelector("#institution-count");
    const pagination = document.querySelector("#researcher-pagination");
    // "EXTERNA" não aparece como cartão de instituição (os cientistas continuam em "Todas")
    const groups = institutionGroups().filter((group) => String(group.sigla || "").toUpperCase() !== "EXTERNA");
    let selectedInstitution = params.get("instituicao") || "";

    const updateListingURL = () => {
      const nextParams = new URLSearchParams();
      if (selectedInstitution) nextParams.set("instituicao", selectedInstitution);
      const query = nextParams.toString();
      window.history.replaceState({}, "", query ? `cientistas.html?${query}` : "cientistas.html");
    };

    // Lista contínua: mostra um lote e carrega o próximo quando o fim da lista aparece na tela.
    const BATCH_SIZE = 24;
    let filteredList = [];
    let shownCount = 0;

    const appendNextBatch = () => {
      if (shownCount >= filteredList.length) return;
      const holder = document.createElement("div");
      holder.innerHTML = filteredList.slice(shownCount, shownCount + BATCH_SIZE).map(renderResearcherCard).join("");
      bindResearcherCards(holder);
      grid.append(...holder.children);
      shownCount = Math.min(shownCount + BATCH_SIZE, filteredList.length);
      if (pagination) {
        pagination.innerHTML = shownCount < filteredList.length
          ? `<span class="infinite-loader">Carregando mais cientistas…</span>`
          : "";
      }
    };

    if (pagination && "IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) appendNextBatch();
      }, { rootMargin: "600px 0px" }).observe(pagination);
    }

    const renderInstitutions = () => {
      if (!institutionGrid) return;
      if (institutionCount) {
        institutionCount.textContent = `${groups.length} ${groups.length === 1 ? "instituição" : "instituições"}`;
      }
      const allButton = `<button class="institution-tile${selectedInstitution ? "" : " is-active"}" type="button" data-institution="">
        <span class="institution-tile__mark" aria-hidden="true">BA</span>
        <strong>Todas</strong>
        <span>${researchers.length} cientistas</span>
      </button>`;
      // Só logo e sigla; o nome completo fica no title (aparece ao passar o mouse) e no aria-label.
      institutionGrid.innerHTML = allButton + groups.map((group) => `<button class="institution-tile${group.label === selectedInstitution ? " is-active" : ""}" type="button" data-institution="${escapeHTML(group.label)}" title="${escapeHTML(group.label)}" aria-label="${escapeHTML(`${displayOrFallback(group.sigla)} — ${group.label}`)}">
        ${institutionLogoMarkup(group)}
        <strong>${escapeHTML(displayOrFallback(group.sigla))}</strong>
      </button>`).join("");
      institutionGrid.querySelectorAll(".institution-tile__mark img").forEach((image) => {
        image.addEventListener("error", () => {
          image.remove();
          image.closest(".has-logo")?.classList.remove("has-logo");
        }, { once: true });
      });
      institutionGrid.querySelectorAll("[data-institution]").forEach((button) => {
        button.addEventListener("click", () => {
          selectedInstitution = button.dataset.institution;
          updateListingURL();
          applyFilters();
        });
      });
    };

    const applyFilters = (shouldScroll = false) => {
      const term = search.value.trim().toLocaleLowerCase("pt-BR");
      const selectedGroup = groups.find((group) => group.label === selectedInstitution);
      listingTitle.textContent = selectedGroup
        ? `Cientistas da ${displayOrFallback(selectedGroup.sigla)}`
        : "Encontre cientistas";

      const filtered = researchers.filter((item) => {
        const searchable = [item.nome, item.instituicao, item.sigla, item.area, item.tematica, item.cidade, item.tema]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("pt-BR");
        const institutionMatch = !selectedInstitution || item.instituicao === selectedInstitution;
        return searchable.includes(term) && institutionMatch;
      });

      updateListingURL();
      count.textContent = filtered.length
        ? `${filtered.length} ${filtered.length === 1 ? "cientista encontrado" : "cientistas encontrados"}`
        : "Nenhum resultado encontrado";
      filteredList = filtered;
      shownCount = 0;
      grid.innerHTML = filtered.length
        ? ""
        : '<div class="empty-state"><h3>Nenhum resultado encontrado</h3><p>Tente ajustar ou limpar os filtros.</p></div>';
      if (pagination) pagination.innerHTML = "";
      appendNextBatch();
      // Sem IntersectionObserver (navegador antigo): mostra tudo de uma vez
      if (!("IntersectionObserver" in window)) while (shownCount < filteredList.length) appendNextBatch();
      renderInstitutions();
      if (shouldScroll) {
        document.querySelector("#results-title")?.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
      }
    };

    search.addEventListener("input", () => {
      applyFilters();
    });
    document.querySelector("#clear-filters").addEventListener("click", () => {
      search.value = "";
      selectedInstitution = "";
      window.history.replaceState({}, "", "cientistas.html");
      applyFilters();
    });
    applyFilters();
  }

  const themeDescriptions = {
    "Biodiversidade, ecologia e conservação": "Vida, ecossistemas e conservação dos territórios.",
    "Saúde coletiva e epidemiologia": "Saúde, população e qualidade de vida.",
    "Computação e inteligência artificial": "Dados, sistemas inteligentes e novas tecnologias.",
    "Educação, ensino e formação docente": "Aprendizagem, práticas educativas e formação.",
    "Energia e tecnologias sustentáveis": "Inovação para uma transição mais sustentável.",
    "Produção animal e pastagens": "Conhecimento aplicado aos sistemas produtivos.",
    "Biotecnologia": "Processos biológicos transformados em soluções.",
    "Comunicação, mídia e cultura digital": "Informação, sociedade e ambientes digitais."
  };

  function renderResearcherIcon(researcher) {
    return `<button class="researcher-icon" type="button" data-researcher-id="${escapeHTML(researcher.id)}" aria-label="Abrir perfil de ${escapeHTML(researcher.nome)}">
      ${avatarMarkup(researcher, "researcher-icon__photo")}
      <strong>${escapeHTML(researcher.nome)}</strong>
      <span>${escapeHTML(displayOrFallback(researcher.sigla))}</span>
    </button>`;
  }

  function renderThemeCard(theme, count, isActive = false) {
    return `<button class="explore-card${isActive ? " is-active" : ""}" type="button" data-theme="${escapeHTML(theme)}" aria-pressed="${isActive ? "true" : "false"}">
      <h3>${escapeHTML(theme)}</h3>
      <p>${escapeHTML(themeDescriptions[theme] || "Uma rede de pesquisas e conexões científicas.")}</p>
      <span class="explore-card__footer"><span>${count} ${count === 1 ? "cientista" : "cientistas"}</span></span>
    </button>`;
  }

  function renderTematicas() {
    const chipRow = document.querySelector("#area-chips");
    const grid = document.querySelector("#theme-grid");
    const selection = document.querySelector("#theme-selection");
    const selectionTitle = document.querySelector("#theme-selection-title");
    const selectionCount = document.querySelector("#theme-result-count");
    const selectionGrid = document.querySelector("#theme-researchers");
    const areas = ["Todas as áreas", ...uniqueAreas()];
    let activeArea = params.get("area") || "Todas as áreas";
    if (!areas.includes(activeArea)) activeArea = "Todas as áreas";
    let activeTheme = (params.get("tematica") || "").split("|").filter(Boolean)[0] || "";

    const currentAreaResearchers = () => activeArea === "Todas as áreas"
      ? researchers
      : researchers.filter((item) => (item.areas?.length ? item.areas : [item.area]).includes(activeArea));

    const updateThemeURL = () => {
      const nextParams = new URLSearchParams();
      if (activeArea !== "Todas as áreas") nextParams.set("area", activeArea);
      if (activeTheme) nextParams.set("tematica", activeTheme);
      const query = nextParams.toString();
      window.history.replaceState({}, "", query ? `tematicas.html?${query}` : "tematicas.html");
    };

    chipRow.innerHTML = areas.map((area) => `<button class="chip${area === activeArea ? " is-active" : ""}" type="button" data-area="${escapeHTML(area)}">${escapeHTML(area)}</button>`).join("");

    const renderSelectedTheme = (shouldScroll = false) => {
      if (!selection || !selectionGrid) return;
      if (!activeTheme && activeArea === "Todas as áreas") {
        selection.hidden = true;
        selectionGrid.innerHTML = "";
        return;
      }

      const selectedResearchers = currentAreaResearchers()
        .filter((item) => !activeTheme || item.tematica === activeTheme)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      selection.hidden = false;
      if (selectionTitle) {
        selectionTitle.textContent = activeTheme || activeArea;
      }
      if (selectionCount) {
        selectionCount.textContent = `${selectedResearchers.length} ${selectedResearchers.length === 1 ? "cientista" : "cientistas"}`;
      }
      selectionGrid.innerHTML = selectedResearchers.length
        ? selectedResearchers.map(renderResearcherIcon).join("")
        : '<div class="empty-state"><h3>Nenhum resultado nesta seleção</h3></div>';
      bindResearcherCards(selectionGrid);
      if (shouldScroll) selection.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
    };

    const draw = (shouldScroll = false) => {
      const subset = currentAreaResearchers();
      const totals = subset.reduce((map, item) => map.set(item.tematica, (map.get(item.tematica) || 0) + 1), new Map());
      if (activeTheme && !totals.has(activeTheme)) activeTheme = "";
      grid.innerHTML = [...totals]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
        .map(([theme, total]) => renderThemeCard(theme, total, theme === activeTheme))
        .join("") || '<div class="empty-state"><h3>Nenhuma temática nesta área</h3></div>';
      grid.querySelectorAll("[data-theme]").forEach((card) => {
        card.addEventListener("click", () => {
          const theme = card.dataset.theme;
          activeTheme = activeTheme === theme ? "" : theme;
          updateThemeURL();
          draw(true);
        });
      });
      updateThemeURL();
      renderSelectedTheme(shouldScroll);
    };

    chipRow.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-area]");
      if (!chip) return;
      activeArea = chip.dataset.area;
      chipRow.querySelectorAll(".chip").forEach((item) => item.classList.toggle("is-active", item === chip));
      updateThemeURL();
      draw(true);
    });
    draw();
  }

  function renderTerritorio() {
    const grid = document.querySelector("#territory-grid");
    const buttons = document.querySelectorAll("[data-mode]");
    const draw = (mode) => {
      const key = mode === "instituicao" ? "instituicao" : "cidade";
      const groups = researchers.reduce((map, item) => {
        const label = item[key];
        const group = map.get(label) || { count: 0, cities: new Set(), sigla: item.sigla };
        group.count += 1;
        group.cities.add(item.cidade);
        map.set(label, group);
        return map;
      }, new Map());

      grid.innerHTML = [...groups].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0], "pt-BR")).map(([label, info]) => `<button class="explore-card" type="button" data-filter-key="${key}" data-filter-value="${escapeHTML(label)}">
        <span class="explore-card__icon" aria-hidden="true">${mode === "instituicao" ? escapeHTML(initials(info.sigla || label)) : "⌖"}</span>
        <h3>${escapeHTML(label)}</h3>
        <p>${mode === "instituicao" ? escapeHTML([...info.cities].join(" • ")) : "Bahia"}</p>
        <span class="explore-card__footer"><span>${info.count} ${info.count === 1 ? "cientista" : "cientistas"}</span><span>Conhecer →</span></span>
      </button>`).join("");
      grid.querySelectorAll("[data-filter-key]").forEach((card) => {
        card.addEventListener("click", () => navigate(`cientistas.html?${card.dataset.filterKey}=${encodeURIComponent(card.dataset.filterValue)}`));
      });
    };
    buttons.forEach((button) => button.addEventListener("click", () => {
      buttons.forEach((item) => item.classList.toggle("is-active", item === button));
      draw(button.dataset.mode);
    }));
    draw("instituicao");
  }

  // Sorteio de "baralho": embaralha todos os pesquisadores e mostra um por vez,
  // sem repetir ninguém até a volta completa. O baralho fica salvo no navegador,
  // então recarregar a página continua de onde parou.
  const DECK_KEY = "btxBaralhoPesquisadores";

  function shuffledIds() {
    const ids = researchers.map((item) => String(item.id));
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  }

  function readDeck() {
    try {
      const deck = JSON.parse(localStorage.getItem(DECK_KEY) || "null");
      // baralho inválido ou de outra base de dados: começa um novo
      if (!deck || !Array.isArray(deck.ids) || deck.ids.length !== researchers.length) return null;
      return deck;
    } catch {
      return null;
    }
  }

  function saveDeck(deck) {
    try { localStorage.setItem(DECK_KEY, JSON.stringify(deck)); } catch { /* sem armazenamento: vale só nesta visita */ }
  }

  let memoryDeck = null;

  function chooseRandomResearcher(excludedId = null) {
    if (!researchers.length) return null;
    const byId = new Map(researchers.map((item) => [String(item.id), item]));
    let deck = readDeck() || memoryDeck || { ids: shuffledIds(), pos: 0 };

    for (let tries = 0; tries < researchers.length + 1; tries += 1) {
      if (deck.pos >= deck.ids.length) deck = { ids: shuffledIds(), pos: 0 }; // fim da volta: novo baralho
      const id = deck.ids[deck.pos];
      deck.pos += 1;
      const selected = byId.get(id);
      if (selected && String(selected.id) !== String(excludedId)) {
        memoryDeck = deck;
        saveDeck(deck);
        sessionStorage.setItem(LAST_DISCOVERY_KEY, selected.id);
        return selected;
      }
    }
    return researchers[0];
  }

  function shortText(value, maxLength = 520) {
    const text = displayOrFallback(value);
    if (text.length <= maxLength) return text;
    const sliced = text.slice(0, maxLength);
    const cutAt = Math.max(sliced.lastIndexOf("."), sliced.lastIndexOf(";"), sliced.lastIndexOf(","));
    return `${sliced.slice(0, cutAt > 180 ? cutAt + 1 : maxLength).trim()}...`;
  }

  function compactText(value, maxLength = 90) {
    const text = displayOrFallback(value).replace(/\s+/g, " ");
    if (text.length <= maxLength) return text;
    const sliced = text.slice(0, maxLength + 1);
    const cutAt = sliced.lastIndexOf(" ");
    return `${sliced.slice(0, cutAt > 24 ? cutAt : maxLength).trim()}...`;
  }

  function buildHighlightPhrase(researcher) {
    const institution = researcher.sigla && researcher.sigla !== "Instituição"
      ? researcher.sigla
      : compactText(researcher.instituicao, 34);
    const place = firstText(institution, researcher.cidade, "Bahia");

    if (researcher.tematica && researcher.tematica !== "Temática não informada") {
      return `Pesquisa em ${compactText(researcher.tematica, 58)} com atuação em ${place}.`;
    }

    if (researcher.tema) {
      return `Pesquisa ${compactText(researcher.tema, 58)} em ${place}.`;
    }

    return `Atua em ${compactText(researcher.area, 42)} em ${place}.`;
  }

  function buildProfileSummary(researcher) {
    const institution = researcher.sigla && researcher.sigla !== "Instituição"
      ? researcher.sigla
      : compactText(researcher.instituicao, 44);
    const location = researcher.cidade && researcher.cidade !== "Cidade não informada" ? `, em ${researcher.cidade}` : "";
    const focus = (researcher.tematica !== "Temática não informada" ? researcher.tematica : null)
      || researcher.tema
      || researcher.area;

    return `${researcher.sexo === "F" ? "Pesquisadora vinculada" : "Pesquisador vinculado"} à ${institution}${location}, com atuação em ${compactText(focus, 64)}.`;
  }

  function lattesPhotoURL(researcher) {
    if (researcher.imagem) return researcher.imagem;
    if (!researcher.lattes10Id) return null;
    return `https://servicosweb.cnpq.br/wspessoa/servletrecuperafoto?tipo=1&id=${encodeURIComponent(researcher.lattes10Id)}`;
  }

  function textFitClass(value, mediumAt = 40, longAt = 90) {
    const text = displayOrFallback(value);
    const length = text.length;
    const longestWord = text.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0);
    if (length >= longAt || longestWord >= 18) return " is-long";
    if (length >= mediumAt || longestWord >= 13) return " is-medium";
    return "";
  }

  function pauloTextField(name, value, label, options = {}) {
    const tag = options.tag || "p";
    const extraClass = options.className ? ` ${options.className}` : "";
    const displayValue = options.allowEmpty && !validText(value)
      ? ""
      : displayPublicText(value);
    const fitClass = options.fit === false ? "" : textFitClass(value, options.mediumAt, options.longAt);
    const classes = `paulo-template__field paulo-template__${name}${fitClass}${extraClass}`;
    return `<${tag} class="${classes}" aria-label="${escapeHTML(label)}">${escapeHTML(displayValue)}</${tag}>`;
  }

  function pauloInfoCard(name, value, label, icon, options = {}) {
    const displayValue = displayPublicText(value);
    const fitClass = textFitClass(value, options.mediumAt, options.longAt);
    return `<div class="paulo-template__info-card paulo-template__${name}${fitClass}" aria-label="${escapeHTML(label)}">
      <span class="paulo-template__info-icon" aria-hidden="true">${iconSVG(icon)}</span>
      <span class="paulo-template__info-copy">
        <span class="paulo-template__info-label">${escapeHTML(label)}</span>
        <strong>${escapeHTML(displayValue)}</strong>
      </span>
    </div>`;
  }

  function metricNumber(researcher, key) {
    if (key === "publications") return researcher.artigos ?? researcher.trabalhos;
    if (key === "citations") return researcher.citacoes;
    if (key === "hindex") return researcher.indiceH;
    if (key === "books") return researcher.livros;
    if (key === "patents") return researcher.patentes;
    if (key === "programs") return researcher.softwares;
    return null;
  }

  function buildMetricCandidate(researcher, metric) {
    const value = metricNumber(researcher, metric.key);
    if (!Number.isFinite(value) || value < metric.threshold) return null;
    return { ...metric, value: formatNumber(value) };
  }

  function buildShowcaseMetrics(researcher) {
    const fallback = FALLBACK_METRICS.map((metric) => buildMetricCandidate(researcher, metric)).filter(Boolean);
    return PRIMARY_METRICS.map((metric) => buildMetricCandidate(researcher, metric) || fallback.shift() || null);
  }

  function pauloMetricCard(slot, metric) {
    const emptyClass = metric ? "" : " is-empty";
    return `<div class="paulo-template__metric-card paulo-template__metric-card--${slot}${emptyClass}" aria-label="${escapeHTML(metric?.label || "Indicador")}">
      ${metric ? `<span class="paulo-template__metric-head">${iconSVG(metric.icon)}<span>${escapeHTML(metric.label)}</span></span>
      <strong>${escapeHTML(metric.value)}</strong>` : ""}
    </div>`;
  }

  function readLoveCounts() {
    try {
      return JSON.parse(localStorage.getItem(LOVE_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function loveCountFor(id) {
    const counts = readLoveCounts();
    return Number(counts[id] || 0) > 0 ? 1 : 0;
  }

  function addLoveFor(id) {
    const counts = readLoveCounts();
    if (Number(counts[id] || 0) > 0) return null;
    counts[id] = 1;
    try {
      localStorage.setItem(LOVE_STORAGE_KEY, JSON.stringify(counts));
    } catch {
      // A interação visual continua funcionando mesmo se o navegador bloquear armazenamento.
    }
    return counts[id];
  }

  function loveButtonMarkup(researcher) {
    const count = loveCountFor(researcher.id);
    return `<button class="paulo-template__love-button${count ? " is-loved" : ""}" type="button" data-love aria-label="Dar Amei para ${escapeHTML(researcher.nome)}"${count ? " disabled" : ""}>
      ${iconSVG("heart")}
      <span>Amei</span>
      <strong data-love-count>${count ? escapeHTML(formatNumber(count)) : ""}</strong>
    </button>`;
  }

  // Troca automática: ligada por padrão no computador/telão; sempre desligada no celular.
  function readAutoRotationPreference() {
    if (document.documentElement.classList.contains("is-handheld")) return false;
    try {
      const saved = localStorage.getItem(AUTO_ROTATION_STORAGE_KEY);
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  }

  function clearAutoRotationTimer() {
    if (autoRotationTimer !== null) {
      window.clearTimeout(autoRotationTimer);
      autoRotationTimer = null;
    }
  }

  function scheduleAutoRotation() {
    clearAutoRotationTimer();
    if (!autoRotationEnabled || page !== "perfil" || researchers.length < 2) return;

    autoRotationTimer = window.setTimeout(async () => {
      autoRotationTimer = null;
      // Telão: se alguém pediu um perfil pelo celular, ele entra antes do sorteio
      const requestedId = IS_TELAO ? await nextTelaoRequest() : null;
      const requested = requestedId && researchers.find((item) => String(item.id) === requestedId);
      if (requested) {
        showResearcher(requested, true);
        return;
      }
      discoverResearcher(currentProfileId, true);
    }, AUTO_ROTATION_DELAY);
  }

  // ===== Telão oficial =====
  // Só o computador aberto com ?telao=1 pega pedidos da fila (fica salvo; ?telao=0 desliga).
  // Assim várias abas/computadores com troca automática não disputam os pedidos.
  const IS_TELAO = (() => {
    const flag = new URLSearchParams(window.location.search).get("telao");
    try {
      if (flag === "1") localStorage.setItem("btxTelaoOficial", "1");
      if (flag === "0") localStorage.removeItem("btxTelaoOficial");
      return localStorage.getItem("btxTelaoOficial") === "1";
    } catch {
      return flag === "1";
    }
  })();

  // ===== Fila do telão (Supabase) =====
  // Chave pública (publishable): só permite chamar as funções pedir_telao/proximo_telao.
  const TELAO_API = "https://jaboxhqlxxneetippzfk.supabase.co/rest/v1/rpc";
  const TELAO_KEY = "sb_publishable_PgECeJDoWsoPMUOdmmBg4w_znueBFdm";

  async function telaoRpc(name, body = {}) {
    const response = await fetch(`${TELAO_API}/${name}`, {
      method: "POST",
      headers: { apikey: TELAO_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Telão indisponível (${response.status})`);
    return response.json();
  }

  async function nextTelaoRequest() {
    try {
      return await telaoRpc("proximo_telao");
    } catch {
      return null; // sem internet ou serviço fora: segue o sorteio normal
    }
  }

  // Aviso rápido por cima da tela (some sozinho em 3 segundos)
  let toastTimer = null;
  function showToast(message, tone = "info") {
    let toast = document.querySelector("#app-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "app-toast";
      toast.className = "app-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3000);
  }

  async function requestTelao(researcher, button) {
    if (button.disabled) return;
    button.disabled = true; // evita toque duplo enquanto envia; o texto do botão não muda
    try {
      const result = await telaoRpc("pedir_telao", { p_researcher_id: String(researcher.id) });
      const messages = {
        ok: ["Enviado! Aparece no telão da BTX em instantes.", "success"],
        ja_na_fila: ["Este perfil já está na fila do telão. Aguarde!", "info"],
        aguarde: ["Este perfil já apareceu no telão. Tente novamente daqui alguns minutos!", "warning"],
        fila_cheia: ["A fila do telão está cheia. Tente novamente daqui alguns minutos!", "warning"]
      };
      const [message, tone] = messages[result] || ["Não foi possível enviar. Tente de novo.", "warning"];
      showToast(message, tone);
    } catch {
      showToast("Sem conexão. Tente de novo.", "warning");
    } finally {
      button.disabled = false;
    }
  }

  function showResearcher(selected, isAutomatic = false) {
    clearAutoRotationTimer();
    const overlay = document.querySelector("#randomizing");
    overlay?.classList.add("is-visible");
    overlay?.setAttribute("aria-hidden", "false");
    window.setTimeout(() => {
      overlay?.classList.remove("is-visible");
      overlay?.setAttribute("aria-hidden", "true");
      renderProfile(selected, true);
      if (!isAutomatic) document.querySelector("#profile-title")?.focus?.({ preventScroll: true });
    }, reducedMotion ? 80 : 520);
  }

  function setAutoRotation(enabled, announce = true) {
    autoRotationEnabled = Boolean(enabled);
    try {
      localStorage.setItem(AUTO_ROTATION_STORAGE_KEY, String(autoRotationEnabled));
    } catch {
      // A preferência segue válida durante esta visita se o armazenamento estiver bloqueado.
    }

    document.querySelectorAll("[data-auto-rotate]").forEach((input) => {
      input.checked = autoRotationEnabled;
    });

    scheduleAutoRotation();

    if (announce) {
      const status = document.querySelector("#profile-status");
      if (status) {
        status.textContent = autoRotationEnabled
          ? "Troca automática ativada. Um novo perfil será exibido a cada 30 segundos."
          : "Troca automática desativada.";
      }
    }
  }

  function autoRotationControlMarkup() {
    return `<label class="auto-rotation-control" title="Troca automática: novo perfil a cada 30 segundos">
      <input type="checkbox" data-auto-rotate${autoRotationEnabled ? " checked" : ""} />
      <span class="auto-rotation-control__switch" aria-hidden="true"><span></span></span>
      <span class="auto-rotation-control__copy">
        <strong>Troca automática</strong>
        <small>Novo perfil a cada 30 segundos</small>
      </span>
    </label>`;
  }

  function renderProfile(targetResearcher = null, updateHistory = false) {
    const root = document.querySelector("#profile-content");
    const status = document.querySelector("#profile-status");
    const selected = targetResearcher
      || (params.get("descubra") ? chooseRandomResearcher() : researchers.find((item) => String(item.id) === params.get("id")))
      || chooseRandomResearcher();

    if (!selected) {
      root.innerHTML = '<div class="empty-state"><h2>Perfil não encontrado</h2></div>';
      if (status) status.textContent = "Perfil não encontrado.";
      return;
    }

    currentProfileId = selected.id;
    document.title = `${selected.nome} • Ciência na Bahia`;
    if (status) {
      status.textContent = `${selected.nome} carregada.`;
      status.classList.add("is-complete");
    }
    if (updateHistory || params.get("descubra") || !params.get("id")) {
      window.history.replaceState({}, "", `perfil.html?id=${encodeURIComponent(selected.id)}`);
    }

    const abstract = selected.abstractAI || selected.resumo;
    const highlight = buildHighlightPhrase(selected);
    const photo = lattesPhotoURL(selected);
    const institution = `${selected.instituicao}${selected.sigla && selected.sigla !== selected.instituicao ? ` • ${selected.sigla}` : ""}`;
    const profileMeta = [selected.sigla, selected.cidade].filter(Boolean).join(" • ");
    const metrics = buildShowcaseMetrics(selected);
    const visibleMetrics = metrics.filter(Boolean);
    const themeAction = selected.tematica && selected.tematica !== "Temática não informada"
      ? `<button class="touch-button" type="button" data-link-theme>${iconSVG("flask")} <span>Mesma temática</span></button>`
      : "";
    const photoMarkup = photo
      ? `<span class="paulo-template__photo-fallback" aria-hidden="true">${escapeHTML(initials(selected.nome))}</span><img src="${escapeHTML(photo)}" alt="Foto de ${escapeHTML(selected.nome)}" loading="eager" decoding="async" />`
      : `<span class="paulo-template__photo-fallback" aria-hidden="true">${escapeHTML(initials(selected.nome))}</span><span class="sr-only">Foto não disponível.</span>`;

    root.innerHTML = `<article class="paulo-profile" aria-labelledby="profile-title">
      <div class="mobile-actions">
        ${loveButtonMarkup(selected)}
        <button class="telao-button" type="button" data-telao>${iconSVG("spark")} <span>Mostrar no Telão da BTX</span></button>
      </div>
      <section class="paulo-template" aria-label="Ficha Descubra um talento da ciência">
        <img class="paulo-template__base" src="${isPhoneScreen() ? PAULO_TEMPLATE_IMAGE_PHONE : PAULO_TEMPLATE_IMAGE}" alt="" aria-hidden="true" decoding="async" />
        <div class="paulo-template__photo" data-photo>${photoMarkup}</div>
        <div class="paulo-template__name${textFitClass(selected.nome, 22, 32)}" id="profile-title" tabindex="-1">
          <strong>${escapeHTML(selected.nome)}</strong>
          ${profileMeta ? `<span>${escapeHTML(profileMeta)}</span>` : ""}
        </div>
        ${loveButtonMarkup(selected)}
        ${pauloInfoCard("area", selected.area, "Área de atuação", "flask", { mediumAt: 18, longAt: 25 })}
        ${pauloInfoCard("degree", selected.graduacao, "Grau de formação", "degree", { mediumAt: 20, longAt: 34 })}
        ${pauloTextField("bio", abstract, "Resumo", { tag: "div", fit: false })}
        ${pauloInfoCard("institution", institution, "Instituição", "institution", { mediumAt: 42, longAt: 78 })}
        ${pauloInfoCard("city", selected.cidade, "Cidade de atuação", "location", { mediumAt: 24, longAt: 42 })}
        <div class="paulo-template__metrics-mask paulo-template__metrics-mask--count${visibleMetrics.length}" aria-hidden="true"></div>
        ${visibleMetrics.map((metric, index) => pauloMetricCard(`count${visibleMetrics.length}-${index}`, metric)).join("")}
        ${pauloTextField("post", highlight, "Destaques", { mediumAt: 82, longAt: 112 })}
        <dl class="sr-only">
          <dt>Nome</dt><dd>${escapeHTML(selected.nome)}</dd>
          <dt>Área de atuação</dt><dd>${escapeHTML(displayOrFallback(selected.area))}</dd>
          <dt>Grau de formação</dt><dd>${escapeHTML(displayOrFallback(selected.graduacao))}</dd>
          <dt>Resumo</dt><dd>${escapeHTML(displayPublicText(abstract))}</dd>
          <dt>Instituição</dt><dd>${escapeHTML(displayPublicText(institution))}</dd>
          <dt>Cidade de atuação</dt><dd>${escapeHTML(displayOrFallback(selected.cidade))}</dd>
          ${visibleMetrics.length
            ? visibleMetrics.map((metric) => `<dt>${escapeHTML(metric.label)}</dt><dd>${escapeHTML(metric.value)}</dd>`).join("")
            : "<dt>Indicadores</dt><dd>Não exibido no totem</dd>"}
        </dl>
      </section>

      ${landscapeProfileMarkup(selected, { abstract, highlight, photo, institution, visibleMetrics })}

      <div class="paulo-profile__controls">
        <button class="touch-button touch-button--primary" type="button" data-discover>
          ${iconSVG("spark")} <span>Conheça outro talento</span>
        </button>
      </div>
    </article>`;

    root.querySelector("[data-discover]").addEventListener("click", () => discoverResearcher(currentProfileId));
    root.querySelector("[data-telao]")?.addEventListener("click", (event) => requestTelao(selected, event.currentTarget));
    root.querySelector("[data-link-theme]")?.addEventListener("click", () => navigate(`tematicas.html?tematica=${encodeURIComponent(selected.tematica)}`));
    // Há um botão "Amei" na ficha (retrato) e outro no layout de paisagem: os dois ficam sincronizados.
    const loveButtons = [...root.querySelectorAll("[data-love]")];
    // Contador de Amei guardado no Supabase (o mesmo total aparece em todos os aparelhos)
    const showLoveTotal = (total) => {
      if (!Number.isFinite(total)) return;
      loveButtons.forEach((button) => {
        const count = button.querySelector("[data-love-count]");
        if (count) count.textContent = total > 0 ? formatNumber(total) : "";
      });
    };
    telaoRpc("total_amei", { p_researcher_id: String(selected.id) })
      .then((total) => { if (currentProfileId === selected.id) showLoveTotal(Number(total)); })
      .catch(() => {});
    loveButtons.forEach((loveButton) => loveButton.addEventListener("click", async () => {
      // cada aparelho dá um Amei por pesquisador
      if (addLoveFor(selected.id) === null) {
        if (status) status.textContent = `${selected.nome} já recebeu seu Amei neste acesso.`;
        return;
      }
      loveButtons.forEach((button) => {
        button.classList.add("is-loved", "is-pulsing");
        button.disabled = true;
        window.setTimeout(() => button.classList.remove("is-pulsing"), 420);
      });
      if (status) status.textContent = `${selected.nome} recebeu um Amei.`;
      try {
        showLoveTotal(Number(await telaoRpc("dar_amei", { p_researcher_id: String(selected.id) })));
      } catch {
        // sem conexão: o Amei fica marcado neste aparelho, mas não soma no banco
      }
    }));
    // Foto do layout de paisagem: arquivo local em alta → foto do Lattes → iniciais
    root.querySelectorAll("[data-land-photo] img").forEach((image) => {
      image.addEventListener("error", () => {
        const fallback = image.dataset.fallback;
        if (fallback && !image.dataset.triedFallback) {
          image.dataset.triedFallback = "1";
          image.src = fallback;
          return;
        }
        image.closest("[data-land-photo]")?.classList.add("is-empty");
        image.remove();
      });
    });
    root.querySelectorAll(".paulo-template__photo img").forEach((image) => {
      image.addEventListener("error", () => {
        const photo = image.closest("[data-photo]");
        photo.classList.add("is-empty");
        image.remove();
      }, { once: true });
    });

    scheduleAutoRotation();
  }

  // Layout do perfil para tela deitada: informações à esquerda, foto à direita em toda a altura.
  // Fica oculto no modo retrato (lá aparece a ficha .paulo-template).
  function landscapeProfileMarkup(selected, { abstract, highlight, photo, institution, visibleMetrics }) {
    const fact = (icon, label, value) => `<div class="profile-land__fact">
        <span class="profile-land__fact-icon" aria-hidden="true">${iconSVG(icon)}</span>
        <span>${label ? `<small>${escapeHTML(label)}</small>` : ""}<strong>${escapeHTML(displayOrFallback(value))}</strong></span>
      </div>`;
    const metricCards = visibleMetrics.map((metric) => `<div class="profile-land__metric">
        <span>${iconSVG(metric.icon)} ${escapeHTML(metric.label)}</span>
        <strong>${escapeHTML(metric.value)}</strong>
      </div>`).join("");
    const localPhoto = `assets/carousel/${encodeURIComponent(selected.id)}.webp`;

    // Esquerda: nome, foto e quadros. Direita: biografia e produções.
    return `<section class="profile-land" aria-label="Perfil de ${escapeHTML(selected.nome)}">
      <div class="profile-land__side">
        <div class="profile-land__head">
          <h1 class="profile-land__name">${escapeHTML(selected.nome)}</h1>
          ${loveButtonMarkup(selected)}
        </div>
        <figure class="profile-land__photo" data-land-photo>
          <span class="profile-land__initials" aria-hidden="true">${escapeHTML(initials(selected.nome))}</span>
          <img src="${localPhoto}" data-fallback="${escapeHTML(photo || "")}" alt="Foto de ${escapeHTML(selected.nome)}" decoding="async" />
        </figure>
        <div class="profile-land__facts">
          ${fact("flask", "Área de atuação", selected.area)}
          ${fact("degree", "Grau de formação", selected.graduacao)}
          ${fact("institution", "", institution)}
          ${fact("location", "Cidade de atuação", selected.cidade)}
        </div>
      </div>
      <div class="profile-land__info">
        <h2 class="profile-land__titulo-bio">Biografia</h2>
        <div class="profile-land__bio">
          <p>${escapeHTML(displayPublicText(abstract))}</p>
        </div>
        ${metricCards ? `<div class="profile-land__metrics">${metricCards}</div>` : ""}
        ${highlight ? `<p class="profile-land__highlight"><strong>Destaque</strong> ${escapeHTML(displayPublicText(highlight))}</p>` : ""}
      </div>
    </section>`;
  }

  function discoverResearcher(currentId = null, isAutomatic = false) {
    clearAutoRotationTimer();
    const selected = chooseRandomResearcher(currentId);
    if (!selected) {
      scheduleAutoRotation();
      return;
    }
    const overlay = document.querySelector("#randomizing");
    overlay?.classList.add("is-visible");
    overlay?.setAttribute("aria-hidden", "false");

    window.setTimeout(() => {
      overlay?.classList.remove("is-visible");
      overlay?.setAttribute("aria-hidden", "true");
      renderProfile(selected, true);
      // telão: perfil sorteado conta na regra "só repete depois de 3 outros"
      if (isAutomatic && IS_TELAO) telaoRpc("registrar_exibicao", { p_researcher_id: String(selected.id) }).catch(() => {});
      if (!isAutomatic) document.querySelector("#profile-title")?.focus?.({ preventScroll: true });
    }, reducedMotion ? 80 : 520);
  }

  function initializeNavigation() {
    document.querySelectorAll("[data-home]").forEach((button) => button.addEventListener("click", goHome));
    document.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", goBack));
  }

  async function initializeDataPage(renderer) {
    setLoadingState();
    try {
      researchers = await loadResearchers();
      setSourceNotes();
      renderer();
    } catch (error) {
      renderDataError(error);
    }
  }

  initializeNavigation();

  if (page === "cientistas") initializeDataPage(renderCientistas);
  if (page === "tematicas") initializeDataPage(renderTematicas);
  if (page === "territorio") initializeDataPage(renderTerritorio);
  if (page === "perfil") {
    autoRotationEnabled = readAutoRotationPreference();
    initializeFinderDrawer();
    startTelaoQueueWatch();
    // Troca automática fica no rodapé fino (uma vez só, não é recriada a cada perfil)
    const footer = document.querySelector(".site-footer");
    if (footer && !footer.querySelector("[data-auto-rotate]")) {
      footer.querySelector("[data-screen-mode]")?.insertAdjacentHTML("afterend", autoRotationControlMarkup());
      footer.querySelector("[data-auto-rotate]")?.addEventListener("change", (event) => setAutoRotation(event.currentTarget.checked));
    }
    initializeDataPage(() => renderProfile());
  }

  // Telão: olha a fila a cada 4 segundos e mostra o pedido na hora (só com a troca automática ligada).
  function startTelaoQueueWatch() {
    let busy = false;
    window.setInterval(async () => {
      if (!IS_TELAO || busy || !autoRotationEnabled || !researchers.length) return;
      if (document.documentElement.classList.contains("is-handheld")) return;
      busy = true;
      try {
        const requestedId = await nextTelaoRequest();
        const requested = requestedId && researchers.find((item) => String(item.id) === requestedId);
        if (requested) showResearcher(requested, true); // reinicia os 30 segundos a partir do pedido
      } finally {
        busy = false;
      }
    }, 4000);
  }

  // Barra lateral "Encontre seu Pesquisador" (perfil).
  // Abre/fecha pela aba; com a troca automática ligada, alterna sozinha a cada 15 segundos.
  function initializeFinderDrawer() {
    const drawer = document.querySelector("#finder-drawer");
    const toggle = drawer?.querySelector("[data-finder-toggle]");
    if (!drawer || !toggle) return;
    const FINDER_CYCLE = 15_000;

    const setOpen = (open) => {
      drawer.classList.toggle("is-open", open);
      document.documentElement.classList.toggle("finder-open", open); // empurra o conteúdo
      toggle.setAttribute("aria-expanded", String(open));
    };

    toggle.addEventListener("click", () => setOpen(!drawer.classList.contains("is-open")));

    window.setInterval(() => {
      if (autoRotationEnabled) setOpen(!drawer.classList.contains("is-open"));
    }, FINDER_CYCLE);
  }
})();
