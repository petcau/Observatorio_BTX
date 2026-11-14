const fs = require("fs");
const path = require("path");

const csvPath = path.join(__dirname, "..", "data", "startups.csv");

// Somente enderecos associados com seguranca a startup: site institucional,
// dominio empresarial confirmado ou endereco publicado como pitch oficial.
const sites = new Map(Object.entries({
  "1": "https://escavador.com/",
  "2": "https://www.mtmtecnologia.com.br/",
  "3": "https://www.imtech.com.br/",
  "4": "https://gravae.io/",
  "5": "https://www.forpy.com.br/",
  "9": "https://www.branef.com.br/",
  "10": "https://www.prefirodelivery.com.br/",
  "14": "https://rs2build.com.br/",
  "16": "https://mobapps.com.br/",
  "17": "https://rstek.com.br/",
  "18": "https://aimotech.com.br/",
  "22": "https://uido.app/",
  "23": "https://arejamob.com/",
  "24": "https://www.makerlab3d.com.br/",
  "26": "https://dgtax.com.br/",
  "27": "https://ftp.softlineinfo.com.br/",
  "29": "https://www.boldsolution.com.br/",
  "30": "https://www.sdwforall.com/",
  "31": "https://soffia.tech/",
  "33": "https://qugem.com/",
  "35": "https://www.canteirocircular.com.br/",
  "36": "https://historicoacaademico.com/",
  "38": "https://www.levolt.com.br/",
  "40": "https://4amengineering.com.br/",
  "41": "https://collectioncenter.com.br/",
  "47": "https://www.ampliaidiomas.com.br/",
  "48": "https://www.c2cseller.com/",
  "51": "https://opusecosystem.com.br/",
  "53": "https://queroserinterprete.com.br/",
  "56": "https://vivaitour.com.br/",
  "57": "https://victorcayres.com.br/",
  "59": "https://eletroid.com.br/",
  "61": "https://etiquetai.com.br/",
  "62": "https://gestorcondo.com.br/",
  "71": "https://neurosight.tech/",
  "74": "https://raizbrasil.agr.br/",
  "75": "https://previtasaude.com.br/",
  "78": "https://eusouvetor.com.br/",
  "82": "https://www.agilitt.com.br/",
  "87": "https://prolytiq.com/pt",
  "88": "https://beta.cognitio.one/",
  "91": "https://mkthowl.com/",
  "95": "https://nucleobim.com/",
  "96": "https://orzon.app/",
  "97": "https://www.kaello.com.br/",
  "98": "https://dynatecnologia.com/",
  "102": "https://frotapilot.com.br/",
  "104": "https://eria.tec.br/",
  "107": "https://minhaescoladelinguas.com.br/",
  "114": "https://officeless.io/",
  "118": "https://mvvision.com.br/",
  "120": "http://www.oxeanhub.com/"
}));

// Enderecos provaveis encontrados por nome da startup, fundador, CNPJ ou
// perfil publico oficial. Permanecem sem validacao automatica no painel.
const sitesProvaveis = new Map(Object.entries({
  "6": "https://www.efirma.com.br/empresa/moradia-legal-geosmart-fiscal-govtech",
  "7": "https://br.linkedin.com/in/gl%C3%A1ucio-bessa-oliveira",
  "8": "https://linktr.ee/guidar",
  "11": "https://www.escavador.com/sobre/3342831/mozart-santos-estrela",
  "12": "https://cacausbiocosmeticos.lojavirtualnuvem.com.br/",
  "13": "https://greenchat.com.br/",
  "15": "https://juridicoonline.com.br/empresa/44836220000125-georaiz-fabricacao-de-adubos-e-fertilizantes-organo-minerais-servicos-agricolas-",
  "19": "https://www.instagram.com/puba/",
  "20": "https://br.linkedin.com/in/pedro-bitencourt-",
  "21": "https://cnpj.biz/69042509000101",
  "25": "https://summiteconomiazul.com.br/",
  "28": "https://capimpimenta.com/",
  "32": "https://br.linkedin.com/in/kevin-silva-297b18240",
  "34": "https://www.escavador.com/sobre/1780492350/antonio-daniel-gomes-da-costa-lyrio",
  "42": "https://flyservdrones.com.br/",
  "43": "https://advdinamico.com.br/socios/albertino-freitas-santana-neto-44e82ce6",
  "45": "https://play.google.com/store/apps/details?id=br.com.addeconsultoria",
  "49": "https://clubeconectafacil.com.br/home/",
  "50": "https://br.linkedin.com/in/sourafaeltrindade",
  "54": "https://www.claraidea.com.br/",
  "55": "https://tap-ia-startup.web.app/",
  "58": "https://ambi9.com.br/",
  "60": "https://www.escavador.com/sobre/841051301/ana-maria-lenz-cardoso",
  "63": "https://www.impactae.org/links",
  "65": "https://www.escavador.com/sobre/560463482/matheus-souza-ch-de-medeiros",
  "66": "https://advdinamico.com.br/socios/mauro-bastos-abram-0d2d7887",
  "67": "https://praticonfe.com.br/",
  "68": "https://www.participeai.com.br/",
  "69": "https://grupoavagro.com.br/",
  "70": "https://br.linkedin.com/in/alexandro-costa-12275a196",
  "72": "https://prontoafeto.com.br/",
  "73": "https://www.startsolucoes.ind.br/",
  "76": "https://casadosdados.com.br/solucao/cnpj/adalicio-jose-de-almeida-neto-12585825000102",
  "77": "https://linktr.ee/citirural",
  "79": "https://tunero.com.br/",
  "80": "https://conduzzir.com.br/",
  "81": "https://madeinrudado.com.br/",
  "83": "https://roomconnect.io/",
  "84": "https://cadastroempresa.com.br/fornecedor/meper-inova-simples-is-67586648000162",
  "85": "https://www.grupoinovale.com/",
  "86": "https://www.milieco.com.br/",
  "89": "https://www.escavador.com/sobre/4786044/neudenir-de-sena-silva",
  "90": "https://www.econodata.com.br/consulta-empresa/41121371000109-beatriz-carolina-sebastiao-leao",
  "92": "https://www.instagram.com/amoridico/",
  "93": "https://qlifetech.com/",
  "94": "https://nexusesg360.app/",
  "101": "https://empresas.serasaexperian.com.br/consulta-gratis/GERMFREE-LTDA-ME-60336941000122",
  "103": "https://toreva.com.br/consulta-cnpj/empresas/ba/lauro-de-freitas/6202300-desenvolvimento-e-licenciamento-de-programas-de-computador-customizaveis",
  "105": "https://www.escavador.com/sobre/5659258/nayara-alves-reis",
  "106": "https://br.linkedin.com/in/sara-regina-gansohr-050ba6341",
  "109": "https://upver.app/",
  "110": "https://apps.apple.com/br/app/vetlligencepet/id6822429733",
  "112": "https://endoafetos.com.br/",
  "113": "https://openseller.com.br/",
  "115": "https://marargila.com/",
  "116": "https://kontulari.com.br/"
}));

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ";") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function serializeCsv(rows) {
  const field = (value) => {
    const text = String(value ?? "");
    return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `${rows.map((row) => row.map(field).join(";")).join("\r\n")}\r\n`;
}

const cp1252Special = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f]
]);

function encodeCp1252(text) {
  const bytes = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code <= 0xff && !(code >= 0x80 && code <= 0x9f)) bytes.push(code);
    else if (cp1252Special.has(code)) bytes.push(cp1252Special.get(code));
    else throw new Error(`Caractere sem representacao em Windows-1252: U+${code.toString(16).toUpperCase()}`);
  }
  return Buffer.from(bytes);
}

const text = new TextDecoder("windows-1252").decode(fs.readFileSync(csvPath));
const rows = parseCsv(text);
if (rows.length < 2) throw new Error("startups.csv esta vazio");

const header = rows[0];
const cityIndex = header.indexOf("Cidade");
const rankIndex = header.indexOf("Rank");
if (cityIndex < 0 || rankIndex < 0) throw new Error("Colunas Cidade ou Rank nao encontradas");

let siteIndex = header.indexOf("Site");
if (siteIndex < 0) {
  siteIndex = cityIndex + 1;
  header.splice(siteIndex, 0, "Site");
  for (let i = 1; i < rows.length; i += 1) rows[i].splice(siteIndex, 0, "");
}

for (let i = 1; i < rows.length; i += 1) {
  const rank = rows[i][rankIndex];
  rows[i][siteIndex] = sites.get(rank) || sitesProvaveis.get(rank) || "";
}

fs.writeFileSync(csvPath, encodeCp1252(serializeCsv(rows)));
console.log(`${rows.length - 1} startups processadas; ${sites.size} sites confirmados e ${sitesProvaveis.size} provaveis preenchidos.`);
