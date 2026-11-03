/*
 * Modo de tela: retrato ou paisagem.
 * - Celular/tablet: sempre automático (segue o giro do aparelho).
 * - Computador: botão na página inicial alterna Automático → Retrato → Paisagem.
 *   A escolha fica salva no navegador e vale para todas as páginas.
 * O resultado vai em <html data-layout="portrait|landscape"> e o CSS ajusta o layout.
 */
(() => {
  "use strict";

  const STORAGE_KEY = "btxScreenMode";
  const MODES = ["auto", "portrait", "landscape"];
  const LABELS = { auto: "Automático", portrait: "Retrato", landscape: "Paisagem" };
  const root = document.documentElement;
  const portraitQuery = window.matchMedia("(orientation: portrait)");
  // Aparelho de toque com tela pequena = celular/tablet → sempre automático
  const isHandheld = window.matchMedia("(pointer: coarse)").matches
    && Math.max(window.screen.width, window.screen.height) <= 1366
    || new URLSearchParams(window.location.search).get("celular") === "1"; // para testar o modo celular no computador

  // Atalho pelo endereço: index.html?tela=retrato | paisagem | auto (fica salvo)
  const URL_MODES = { auto: "auto", retrato: "portrait", paisagem: "landscape" };

  function readMode() {
    if (isHandheld) return "auto";
    const fromUrl = URL_MODES[new URLSearchParams(window.location.search).get("tela")];
    if (fromUrl) {
      saveMode(fromUrl);
      return fromUrl;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return MODES.includes(saved) ? saved : "auto";
    } catch {
      return "auto";
    }
  }

  function saveMode(mode) {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* sem armazenamento: vale só nesta página */ }
  }

  root.classList.toggle("is-handheld", isHandheld); // usado para mostrar o botão do telão só no celular
  let mode = readMode();

  function apply() {
    const layout = mode === "auto" ? (portraitQuery.matches ? "portrait" : "landscape") : mode;
    root.dataset.layout = layout;
    root.dataset.layoutMode = mode;
    updateButton();
  }

  const ICONS = {
    auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="3" width="8" height="14" rx="1.6"/><rect x="8" y="12" width="13.5" height="8" rx="1.6"/><path d="M15 4.5a5 5 0 0 1 4 4.2M19 8.7l1.2-1.6M19 8.7l-1.8-.9"/></svg>',
    portrait: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"/></svg>',
    landscape: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="7" width="19" height="10" rx="2"/></svg>'
  };

  function updateButton() {
    const button = document.querySelector("[data-screen-mode]");
    if (!button) return;
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    button.innerHTML = `${ICONS[mode]}<span><small>Tela</small><strong>${LABELS[mode]}</strong></span>`;
    button.setAttribute("aria-label", `Modo de tela: ${LABELS[mode]}. Toque para mudar para ${LABELS[next]}.`);
    button.title = `Mudar para ${LABELS[next]}`;
  }

  // Onde termina a barra do topo: o perfil em paisagem ocupa o resto da altura da tela
  function updateTopbarHeight() {
    const bar = document.querySelector(".top-row");
    if (bar) root.style.setProperty("--topbar-bottom", `${Math.round(bar.getBoundingClientRect().bottom)}px`);
  }

  portraitQuery.addEventListener("change", () => { if (mode === "auto") apply(); });
  window.addEventListener("resize", updateTopbarHeight);
  document.addEventListener("DOMContentLoaded", updateTopbarHeight);
  window.addEventListener("load", updateTopbarHeight);
  apply();

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.querySelector("[data-screen-mode]");
    if (!button) return;
    if (isHandheld) { button.remove(); return; }
    button.hidden = false;
    updateButton();
    button.addEventListener("click", () => {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      saveMode(mode);
      apply();
    });
  });
})();
