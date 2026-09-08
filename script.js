function formatTime(num) {
  const hours = Math.floor(num) % 24;
  const minutes = Math.round((num % 1) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatHosts(hosts) {
  if (!hosts || !hosts.length) return "";
  const prefix = hosts.length === 1 ? "Prowadzi" : "Prowadzą";
  const names =
    hosts.length <= 1
      ? hosts[0]
      : hosts.slice(0, -1).join(", ") + " i " + hosts[hosts.length - 1];
  return `${prefix}: ${names}`;
}

const POLISH_TYPOGRAPHY_SELECTOR =
  "p, li, dd, dt, blockquote, figcaption, .badge-note, .program-detail, .program-intro, .faq-answer, .denmap-intro, .denmap-detail, .venuemap-intro, .venuemap-detail, .about-text, .ticket-card";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const POLISH_ORPHAN_WORDS = [
  "albo",
  "bez",
  "bym",
  "byś",
  "by",
  "ci",
  "co",
  "czy",
  "dla",
  "do",
  "gdy",
  "go",
  "i",
  "ja",
  "już",
  "ku",
  "lub",
  "ma",
  "mi",
  "mu",
  "na",
  "nad",
  "niż",
  "ni",
  "od",
  "oraz",
  "po",
  "pod",
  "przed",
  "się",
  "ta",
  "te",
  "to",
  "tu",
  "ty",
  "tym",
  "we",
  "wę",
  "w",
  "za",
  "ze",
  "że",
  "a",
  "o",
  "u",
  "z",
  "bo",
  "też",
  "więc",
].sort((a, b) => b.length - a.length);

const POLISH_ORPHAN_PATTERN = new RegExp(
  `(\\s)(${POLISH_ORPHAN_WORDS.map(escapeRegExp).join("|")})(\\s+)`,
  "gi",
);

function getTypographyTextNodes(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentElement?.tagName;
      if (tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

function fixPolishOrphansInText(text) {
  return text.replace(POLISH_ORPHAN_PATTERN, (_, before, word, after) => {
    return `${before}${word}\u00A0${after.replace(/^\s+/, "")}`;
  });
}

function fixPolishOrphansAcrossNodes(nodes) {
  const orphanEndPattern = new RegExp(
    `(\\s)(${POLISH_ORPHAN_WORDS.map(escapeRegExp).join("|")})\\s*$`,
    "i",
  );

  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i].nodeValue;
    const next = nodes[i + 1].nodeValue;
    if (!orphanEndPattern.test(current) || !/^\s+\S/.test(next)) continue;

    nodes[i + 1].nodeValue = next.replace(/^\s/, "\u00A0");
  }
}

function fixPolishOrphans(element) {
  const nodes = getTypographyTextNodes(element).filter((node) =>
    node.nodeValue.trim(),
  );
  if (!nodes.length) return;

  nodes.forEach((node) => {
    node.nodeValue = fixPolishOrphansInText(node.nodeValue);
  });
  fixPolishOrphansAcrossNodes(nodes);
}

function fixPolishWidow(element) {
  const nodes = getTypographyTextNodes(element).filter((node) =>
    node.nodeValue.trim(),
  );
  if (nodes.length === 0) return;

  const combined = nodes.map((node) => node.nodeValue).join("");
  const words = combined.trim().split(/\s+/);
  if (words.length < 2) return;

  const penultimate = words[words.length - 2];
  const ultimate = words[words.length - 1];
  const matches = [
    ...combined.matchAll(
      new RegExp(
        `${escapeRegExp(penultimate)}(\\s+)${escapeRegExp(ultimate)}(?!\\S)`,
        "g",
      ),
    ),
  ];
  if (!matches.length) return;

  const match = matches[matches.length - 1];
  const spaceStart = match.index + penultimate.length;
  const spaceEnd = spaceStart + match[1].length;

  let offset = 0;
  for (const node of nodes) {
    const len = node.nodeValue.length;
    const nodeEnd = offset + len;

    if (spaceStart >= offset && spaceStart < nodeEnd) {
      const localStart = spaceStart - offset;
      const localEnd = Math.min(spaceEnd - offset, len);
      node.nodeValue =
        node.nodeValue.slice(0, localStart) +
        "\u00A0" +
        node.nodeValue.slice(localEnd);
      return;
    }

    offset = nodeEnd;
  }
}

function applyPolishTypography(root = document.body) {
  root.querySelectorAll(POLISH_TYPOGRAPHY_SELECTOR).forEach((block) => {
    fixPolishOrphans(block);
    fixPolishWidow(block);
  });
}

// Przewijanie w bok przeciągnięciem myszy - dla rzędu sal w programie i planu
// terenu, które nie mieszczą się w ekranie. Palcem zostawiamy przewijanie
// natywne: ma bezwładność i reaguje lepiej niż cokolwiek napisalibyśmy tutaj.
function enableDragScroll(el) {
  // poniżej tylu pikseli gest jest jeszcze kliknięciem, nie przeciąganiem
  const THRESHOLD = 5;
  let pointerId = null;
  let startX = 0;
  let startScroll = 0;
  let dragged = false;

  el.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    // gdy nie ma czego przewijać, gest nie zaczyna się wcale - inaczej
    // niechlujne kliknięcie z drgnięciem myszy zostałoby połknięte
    if (el.scrollWidth <= el.clientWidth) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScroll = el.scrollLeft;
    dragged = false;
  });

  el.addEventListener("pointermove", (event) => {
    if (pointerId === null ? !dragged : event.pointerId !== pointerId) return;
    const shift = event.clientX - startX;
    if (!dragged) {
      if (Math.abs(shift) < THRESHOLD) return;
      dragged = true;
      el.classList.add("is-dragging");
      // dzięki przechwyceniu gest nie gubi się po wyjeściu poza kontener; bez
      // niego przewijanie nadal działa, więc błąd tu nie może przerwać gestu
      try {
        el.setPointerCapture(pointerId);
      } catch {
        pointerId = null;
      }
    }
    el.scrollLeft = startScroll - shift;
  });

  const endDrag = (event) => {
    if (pointerId !== null) {
      if (event.pointerId !== pointerId) return;
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    }
    pointerId = null;
    el.classList.remove("is-dragging");
  };
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);

  // kliknięcie kończące przeciąganie nie może rozwijać kafelka ani zaznaczać
  // strefy - łapiemy je w fazie przechwytywania, zanim dojdzie do celu
  el.addEventListener(
    "click",
    (event) => {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
    },
    true,
  );

  // odnośniki i obrazki mają własne przeciąganie, które przerywałoby gest
  el.addEventListener("dragstart", (event) => event.preventDefault());
}

function renderProgram(events, containerId = "programGrid") {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Sort events by start time
  const sorted = [...events].sort((a, b) => a.start - b.start);

  container.innerHTML = Object.entries(programLocations)
    .map(([key, { venue }]) => {
      const locationEvents = sorted.filter((e) => e.location === key);
      if (!locationEvents.length) return "";
      const label = escapeHtml(programLocationLabel(key));
      // kolumna dziedziczy kolor kategorii ze strefy na planie, więc program
      // i mapa mówią o miejscach tym samym kolorem
      const area = venue ? venueAreas.find((item) => item.id === venue) : null;
      return `
      <div class="program-column"${venue ? ` data-venue-id="${venue}"` : ""}${area ? ` data-venue-cat="${area.cat}"` : ""}>
        ${
          venue
            ? `<a class="program-location" href="#venue" data-venue-id="${venue}">${label}<span class="program-location-map">Pokaż na mapie</span></a>`
            : `<div class="program-location">${label}</div>`
        }
        ${locationEvents
          .map((event) => {
            const kind = programKinds[event.kind];
            return `
            <button type="button" class="program-card" data-event-id="${sorted.indexOf(event)}" aria-pressed="false">
              <span class="program-card-time">${formatTime(event.start)} - ${formatTime(event.end)}${kind ? ` <span class="program-card-tag" data-kind="${event.kind}">${kind}</span>` : ""}</span>
              <span class="program-card-title">${event.title}</span>
            </button>`;
          })
          .join("")}
      </div>`;
    })
    .join("");

  // cały rozkład pojawia się jako jedna całość - obserwowana jest siatka,
  // a nie poszczególne kolumny, więc kafelki nie wjeżdżają jeden po drugim

  const detail = document.getElementById("programDetail");
  const cards = new Map();
  container
    .querySelectorAll(".program-card")
    .forEach((el) => cards.set(el.dataset.eventId, el));

  const intro = `
    <div class="program-intro">
      <p>Cały dzień atrakcji &ndash; warsztaty, prelekcje i wieczorne występy.</p>
      <p class="program-intro-hint">Wybierz punkt programu, aby zobaczyć szczegóły</p>
    </div>`;

  let selectedId = null;

  function showDetail(event) {
    detail.classList.toggle("is-intro", !event);
    if (!event) {
      detail.innerHTML = intro;
      applyPolishTypography(detail);
      return;
    }
    const room = escapeHtml(programLocationLabel(event.location));
    const hosts =
      event.hosts && event.hosts.length ? formatHosts(event.hosts) : "";
    detail.innerHTML = `
      <h3>${event.title}</h3>
      <p class="program-detail-meta">
        ${formatTime(event.start)} &ndash; ${formatTime(event.end)}
        &middot; ${room}${hosts ? ` &middot; ${hosts}` : ""}
      </p>
      ${
        event.description
          ? `<p>${formatRichText(event.description)}</p>`
          : `<p class="program-detail-empty">Opis pojawi się już niedługo!</p>`
      }
    `;
    applyPolishTypography(detail);
  }

  function select(id) {
    selectedId = selectedId === id ? null : id;
    cards.forEach((el, cardId) => {
      const isSelected = cardId === selectedId;
      el.classList.toggle("selected", isSelected);
      el.setAttribute("aria-pressed", String(isSelected));
    });
    showDetail(selectedId === null ? null : sorted[Number(selectedId)]);
  }

  cards.forEach((el, id) => el.addEventListener("click", () => select(id)));
  if (detail) showDetail(null);

  // sam odnośnik przewija do sekcji z planem, a my dodatkowo zaznaczamy strefę
  container
    .querySelectorAll(".program-location[data-venue-id]")
    .forEach((el) => {
      el.addEventListener("click", () => {
        if (selectVenueArea) selectVenueArea(el.dataset.venueId);
      });
    });

  // wejście z planu terenu: przewijamy rząd do kolumny tej sali i podświetlamy
  // ją na chwilę, żeby było widać, o którą chodzi
  let highlightTimer = null;
  focusProgramColumn = (venueId) => {
    const column = container.querySelector(
      `.program-column[data-venue-id="${venueId}"]`,
    );
    if (!column) return;
    container
      .querySelectorAll(".program-column.is-target")
      .forEach((el) => el.classList.remove("is-target"));
    column.classList.add("is-target");
    const shift =
      column.getBoundingClientRect().left -
      container.getBoundingClientRect().left;
    container.scrollTo({
      left: container.scrollLeft + shift - 16,
      behavior: "smooth",
    });
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(
      () => column.classList.remove("is-target"),
      5000,
    );
  };

  applyPolishTypography(container);
}

// Klucze to kolumny z harmonogramu organizatorów, `venue` wskazuje strefę na
// planie terenu - stąd bierze się i odnośnik z nagłówka kolumny na mapę, i lista
// punktów programu w opisie strefy. Kolejność kluczy = kolejność kolumn.
//
// Uwaga: nazwy kolumn w harmonogramie nie pokrywają się z nazwami na planie -
// kolumna "Teren" to scena zewnętrzna, "Scena zewnętrzna" to teren przed halą,
// a koncerty z "Łącznika" grają w Sali Koncertowej. Dlatego nagłówek kolumny
// bierze nazwę ze strefy, a nie z klucza; `label` nadpisuje ją w razie potrzeby,
// a klucz bez `venue` po prostu nie dostaje powiązań z mapą.
// Kategorie punktów programu - `kind` przy wydarzeniu wybiera zarówno podpis
// plakietki, jak i jej kolor (kolory siedzą w CSS przy [data-kind]). Punkt bez
// kategorii po prostu nie dostaje plakietki.
const programKinds = {
  warsztat: "warsztat",
  prelekcja: "prelka",
  koncert: "występ",
};

const programLocations = {
  sala1: { venue: "warsztatowa" },
  sala2: { venue: "prelekcyjna-1" },
  sala3: { venue: "prelekcyjna-2" },
  teren: { venue: "scena-zewnetrzna" },
  scena: { venue: "teren-przed-hala" },
  chill: { venue: "strefa-chill" },
  game: { venue: "strefa-gier" },
  lacznik: { venue: "klub-lacznik" },
};

// nagłówek kolumny programu = nazwa strefy z planu, żeby każde miejsce miało na
// stronie dokładnie jedną nazwę
function programLocationLabel(key) {
  const location = programLocations[key];
  if (location.label) return location.label;
  const area = venueAreas.find((item) => item.id === location.venue);
  return area ? area.title : key;
}

// ustawiane przez renderVenueMap - pozwala zaznaczyć strefę na planie z innych
// sekcji strony (nagłówki kolumn programu)
let selectVenueArea = null;

// ustawiane przez renderProgram - przewija rozkład do kolumny danej sali
// i podświetla ją (odnośnik z opisu strefy na planie)
let focusProgramColumn = null;

// const exampleEvent = {
//   start: 10,
//   end: 11,
//   title: "Rejestracja",
//   description: "Rejestracja uczestników.",
//   hosts: ["Wroof"],
//   tag: "Organizacyjne",
//   location: "sala1",
// };
//
// Punkty trwające cały dzień - nie siedzą w kolumnie żadnej sali, tylko stoją
// nad rozkładem. `href` prowadzi wprost do sekcji, a `venue` na plan terenu
// z zaznaczeniem strefy (jak nagłówki kolumn programu).
const programSpecials = [
  { title: "Dealers' Den", start: 10, end: 20, href: "#dealers" },
  { title: "Przebieralnia", start: 9, end: 24, venue: "przebieralnia" },
  { title: "Furwalk", start: 12, end: 14.5, href: "#walk" },
];

function renderProgramSpecials(specials, containerId = "programSpecial") {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = specials
    .map((item) => {
      const href = item.href || (item.venue ? "#venue" : null);
      const body = `
        <span class="program-special-title">${escapeHtml(item.title)}</span>
        <span class="program-special-time">${formatTime(item.start)} - ${formatTime(item.end)}</span>`;
      return `
      <li>
        ${
          href
            ? `<a class="program-special-chip" href="${escapeHtml(href)}"${item.venue ? ` data-venue-id="${item.venue}"` : ""}>${body}</a>`
            : `<div class="program-special-chip">${body}</div>`
        }
      </li>`;
    })
    .join("");

  container.querySelectorAll("[data-venue-id]").forEach((el) => {
    el.addEventListener("click", () => {
      if (selectVenueArea) selectVenueArea(el.dataset.venueId);
    });
  });
}

// Godziny to liczby - po północy liczymy dalej (24 = 00:00, 25 = 01:00), dzięki
// czemu nocne punkty sortują się na końcu dnia, a nie na jego początku.
// Opisy i tagi czekają na uzupełnienie: kafelek bez opisu po prostu się nie
// rozwija.
const programEvents = [
  // Sala 1
  {
    start: 10,
    end: 11.5,
    title: "Furry Eventy w Polsce i w Europie",
    kind: "prelekcja",
    description:
      "Pierwszy konwent przed tobą? Może marzysz o konwencie za granicą? Praktyczny przewodnik po tym, jak się przygotować, dojechać i dobrze się bawić na furry eventach w Polsce i Europie.",
    hosts: ["ZGrate"],
    location: "sala1",
  },
  {
    start: 15,
    end: 17,
    title: "Szycie pluszaków",
    kind: "warsztat",
    description:
      "Uszyj własnego mini-pluszaka! Poznasz pracę z wykrojami, ręczne ściegi oraz sposoby na oczka i aplikacje, a wyjdziesz z okrągłym breloczkiem własnego pomysłu. *Obowiązują wcześniejsze zapisy - ogłoszenie niedługo.*",
    hosts: ["reyk4h"],
    location: "sala1",
  },
  {
    start: 17,
    end: 21,
    title: "Twój własny ogon!",
    description:
      "Powracające warsztaty szycia i fursuitmakingu pod okiem specjalistek z eFutro - Nutka Fursuits i Dragonia Cosplay! W tym roku podczas tych czterogodzinnych warsztatów każdy uczestnik będzie mógł uszyć swój własny ogon! *Obowiązują wcześniejsze zapisy - ogłoszenie niedługo.*",
    kind: "warsztat",
    hosts: ["Nutka Fursuits", "Dragonia Cosplay"],
    location: "sala1",
  },

  // Sala 2
  {
    start: 17,
    end: 20,
    title: "Kącik rysunkowy",
    kind: "warsztat",
    description:
      "Roborak - autor tegorocznych grafik na identyfikatory - oraz Modest - wrocławski grafik - zapraszają wszystkich na unikalne warsztaty z rysunku! Dla chętnych dostępne będą też kolorowanki.",
    hosts: ["Roborak", "Modest"],
    location: "sala2",
  },
  {
    start: 20,
    end: 22,
    title: "Długa podróż pociągiem",
    kind: "prelekcja",
    description:
      "Kącik dyskusyjny dla miłośników podróżowania i kolei. Rozmawiamy o tym, jak umilić sobie kilkugodzinną jazdę pociągiem.",
    hosts: ["Semafix"],
    location: "sala2",
  },

  // Sala 3
  {
    start: 10,
    end: 11,
    title: "Muzyka w fandomie",
    kind: "prelekcja",
    description:
      "Prezentacja o muzycznej stronie fandomu - krótka historia, gatunki, futrzaści twórcy oraz kulisy tworzenia i wydawania własnej muzyki.",
    hosts: ["Falconthropy"],
    location: "sala3",
  },
  {
    start: 11,
    end: 12,
    title: "Zostać swoją fursoną",
    kind: "prelekcja",
    description:
      "Jak stać się swoją fursoną? Przegląd metod - od roleplayu i fursuitów po pomysły rodem z science fiction.",
    hosts: ["VladiVerse"],
    location: "sala3",
  },
  {
    start: 17,
    end: 18,
    title:
      "Wrzaski pośród miękkich ścian, czyli i ty możesz zostać aktorem głosowym",
    kind: "prelekcja",
    description:
      "Po wielu latach pracy nad dużymi tytułami jako projektant gier komputerowych, Neeto Batito (aka Yoshi) postanowił poszerzyć swoją ekspertyzę o voice acting. Jak to się robi i czego potrzeba w tej pracy?",
    hosts: ["Neeto Batito (aka Yoshi)"],
    location: "sala3",
  },
  {
    start: 18,
    end: 19,
    title: "Geocaching",
    kind: "prelekcja",
    description: "Geocaching — czym właściwie jest to szukanie skrzynek?",
    hosts: ["Svartrav"],
    location: "sala3",
  },
  {
    start: 19,
    end: 20,
    title: "Pokojowy Patrol",
    kind: "prelekcja",
    description:
      "Pokojowy Patrol od środka: czym zajmuje się podczas wydarzeń, jak do niego dołączyć i co można dzięki temu zyskać.",
    hosts: ["Legryf"],
    location: "sala3",
  },
  {
    start: 20,
    end: 22,
    title: "Produkcja piwa bezalko",
    kind: "prelekcja",
    description:
      "Jak powstaje piwo bezalkoholowe i co mówią o nim przepisy? Prelekcja połączona z degustacją domowych wyrobów bez procentów.",
    hosts: ["Biksu"],
    location: "sala3",
  },

  // Teren (na planie: scena zewnętrzna)
  {
    start: 17,
    end: 18.5,
    title: "Warsztaty line dance",
    kind: "warsztat",
    description:
      "Warsztaty line dance w kowbojskim klimacie - doświadczenie nie wymagane! *Obowiązują wcześniejsze zapisy - ogłoszenie niedługo.*",
    location: "teren",
  },
  {
    start: 19,
    end: 20,
    title: "HI.YEENA",
    kind: "koncert",
    description: "Po prostu muzyczne vibe'y, taki do chillu 🥺👉👈",
    hosts: ["Richard"],
    location: "teren",
  },
  {
    start: 20,
    end: 22,
    title: "Mowen DJ set",
    kind: "koncert",
    description: "Set w formule open format - wszystko, co dobrze niesie.",
    hosts: ["Mowen"],
    location: "teren",
  },

  // Scena zewnętrzna (na planie: teren przed halą)
  {
    start: 16,
    end: 17,
    title: "Inni INNI",
    kind: "koncert",
    description:
      "„Inni INNI” — plenerowy spektakl Teatru Nowego Cyrku Kolektyw KEJOS o czwórce klaunów, które tracą swój cyrk i dom. Opowieść o inności, tożsamości i akceptacji, inspirowana „Przygodami Pędrka Wyrzutka” Themersona. Dla widzów w każdym wieku.",
    hosts: ["Teatr Kejos"],
    location: "scena",
  },
  {
    start: 19,
    end: 22,
    title: "Krótkofalarstwo",
    kind: "warsztat",
    description:
      "Klub krótkofalarski SP0FUR zaprasza na spotkanie z amatorską radiokomunikacją — czym jest, jak zacząć i co mówią przepisy o radiotelefonach ręcznych. Ze sprzętem i antenami na świeżym powietrzu.",
    hosts: ["LycanAnanas"],
    location: "scena",
  },

  // Łącznik (na planie: Sala Koncertowa)
  {
    start: 18,
    end: 19,
    title: "The Generates",
    description:
      "Siedmiu muzyków, jedna scena i pierwszy w historii Wroofa koncert na żywo! Czy to jazz? Czy to rock? Czy to funk? Sami nie umieją powiedzieć - liczy się tylko dobra zabawa!",
    hosts: [
      "Bartor",
      "BryQ",
      "Feniks",
      "Grave",
      "Nadi",
      "Pasterz",
      "Skaj",
      "Witek",
    ],
    kind: "koncert",
    location: "lacznik",
  },
  {
    start: 20,
    end: 21,
    title: "DJ 0RC4",
    kind: "koncert",
    description: "DJ set w klimatach jungle i D&B.",
    hosts: ["Shacchi"],
    location: "lacznik",
  },
  {
    start: 21,
    end: 22,
    title: "ALT-0",
    kind: "koncert",
    description: "ALT-0 : Start the Techno. Powrót do mocnych bitów!",
    hosts: ["DJ Altro"],
    location: "lacznik",
  },
  {
    start: 22,
    end: 23,
    title: "Soren DJ set",
    description: "Organica, Melodic Techno, DnB",
    kind: "koncert",
    hosts: ["Soren"],
    location: "lacznik",
  },
  {
    start: 23,
    end: 23.5,
    title: "Shitpostcore 3-6-9-#",
    description:
      "Na main stage w sobotę o 23:00 NIE będzie grany Shitpostcore 3-6-9-#. Proszę NIE przychodzić na Wroof w tym celu.",
    kind: "koncert",
    hosts: ["Feniks"],
    location: "lacznik",
  },
  {
    start: 23.5,
    end: 25,
    title: "Tino DJ set",
    kind: "koncert",
    description: 'Gościnny występ z UK, który autor nazywa "genrebending"!',
    hosts: ["Tino"],
    location: "lacznik",
  },
];

// do wyszukiwania: małe litery bez ogonków (ł nie rozkłada się przez NFD)
function normalizePl(text) {
  return text
    .toLowerCase()
    .replace(/\u0142/g, "l")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

// z adresu robimy czytelną etykietę: @nick dla Instagrama, domena dla reszty
function formatLinkLabel(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace(/^www\./, "");
    const handle = pathname.split("/").filter(Boolean)[0];
    if (host === "instagram.com" && handle) return `@${handle}`;
    return host;
  } catch {
    return url;
  }
}

// Lekkie formatowanie opisów: *kursywa*, **pogrubienie**. Treść najpierw
// escapujemy, więc w opisach można pisać zwykły tekst bez oglądania się na HTML.
function formatRichText(str) {
  return escapeHtml(str)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

// Plan Dealers' Denu: dwa bloki stoisk (lewy: pasy A/B, prawy: pasy C/D),
// wejście do Hali na dole. Wiersze liczone z góry.
const denGeometry = {
  laneX: { A: 3, B: 14, C: 44, D: 55 },
  stallW: 11,
  stallH: 11,
  rowH: 11,
};

// const exampleDealer = {
//   id: 1,
//   title: "FluffyFluff Fluffies",
//   lane: "A",
//   row: 15,
//   description: "Przedmioty i takie tam.", // opcjonalne
//   links: ["https://www.instagram.com/handle/"], // opcjonalne, może być kilka
// };
const dealersList = [
  {
    id: 1,
    title: "Fukari",
    lane: "A",
    row: 15,
    links: ["https://www.instagram.com/makabrotka/"],
    description:
      "Zapraszamy na stragan pełny ilustracji stworzonych przez artystyczny duet Fukari&Yoshi :3 Fukari jest rysownikiem o charakterystycznym stylu, a inspiracje czerpie między innymi z animacji, mangi i gier. Jego rysunki skupiają się wokół jego oryginalnych postaci i zwierzątek, a specjalnie na Wroof powstanie kilka furry fanartów! Yoshi kocha urocze detale. W jego delikatnym stylu przewijają się motywy cyrkowe, słodkie zwierzątka oraz postacie gier i serii, na które ma aktualnie hype.",
  },
  {
    id: 2,
    title: "pinkcuttlefish",
    lane: "B",
    row: 15,
    links: ["https://www.instagram.com/pinkcuttlefish/"],
    description:
      "Ilustratorka z Wrocławia oferująca mnóstwo autorskich śliczności takich jak naklejki, plakaty, figurki akrylowe, przypinki, czy breloczki. Wielbiciele rzeczy w uroczej stylistyce z pewnością wyszukają tu coś dla siebie!",
  },
  {
    id: 3,
    title: "Dehydracja",
    lane: "B",
    row: 14,
    links: ["https://t.me/endrayreido"],
    description:
      "Dehydracja to twór dwojga uzdolnionych i niebanalnie charyzmatycznych twórców~ Stoisko wypełnione przypadkowymi przedmiotami inspirowanymi wspólnymi halucynacjami podczas przemierzania pustyni marzeń. Artyści: Juice i EndRayRei.",
  },
  {
    id: 4,
    title: "BaiPen Arts",
    lane: "B",
    row: 13,
    description:
      "Howdy cowboje, tu BaiPen Arts - jesteśmy dwójką artystów (Bailord i Pencia), którzy wspólnie tworzą futrzasty merch Znajdziesz u nas: naklejki, smyczki, kubeczki, zeszyty na naklejki, printy, breloczki, fursuitowe części, fursuit spraye, i wiele więcej! (szczególnie dużo łapek)",
  },
  {
    id: 5,
    title: "Dumb Dogs Craft",
    lane: "A",
    row: 12,
    description:
      "Cześć! Jesteśmy Dumb Dogs Crafts! Znajdziesz u nas autorskie gadżety z uroczymi zwierzątkami, memami oraz kulturą fandomową! Oferujemy naklejki, breloki, przypinki i kubki oraz różnorodne dodatki do fursuitów, takie jak fursuit spraye czy obroże! Znaleźć możesz u nas również części do suitow i bazy. Wpadnij się przywitać i zgarnać coś do swojej kolekcji merchu!",
  },
  {
    id: 6,
    title: "CherryBomb",
    lane: "A",
    row: 11,
    links: [
      "https://www.instagram.com/cha0s_error?igsh=MTd6c251dDRlNmgwNw==",
      "https://www.instagram.com/timbermaws?igsh=MWR2bDU3bHcwdmVwYg%3D%3D&utm_source=qr",
    ],
    description:
      "Pod nazwą CherryBomb kryje się duet Timber&Error! Jesteśmy wielbicielami jaskrawych kolorów w grafikach, a znajdziecie u nas między innymi ilustracje, breloki akrylowe i pluszowe oraz multum naklejek z przeróżnych fandomów jak i również oryginalnych designów! X3 Na naszym stoisku czekają na was też ręcznie robione akcesoria, części do fursuitów, naszywki i inne drobiazgi!",
  },
  {
    id: 7,
    title: "Chmural",
    lane: "A",
    row: 10,
    links: [
      "https://www.instagram.com/chmural_/",
      "https://linktr.ee/jeanwoof",
    ],
    description:
      "Content furry i fandomowy - konwentowy merch (printy, naklejki, przypinki itd) z futrzakami i popularnymi postaciami, ale również sporo unikatowych i jedynych w swoim rodzaju tworów artystycznych - artów w tradyszu, ceramika i linoryty odciśnięte na ręcznie robionym papierze i ubraniach. Każdy znajdzie coś dla siebie, zapraszam!",
  },
  {
    id: 8,
    title: "FosloArt",
    lane: "A",
    row: 9,
    links: ["https://www.instagram.com/fosloart/"],
    description:
      "Foslo ilustruje i sitodrukuje, lokalnie z Wrocławia, uwielbia klimaty fantastyki, mitologii i folkloru, jest wielką fanką pokracznych stworów ze średniowiecznych manuskryptów. Oferuje printy, naklejki, breloki, przypinki i rysunki na zamówienie.",
  },
  {
    id: 9,
    title: "Little Demon",
    lane: "A",
    row: 8,
    links: ["https://www.instagram.com/kakanra.art?igsh=Mm0xNTRqeGg3eW84"],
    description:
      "Little Demon - wyjątkowe rękodzieło z gliny! Breloczki, przypinki i magnesy, a także własnoręcznie drukowane i składane sticker booki. Do tego printy, naklejki oraz Blind Bagi inspirowane tematyką eventu!",
  },
  {
    id: 10,
    title: "Punished Brut",
    lane: "A",
    row: 7,
    description:
      "Kawałek świata ilustratorki z zamiłowaniem do gatunków takich jak dark fantasy, cyberpunk, sci-fi i horror. Pośród towarów jej autorstwa można znaleźć plakaty, naklejki, breloki, smycze i przypinki oraz ilustracje wykonane przy pomocy technik tradycyjnych i cyfrowych.",
  },
  {
    id: 11,
    title: "The Woof Above",
    lane: "B",
    row: 6,
    links: [
      "https://www.instagram.com/thewoofabove?igsh=Znc2anBsbHlya3M0",
      "https://t.me/TheWoofAbove",
    ],
    description:
      "The Woof Above to stoisko gdzie możecie wznieść się ponad chmury i odkryć różnorodny merch! Znajdziecie tu printy, naklejki, przypinki i breloczki z fursonami, a także ciekawe akcesoria i propy do fursuitów - od obroży, kokardek i bandanek po pluszowe kostki, listki, rybki, sadzone jajka i wiele innych! Oferuję również części do fursuitów takie jak ogonki i górne łapki, wykonane przez Arie - artystkę zajmującą się szyciem fursuitów i akcesoriów od 2021 roku. A jeśli szukacie czegoś na co dzień czekają na was kubki, torby, podkładki i inne gadżety! Każdy znajdzie coś dla siebie! ^^",
  },
  {
    id: 12,
    title: "TorrnDraws",
    lane: "B",
    row: 5,
    links: [
      "https://www.instagram.com/torrndraws/",
      "https://torrndraws.carrd.co/",
    ],
    description:
      "Torrn tworzy ilustracje, designy i produkty ze słodkimi postaciami „furry”. Na stoisku znajdą się wydruki, przypinki, naklejki, fidget toye, akrylowe zawieszki i pluszaki. Poza tym dostępne będą też części do fursuitów drukowane z TPU.",
  },
  {
    id: 13,
    title: "Luna & Jules",
    lane: "B",
    row: 4,
    links: [
      "https://www.instagram.com/jul.kaim",
      "https://www.instagram.com/dyke.pl",
      "https://dyke.pl",
    ],
    description:
      "Jules to ilustratorka i pasjonatka literatury i komiksu. Luna to artystka audiowizualna i domorosła rękodzielniczka. Razem tworzą przestrzeń, w której znajdziecie queerowe printy, naklejki i rękodzieło.",
  },
  {
    id: 14,
    title: "LunArtFox Lab",
    lane: "B",
    row: 3,
    links: ["https://linktr.ee/LunArtFox_Lab"],
    description:
      "LunArtFox_Lab to dwójka artystów (White LunArt oraz Silv3rfox_den), która połączyła wspólne zamiłowania do druku 2D oraz 3D, by stworzyć razem coś unikalnego. Oboje czerpiemy radość z tworzenia sztuki wszelkiego rodzaju, takiej jak przypinki, zawieszki, ilustracje, wydruki 3D, figurki i wiele więcej. Można u nas znaleźć rzeczy nawiązujące do tematyki fantastycznej, w tym również popkultury, a w szczególności starszych gier, filmów i książek - tematyka i styl naszych prac są ukłonem w stronę starszych animacji oraz gier. Znajdziecie też dodatki i akcesoria nawiązujące do popkultury i memów, naklejki i przypinki inspirowane zmaganiami z drukiem 3D, ale również dodatki do cosplayów czy fursuitów. Niektóre z wydruków są bardzo praktyczne, jak na przykład spinki wyrażające różne ekspresje, które mogą się stać częścią cosplayu. Na naszym stanowisku znajdziecie również wiele zwierzaków, a w szczególności kotów. Zapraszamy!",
  },
  {
    id: 15,
    title: "Jelly Sketch",
    lane: "A",
    row: 2,
    links: [
      "https://www.instagram.com/jellysketch/",
      "https://jellysketch.com/",
    ],
    description:
      "Stoisko od artysty & króliczego vtubera, gdzie znajdziecie autorskie prace inspirowane waszymi ulubionymi bajkami z dzieciństwa i grami! Od naklejek i printów, po suncatchery - każdy znajdzie coś dla siebie!",
  },
  {
    id: 16,
    title: "RainbowMess Stand",
    lane: "A",
    row: 1,
    description:
      "Na tym stoisku króluje tęcza, słodkości, brokat i różne śliczności. Idealne miejsce dla wielbicieli kotów i bajek, pełne różnorakich gadżetów. Znajdziesz tu na pewno masę kolorowych naklejek, breloczków, przypinek czy nawet ozdób do włosów i nie tylko!",
  },
  {
    id: 17,
    title: "Coverwithfur",
    lane: "A",
    row: 0,
    links: ["https://www.instagram.com/coverwithfur/"],
    description:
      "CoverWithFur zaprasza na stoisko pełne kolorów, futrzanej kreatywności i unikalnego rękodzieła. Od 2018 roku artystka tworzy fursuity oraz akcesoria, łącząc pasję, zaangażowanie i nutę kontrolowanego chaosu, który nadaje każdemu projektowi niepowtarzalny charakter. Na stoisku dostępne są: miękkie, barwne ogony z wysokiej jakości sztucznego futra - doskonałe do cosplayu i stylizacji fursuitowych; wygodne łapki; bazy fursuitowe, głównie psowate i kotowate, ale znajdzie się też coś dla fanów smoków, przygotowane do dalszej personalizacji; naklejki, printy, smycze, obróżki oraz inne dodatki, które wnoszą odrobinę koloru do codzienności; gotowe fursuity - dopracowane w detalach, przyjazne w noszeniu i gotowe na nowy dom. Oferta została przygotowana tak, aby każdy odwiedzający mógł znaleźć coś dla siebie - od drobnych akcesoriów po bardziej rozbudowane projekty.",
  },
  {
    id: 18,
    title: "Feather Fox Creations & Golden Stripes",
    lane: "D",
    row: 15,
    links: [
      "https://www.instagram.com/feather_fox_creations",
      "https://www.instagram.com/goldenstripesofficial",
    ],
    description:
      "Znajdziecie tu różnego rodzaju rękodzieło i oryginalną sztukę. Arlexa specjalizuje się w szyciu i druku 3D - znajdziecie u niej ogonki, uszka, dodatki do fursuitów, zawieszki, ale również rzeczy przedstawiające jej grafiki, jak naklejki czy breloki. Tay również zajmuje się rysunkiem i rękodziełem - zobaczycie u niego printy, naklejki, przypinki, breloczki, wszystko w tematyce antropomorficznych postaci, ale i pride oraz różnych fandomów. Oferuje również różnego rodzaju biżuterię i dodatki, zarówno do codziennego noszenia, jak i do fursuita - obroże, smycze, pluszowe kości, bransoletki.",
  },
  {
    id: 19,
    title: "Jay Spikey’s Den",
    lane: "D",
    row: 14,
    links: [
      "https://www.instagram.com/jay_spikey",
      "https://t.me/Artistc_mess",
    ],
    description:
      "Jay Spikey’s Den to stoisko w tematyce okołofutrzastej, znajdziecie tutaj unikalne koszulki z ręcznie odbitymi linorytami, urocze naklejki, stylowe breloki, a także sporą ilość autorskich ilustracji. Oprócz tego można do mnie zagadać i zamówić spersonalizowanego arta, zapraszam!",
  },
  {
    id: 20,
    title: "Bubblegum paws",
    lane: "D",
    row: 13,
    links: [
      "https://www.instagram.com/bubblegum_paws/",
      "https://bubblegum-paws.sumupstore.com/",
    ],
    description:
      "Witaj w naszej różowej cukierni! Bubblegum Paws powstało z myślą o stworzeniu najsłodszych i najbardziej uroczych drobiazgów, jakie tylko mogą Ci towarzyszyć każdego dnia! W naszym menu znajdziesz takie słodkości jak kocie naklejki, przypinki, breloki akrylowe, photocardy, printy, pocztówki, przeróżne gache, kolorowe smyczki oraz ręcznie odlewane i komponowane przez nas świece sojowe.",
  },
  {
    id: 21,
    title: "Pararoo",
    lane: "D",
    row: 12,
    links: ["https://www.instagram.com/pararoo/"],
    description:
      "Witajcie na planecie Pararoo! Znajdziecie tu ogrom gadżetów nie z tej ziemi - breloczki, naklejki, torby, printy, przypinki, a nawet koszulki. Wszystkie te futrzaste wspaniałości połączyłam z waszymi ulubionymi fandomami i moimi oryginalnymi pomysłami.",
  },
  {
    id: 22,
    title: "DogzCrew",
    lane: "D",
    row: 11,
    links: ["https://www.instagram.com/dogzcrew/", "https://www.dogzcrew.com"],
    description:
      "DogzCrew is crafting tshirts and cloths for all party animalz around the world since 2018! Every event we bring fresh new designs and cool merch to add to your collection. This year, don't miss out on our squeaky NFC-tagged paw charms, new full-print shirt and cozy, colorful socks that'll keep your paws warm! Swing by our booth to chat about custom hoodies made just for you! All our designs are crafted by us or in collabs with amazing artists from across the world!",
  },
  {
    id: 23,
    title: "RedIzak",
    lane: "C",
    row: 10,
    links: ["https://www.instagram.com/red_izak/", "https://linktr.ee/redizak"],
    description:
      "Hej! Nazywam się RedIzak! Jestem artystą fantasy i sprzedaję przedmioty codziennego użytku zaprojektowane przeze mnie i mojego męża.",
  },
  {
    id: 24,
    title: "Noeru",
    lane: "C",
    row: 9,
    links: ["https://linktr.ee/noeru_art"],
    description:
      "Wkroczcie do świata miękkiego rękodzieła! Przytulne maskotki wykonane na szydełku oraz unikalne, ręcznie szyte pluszaki o niepowtarzalnym charakterze już czekają! Razem z nimi dodatki do amigurumi oraz nasze unikatowe autorskie oczka do pluszaków!",
  },
  {
    id: 25,
    title: "Śpiochowa Wiedźma",
    lane: "C",
    row: 8,
    links: ["https://www.instagram.com/spiochowa_wiedzma/"],
    description:
      "Artystyczny kącik, tworzony z pasją i szczyptą magii przez Wiedźmę. Tutaj odnajdą się nie tylko fani uroczych zwierzaków, ale też książek i animacji. Obok nich znajdziesz autorskie grafiki wykonane technikami tradycyjnymi. Od naklejek, przez breloki, przypinki, aż do zakładek do książek, ręcznie szytych notesów i akcesoriów kreatywnych. Z szerokiego i wielomagicznego asortymentu wybierzesz dla siebie coś ciekawego.",
  },
  {
    id: 26,
    title: "Morimersmortuar & Rzygacz",
    lane: "D",
    row: 7,
    links: [
      "https://linktr.ee/morimersmortuar",
      "https://linktr.ee/mortalskull",
    ],
    description:
      "W wyjątkowym collabie debiutują Mori Mer oraz Rzygacz! Razem przywozimy wam merch o stylistyce innej niż wszystkie! Spotkacie u nas realistyczne paintingi, stylizowane old schoolowe nadruki, urocze naklejki i co jeszcze? Potwory? Mamy! Anthro? Mamy! Piękne kobiety? Być może... Sam się przekonaj!",
  },
  {
    id: 27,
    title: "Frodo Arts",
    lane: "D",
    row: 6,
    links: ["https://frodo0o.carrd.co"],
    description:
      "Hejka! Zapraszamy na nasze stanowisko, gdzie na pewno znajdziecie coś dla siebie! Naszą specjalnością są przede wszystkim naklejki, rysunki oraz YCH, które możecie kupić bezpośrednio u nas na miejscu. Co u nas znajdziecie: stickery, breloczki, spraye do fursuitów, fursuitowe propy, smyczki, wristbandy, przypinki, badge, komisze oraz YCHe. Mamy także mystery bagi! Ponadto możecie u nas zamówić badge z WROOF pickup!",
  },
  {
    id: 28,
    title: "Kasia Misia",
    lane: "D",
    row: 5,
    links: [
      "https://www.instagram.com/kasia_misia_art/",
      "https://linktr.ee/Kasia_Misia",
    ],
    description:
      "Kasia Misia to idealne stoisko dla każdego furry! Pełne merchu, który reprezentuje niszowe gatunki, plus size postaci i fandomowy humor, ale też przydatnych do fursuitowania gadżetów takich jak badge i spraye!",
  },
  {
    id: 29,
    title: "Dragonfire Deer x Print it All",
    lane: "D",
    row: 4,
    links: ["https://t.me/dragonfiredeer", "https://t.me/print_it_all"],
    description:
      "Zapraszamy na stoisko, gdzie rękodzieło spotyka się z drukiem 3D oraz sublimacją. Dragonfire Deer & Print it All to fuzja dwóch pasji, której owocem są unikalne produkty dopasowane do Waszych potrzeb. Co nas wyróżnia? Wysoka jakość wykonania oferowanych towarów oraz duża różnorodność asortymentu – od komponentów do produkcji fursuitów, przez zabawki z druku 3D, po szyte przez nas poduszki i propsy z własnymi, unikatowymi wzorami.",
  },
  {
    id: 30,
    title: "Chestnut",
    lane: "D",
    row: 3,
    links: [
      "https://www.instagram.com/chestnut.allart/",
      "http://www.chestnutstore.pl/",
    ],
    description:
      "Znalazłeś Chestnut! Od słodkich i mięciutkich, do groźnych i dzikich - merch dla każdego wielbiciela łapek, smoków i anime. Szukasz printów, a może naklejek? Albo bannera do ozdobienia ściany? Nigdy nie wiesz, jakie skarby znajdziesz.",
  },
  {
    id: 31,
    title: "Chatka Lisiej Mamy",
    lane: "D",
    row: 2,
    links: ["https://www.instagram.com/chatka_lisiej_mamy/"],
    description:
      "Lisia Mama zaprasza po kolejną dawkę puchatych dobroci! Ręcznie robione elementy fursuitów, łapy, ogony, pluszaki, a także autorskie naklejki i printy z motywem zwierzaków. Chodź, przybij piątkę!",
  },
  {
    id: 32,
    title: "Creative Dog Paws",
    lane: "D",
    row: 1,
    links: ["https://www.instagram.com/creative_dog_paws/"],
    description:
      "Studio Creative Dog Paws zajmuje się profesjonalnym tworzeniem fursuitów od 2023 roku! Na stoisku znajdziecie również części do fursuitów, od ogonów po łapki górne. Oprócz tego znajdziecie też rysunki tworzone digitalowo - na stoisku w postaci różnych przedmiotów, akcesoriów do wystroju wnętrza lub ozdoby waszego plecaka czy kluczy! Dodatkowo od niedawna można znaleźć różne ciekawe dodatki do fursuitów, jak propsy czy obroże. ;3 Serdecznie zapraszamy!",
  },
];

function renderDealerDen(dealers) {
  const svg = document.getElementById("denMapSvg");
  const list = document.getElementById("denList");
  const detail = document.getElementById("denDetail");
  const tooltip = document.getElementById("denTooltip");
  const search = document.getElementById("denSearch");
  if (!svg || !list || !detail) return;

  const { laneX, stallW, stallH, rowH } = denGeometry;
  // panel opisu bez wybranego stoiska służy jako wstęp do sekcji
  const intro = `
    <div class="denmap-intro">
      <p>W tym roku na Dealers' Denie znajdziecie</p>
      <p class="denmap-intro-count">32 stanowiska</p>
      <p>pełne sztuki, rękodzieła i futrzastych gadżetów!</p>
      <p class="denmap-intro-hint">Wybierz stanowisko na planie lub z listy, aby dowiedzieć się o nim więcej</p>
    </div>`;

  svg.innerHTML = `
    ${dealers
      .map((d) => {
        const x = laneX[d.lane];
        const y = d.row * rowH;
        return `
      <g class="denmap-stall" data-den-id="${d.id}" tabindex="0" role="button"
         aria-label="Stanowisko ${d.id}: ${escapeHtml(d.title)}">
        <rect class="denmap-stall-shape" x="${x}" y="${y}" width="${stallW}" height="${stallH}" rx="1.5" />
        <text class="denmap-stall-label" x="${x + stallW / 2}" y="${y + stallH / 2}">${d.id}</text>
      </g>`;
      })
      .join("")}
  `;

  list.innerHTML = dealers
    .map(
      (d) => `
      <li>
        <button type="button" class="denmap-chip" data-den-id="${d.id}">
          <span class="denmap-chip-num">${d.id}</span>
          <span class="denmap-chip-name">${escapeHtml(d.title)}</span>
        </button>
      </li>`,
    )
    .join("");

  const stalls = new Map();
  const chips = new Map();
  svg
    .querySelectorAll(".denmap-stall")
    .forEach((el) => stalls.set(Number(el.dataset.denId), el));
  list
    .querySelectorAll(".denmap-chip")
    .forEach((el) => chips.set(Number(el.dataset.denId), el));

  let selectedId = null;
  let query = "";
  // na ekranach dotykowych chmurka z nazwą tylko przeszkadza
  const canHover = window.matchMedia("(hover: hover)").matches;

  // szukamy po nazwie, numerze stanowiska i treści opisu - bez polskich znaków,
  // żeby "szydelko" znalazło "szydełko", a "kotow" - "kotów"
  const haystacks = new Map(
    dealers.map((d) => [
      d.id,
      normalizePl(`${d.title} ${d.description || ""}`),
    ]),
  );

  const matches = (dealer) =>
    !query ||
    String(dealer.id) === query ||
    haystacks.get(dealer.id).includes(query);

  function showDetail(dealer) {
    detail.scrollTop = 0;
    detail.classList.toggle("is-intro", !dealer);
    if (!dealer) {
      detail.innerHTML = intro;
      applyPolishTypography(detail);
      return;
    }
    detail.innerHTML = `
      <div class="denmap-detail-number">Stanowisko ${dealer.id}</div>
      <h3>${escapeHtml(dealer.title)}</h3>
      ${
        dealer.description
          ? `<p>${escapeHtml(dealer.description)}</p>`
          : `<p class="denmap-detail-empty">Opis tego stoiska pojawi się już niedługo!</p>`
      }
      ${
        dealer.links && dealer.links.length
          ? `<div class="denmap-detail-links">
              ${dealer.links
                .map(
                  (link) =>
                    `<a class="denmap-detail-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(formatLinkLabel(link))}</a>`,
                )
                .join("")}
            </div>`
          : ""
      }
    `;
    applyPolishTypography(detail);
  }

  function scrollChipIntoView(chip) {
    const item = chip.parentElement;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop) {
      list.scrollTop = top - 8;
    } else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight + 8;
    }
  }

  function select(id, { scroll = false } = {}) {
    selectedId = selectedId === id ? null : id;
    dealers.forEach((d) => {
      const isSelected = d.id === selectedId;
      stalls.get(d.id).classList.toggle("selected", isSelected);
      chips.get(d.id).classList.toggle("selected", isSelected);
      chips.get(d.id).setAttribute("aria-pressed", String(isSelected));
    });
    showDetail(dealers.find((d) => d.id === selectedId));
    if (scroll && selectedId) scrollChipIntoView(chips.get(selectedId));
  }

  function applyFilter() {
    let visible = 0;
    dealers.forEach((d) => {
      const ok = matches(d);
      if (ok) visible++;
      stalls.get(d.id).classList.toggle("dimmed", !ok);
      chips.get(d.id).parentElement.hidden = !ok;
    });
    const empty = list.querySelector(".denmap-list-empty");
    if (!visible && !empty) {
      list.insertAdjacentHTML(
        "beforeend",
        `<li class="denmap-list-empty">Nie znaleźliśmy takiego wystawcy.</li>`,
      );
    } else if (visible && empty) {
      empty.remove();
    }
  }

  function moveTooltip(event) {
    const parent = tooltip.parentElement;
    const box = parent.getBoundingClientRect();
    tooltip.style.left = `${event.clientX - box.left}px`;
    tooltip.style.top = `${event.clientY - box.top}px`;
  }

  stalls.forEach((el, id) => {
    const dealer = dealers.find((d) => d.id === id);
    el.addEventListener("click", () => select(id, { scroll: true }));
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select(id, { scroll: true });
      }
    });
    el.addEventListener("mouseenter", (event) => {
      chips.get(id).classList.add("hovered");
      if (!tooltip || !canHover) return;
      tooltip.textContent = `${id}. ${dealer.title}`;
      tooltip.hidden = false;
      moveTooltip(event);
    });
    el.addEventListener("mousemove", (event) => {
      if (tooltip && !tooltip.hidden) moveTooltip(event);
    });
    el.addEventListener("mouseleave", () => {
      chips.get(id).classList.remove("hovered");
      if (tooltip) tooltip.hidden = true;
    });
  });

  chips.forEach((el, id) => {
    el.setAttribute("aria-pressed", "false");
    el.addEventListener("click", () => select(id));
    el.addEventListener("mouseenter", () =>
      stalls.get(id).classList.add("hovered"),
    );
    el.addEventListener("mouseleave", () =>
      stalls.get(id).classList.remove("hovered"),
    );
    el.addEventListener("focus", () => stalls.get(id).classList.add("hovered"));
    el.addEventListener("blur", () =>
      stalls.get(id).classList.remove("hovered"),
    );
  });

  if (search) {
    search.addEventListener("input", () => {
      query = normalizePl(search.value.trim());
      applyFilter();
    });
  }

  showDetail(null);
}

// Trasa fursuitwalka - jedna pętla z zajezdni Dąbie pod Halę Stulecia i z
// powrotem. Geometria odrysowana z OpenStreetMap (ulice, aleja przez park,
// przejście na plac pod Iglicą i pasaż między Halą a fontanną), współrzędne
// w formacie [szerokość, długość].
const walkRoute = [
  [51.10518, 17.08601],
  [51.1062, 17.08648],
  [51.10629, 17.08666],
  [51.10667, 17.08632],
  [51.107, 17.08608],
  [51.10723, 17.08584],
  [51.10788, 17.08475],
  [51.10791, 17.08437],
  [51.10807, 17.08454],
  [51.10854, 17.08488],
  [51.10861, 17.08479],
  [51.10876, 17.08442],
  [51.10902, 17.08407],
  [51.10963, 17.08346],
  [51.11021, 17.08303],
  [51.11017, 17.08284],
  [51.11024, 17.08259],
  [51.11057, 17.08165],
  [51.11073, 17.08111],
  [51.11078, 17.08066],
  [51.1109, 17.08058],
  [51.10895, 17.07383],
  [51.1089, 17.07386],
  [51.10804, 17.0738],
  [51.10807, 17.0742],
  [51.10784, 17.07415],
  [51.10764, 17.07475],
  [51.10762, 17.0755],
  [51.10771, 17.0757],
  [51.1075, 17.07628],
  [51.10798, 17.07671],
  [51.10791, 17.07694],
  [51.10812, 17.07774],
  [51.10794, 17.07823],
  [51.10772, 17.07953],
  [51.10734, 17.0792],
  [51.107, 17.07898],
  [51.10645, 17.07887],
  [51.1061, 17.07892],
  [51.1058, 17.07912],
  [51.1056, 17.0794],
  [51.10556, 17.07953],
  [51.10601, 17.08025],
  [51.10609, 17.08044],
  [51.10621, 17.08116],
  [51.10626, 17.08131],
  [51.10716, 17.08291],
  [51.1074, 17.08325],
  [51.10791, 17.08437],
  [51.10788, 17.08475],
  [51.10719, 17.08589],
  [51.10629, 17.08666],
  [51.1062, 17.08648],
  [51.10518, 17.08601],
];

// Na mapie zaznaczamy tylko miejsca, w których się zatrzymujemy - kolejne
// ulice trasy opisuje podpis pod listą.
const walkStops = [
  {
    id: 1,
    name: "Czasoprzestrzeń",
    latlng: [51.10518, 17.08601],
    kind: "start",
    icon: "🏁",
    time: "ok. 12:00",
    note: "Start fursuitwalka, powrót ok. 14:30",
  },
  {
    id: 2,
    name: "Park Szczytnicki",
    latlng: [51.10963, 17.08346],
    kind: "stop",
    icon: "🌳",
    time: "ok. 20 minut",
    note: "Postój na polanie",
  },
  {
    id: 3,
    name: "Fontanna przy Hali Stulecia",
    latlng: [51.10794, 17.07823],
    kind: "stop",
    icon: "📸",
    time: "ok. 20 minut",
    note: "Postój na wspólne zdjęcie",
  },
];

function renderWalkMap() {
  const canvas = document.getElementById("walkMapCanvas");
  const list = document.getElementById("walkList");
  const hint = document.getElementById("walkMapHint");
  if (!canvas || !list) return;

  // lista działa też bez mapy - gdyby Leaflet nie doszedł z CDN-u,
  // zostaje czytelny spis postojów
  list.innerHTML = walkStops
    .map(
      (stop) => `
      <li>
        <button type="button" class="walkmap-chip walkmap-chip--${stop.kind}" data-walk-id="${stop.id}">
          <span class="walkmap-chip-num" aria-hidden="true">${stop.icon}</span>
          <span class="walkmap-chip-body">
            <span class="walkmap-chip-name">${escapeHtml(stop.name)}</span>
            <span class="walkmap-chip-note">${escapeHtml(stop.note)}</span>
            <span class="walkmap-chip-time">${escapeHtml(stop.time)}</span>
          </span>
        </button>
      </li>`,
    )
    .join("");

  const chips = new Map();
  list
    .querySelectorAll(".walkmap-chip")
    .forEach((el) => chips.set(Number(el.dataset.walkId), el));

  if (typeof L === "undefined") {
    canvas.hidden = true;
    return;
  }

  // pełne stopnie zoomu i zwykła animacja setView - przy ułamkowym zoomie
  // i flyTo warstwa wektorowa rozjeżdża się z kafelkami w trakcie animacji
  const map = L.map(canvas, {
    scrollWheelZoom: false,
    attributionControl: true,
  });

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      maxZoom: 20,
      className: "walkmap-tiles",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  ).addTo(map);

  // biała obwódka pod spodem odcina trasę od tła mapy, żeby czerwień
  // czytała się też nad ciemniejszą zielenią parku
  L.polyline(walkRoute, {
    className: "walkmap-route-casing",
    interactive: false,
  }).addTo(map);
  L.polyline(walkRoute, {
    className: "walkmap-route",
    interactive: false,
  }).addTo(map);

  const markers = new Map();
  walkStops.forEach((stop) => {
    const marker = L.marker(stop.latlng, {
      icon: L.divIcon({
        className: "walkmap-marker",
        html: `<span class="walkmap-pin walkmap-pin--${stop.kind}" aria-hidden="true">${stop.icon}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      keyboard: false,
      title: stop.name,
      riseOnHover: true,
    }).addTo(map);
    marker.bindPopup(
      `<strong>${escapeHtml(stop.name)}</strong><br />${escapeHtml(stop.note)} &middot; ${escapeHtml(stop.time)}`,
      {
        className: "walkmap-popup",
        closeButton: false,
        offset: [0, -6],
        // sami centrujemy mapę na przystanku, autoPan tylko by to psuł
        autoPan: false,
      },
    );
    marker.on("click", () => select(stop.id));
    markers.set(stop.id, marker);
  });

  // margines wokół trasy proporcjonalny do mapy - na małym ekranie stała
  // wartość zjadałaby połowę kadru
  const bounds = L.latLngBounds(walkRoute);
  const pad = Math.max(
    10,
    Math.round(Math.min(canvas.clientWidth, canvas.clientHeight) * 0.04),
  );
  map.fitBounds(bounds, { padding: [pad, pad] });
  map.setMinZoom(map.getZoom() - 1);

  let selectedId = null;

  // stan trzyma kółko wewnątrz znacznika - element korzenia należy do Leafleta
  function pinOf(id) {
    const el = markers.get(id).getElement();
    return el && el.querySelector(".walkmap-pin");
  }

  function select(id) {
    selectedId = selectedId === id ? null : id;
    markers.forEach((marker, markerId) => {
      const pin = pinOf(markerId);
      if (pin) pin.classList.toggle("selected", markerId === selectedId);
    });
    chips.forEach((el, chipId) => {
      el.classList.toggle("selected", chipId === selectedId);
      el.setAttribute("aria-pressed", chipId === selectedId ? "true" : "false");
    });
    if (selectedId === null) {
      map.closePopup();
      map.fitBounds(bounds, { padding: [pad, pad] });
      return;
    }
    const marker = markers.get(selectedId);
    map.setView(marker.getLatLng(), 16);
    marker.openPopup();
  }

  function hover(id, on) {
    const pin = pinOf(id);
    if (pin) pin.classList.toggle("hovered", on);
  }

  chips.forEach((el, id) => {
    el.setAttribute("aria-pressed", "false");
    el.addEventListener("click", () => select(id));
    el.addEventListener("mouseenter", () => hover(id, true));
    el.addEventListener("mouseleave", () => hover(id, false));
    el.addEventListener("focus", () => hover(id, true));
    el.addEventListener("blur", () => hover(id, false));
  });

  // na dotyku jeden palec domyślnie przesuwałby mapę zamiast strony,
  // więc przeciąganie włącza się dopiero po pierwszym dotknięciu mapy
  if (L.Browser.mobile) {
    map.dragging.disable();
    if (hint) hint.hidden = false;
    canvas.addEventListener(
      "touchstart",
      () => {
        map.dragging.enable();
        if (hint) hint.hidden = true;
      },
      { once: true, passive: true },
    );
  }
}

// PLAN TERENU
//
// Cały plan leży na siatce: kształty podajemy w komórkach (`col`/`row` to lewy
// górny róg, `w`/`h` to rozmiar), a nie w surowych jednostkach viewBox. Dzięki
// temu ściany sąsiadujących pomieszczeń trafiają na tę samą linię z definicji,
// a nie przez dobieranie ułamków. Połówki komórek pojawiają się tylko tam, gdzie
// coś celuje w środek ściany (znaczniki wejść).
//
// Jedna komórka to VENUE_CELL jednostek viewBox; proporcje planu organizatora
// zostają zachowane, bo skala jest wspólna dla obu osi.
const VENUE_CELL = 2.5;
// wspólne zaokrąglenie narożników - prostokątów stref i obrysów budynków
const VENUE_CORNER = 0.8;

const cells = (count) => count * VENUE_CELL;

// kadr z jednokomórkowym marginesem wokół zabudowy
const venueView = { col: 18, row: 16, w: 58, h: 38 };
const venueViewBox = `${cells(venueView.col)} ${cells(venueView.row)} ${cells(venueView.w)} ${cells(venueView.h)}`;

// Obrysy budynków - rysujemy je tylko jako tło, bez klikania. Krawędzie są
// wspólne ze strefami, które w nich siedzą.
const venueBackdrop = [
  // górna hala z wcięciem na warsztatową i toalety przy północnej ścianie
  {
    cells: [
      [34, 20],
      [59, 20],
      [59, 17],
      [75, 17],
      [75, 34],
      [34, 34],
    ],
  },
  // łącznik między halami: wąskie skrzydło z aneksem ConOps wystającym w lewo,
  // ścięte po skosie tam, gdzie kończy się zabudowa
  {
    cells: [
      [28, 34],
      [55, 34],
      [52, 37],
      [28, 37],
    ],
  },
  // skrzydło przy Klubie Łącznik - zaczyna się dopiero na jego zachodniej
  // ścianie, bo plac przed klubem jest pustym terenem, nie zabudową
  { col: 61, row: 34, w: 14, h: 9 },
  // dolna hala - krawędź od północy schodzi uskokiem w prawo. Skrócona
  // względem planu organizatora: w głębi hali nic się nie dzieje, a pełna
  // długość zabierałaby na planie sporo pustego miejsca.
  {
    cells: [
      [34, 40],
      [52, 40],
      [55, 43],
      [75, 43],
      [75, 53],
      [34, 53],
    ],
  },
];

// kategorie sterują kolorem strefy na planie, kropką przy nazwie na liście
// i legendą - same kolory siedzą w CSS przy [data-venue-cat]
const venueCategories = [
  { id: "dd", label: "Dealers' Den" },
  { id: "program", label: "Program" },
  { id: "zone", label: "Strefy" },
  { id: "tech", label: "Zaplecze" },
];

// kolejność w tablicy to zarazem kolejność rysowania (duże strefy najpierw,
// mniejsze lądują na nich) i kolejność listy obok planu
const venueAreas = [
  {
    id: "teren-przed-hala",
    title: "Teren przed halą",
    description:
      "Otwarta przestrzeń przed halą — tu dzieje się to, co potrzebuje nieba nad głową.",
    label: "Teren\nprzed halą",
    cat: "zone",
    labelSize: 4.2,
    // zachodnią krawędź trzyma wspólnie z Gastro i sceną, wschodnią opiera
    // o ścianę hali, a dół równa z dolną halą
    shapes: [{ col: 19, row: 43, w: 15, h: 10 }],
  },
  {
    id: "gastro",
    title: "Gastro",
    description: "Foodtrucki, kawa i bar.",
    cat: "zone",
    labelSize: 3.2,
    shapes: [{ col: 19, row: 20, w: 8, h: 3 }],
  },
  {
    id: "scena-zewnetrzna",
    title: "Scena zewnętrzna",
    description:
      "Scena pod gołym niebem — po południu warsztaty taneczne, a wieczorem muzyka na świeżym powietrzu.",
    label: "Scena\nzewnętrzna",
    cat: "program",
    labelSize: 3.2,
    shapes: [{ col: 19, row: 31, w: 8, h: 7 }],
  },
  {
    id: "dealers-den",
    title: "Dealers' Den",
    description:
      "Dwa rzędy stoisk twórców i twórczyń z fandomu: printy, naklejki, przypinki, akcesoria do fursuitów i mnóstwo rękodzieła. Wejście do hali prowadzi przejściem między rzędami.",
    label: "Dealers' Den",
    cat: "dd",
    // dwa równe rzędy stoisk (po 3 komórki) i przejście tej samej szerokości
    // między nimi, którym wchodzi się do hali - każdy rząd podpisany osobno
    labelSize: 4.6,
    shapes: [
      { col: 34, row: 20, w: 25, h: 3 },
      { col: 34, row: 28, w: 25, h: 3 },
    ],
    link: { href: "#dealers", label: "Zobacz plan Dealers' Denu" },
  },
  {
    id: "creators-alley",
    title: "Creators' Alley",
    description:
      "Miejsce do zaprezentowania projektów tworzonych przez niezależnych twórców z fandomu.",
    label: "Creators'\nAlley",
    cat: "dd",
    labelSize: 2.6,
    // pas na wysokości przejścia między rzędami Dealers' Denu, ale odsunięty
    // od obu - po komórce odstępu z góry i z dołu
    shapes: [{ col: 61, row: 24, w: 7, h: 3 }],
  },
  {
    id: "przebieralnia",
    title: "Przebieralnia",
    description:
      "Duża przebieralnia z możliwością przechowania swoich rzeczy — wejście z opaską wydawaną fursuiterom.",
    cat: "tech",
    labelSize: 5,
    shapes: [{ col: 34, row: 31, w: 25, h: 3 }],
  },
  {
    id: "klub-lacznik",
    title: "Klub Łącznik",
    description: "Wieczorna scena Wroofa: koncerty i sety didżejskie.",
    label: "Klub\nŁącznik",
    cat: "program",
    labelSize: 4.2,
    shapes: [{ col: 61, row: 34, w: 9, h: 9 }],
  },
  {
    id: "prelekcyjna-1",
    title: "Sala Dąbie",
    description: "Sala prelekcyjno-warsztatowa z ławostołami.",
    label: "Sala\nDąbie",
    cat: "program",
    labelSize: 2.8,
    shapes: [{ col: 70, row: 30, w: 5, h: 4 }],
  },
  {
    id: "prelekcyjna-2",
    title: "Sala Sępolno",
    description: "Sala prelekcyjna.",
    label: "Sala\nSępolno",
    cat: "program",
    labelSize: 2.8,
    shapes: [{ col: 70, row: 20, w: 5, h: 4 }],
  },
  {
    id: "warsztatowa",
    title: "Sala Nadodrze",
    description: "Sala warsztatowa.",
    label: "Sala\nNadodrze",
    cat: "program",
    labelSize: 2.6,
    shapes: [{ col: 59, row: 17, w: 7, h: 3 }],
  },
  {
    id: "conops",
    title: "ConOps",
    description:
      "Serce organizacji. Tu pytasz o wszystko, czego nie ma w programie i zgłaszasz zgubione rzeczym, a spóźnialscy odbierają identyfikatory.",
    cat: "tech",
    labelSize: 2.6,
    shapes: [{ col: 28, row: 34, w: 6, h: 3 }],
  },
  {
    id: "strefa-gier",
    title: "Strefa gier",
    description:
      "Kącik gier ruchowo-rytmicznych! Czekają na was Dance Evolution, ParaParaParadise, Dance Central, Just Dance, Sound Voltex, CHUNITHM i potencjalnie jeszcze więcej",
    label: "Strefa\ngier",
    cat: "zone",
    hosts: ["Krypto", "Yami", "Norx"],
    opens: "15:00",
    labelSize: 2.8,
    shapes: [{ col: 61, row: 30, w: 5, h: 4 }],
  },
  {
    id: "strefa-chill",
    title: "Strefa chill",
    description:
      "Miejsce na odpoczynek przy herbacie serwowanej przez Czajhauz.",
    label: "Strefa\nchill",
    cat: "zone",
    hosts: ["Czajhauz"],
    labelSize: 2.8,
    // między salami prelekcyjnymi, w tym samym słupku przy wschodniej ścianie
    shapes: [{ col: 70, row: 25, w: 5, h: 4 }],
  },
  {
    id: "toalety",
    title: "Toalety",
    description:
      "Toalety są w dwóch miejscach: przy północnej ścianie górnej hali i w hali dolnej.",
    label: "WC",
    cat: "tech",
    labelSize: 3.4,
    // oba węzły tej samej szerokości
    shapes: [
      { col: 66, row: 17, w: 9, h: 3 },
      { col: 42, row: 40, w: 9, h: 3 },
    ],
  },
];

// kształt z siatki na jednostki viewBox - prostokąt opisuje `col/row/w/h`,
// obrys budynku lista wierzchołków w `cells`
function venueShapeBox(shape) {
  if (shape.cells) {
    const cols = shape.cells.map(([col]) => col);
    const rows = shape.cells.map(([, row]) => row);
    const col = Math.min(...cols);
    const row = Math.min(...rows);
    return {
      x: cells(col),
      y: cells(row),
      w: cells(Math.max(...cols) - col),
      h: cells(Math.max(...rows) - row),
    };
  }
  return {
    x: cells(shape.col),
    y: cells(shape.row),
    w: cells(shape.w),
    h: cells(shape.h),
  };
}

function venueShapeCenter(shape) {
  const box = venueShapeBox(shape);
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

// obrys z zaokrąglonymi narożnikami - narożnik ścinamy o promień wzdłuż obu
// krawędzi i domykamy krzywą, więc działa tak samo dla narożników wypukłych
// i wklęsłych (uskoki hal)
function roundedPolygonPath(points, radius) {
  const count = points.length;
  const segments = points.map(([x, y], i) => {
    const [prevX, prevY] = points[(i - 1 + count) % count];
    const [nextX, nextY] = points[(i + 1) % count];
    const inLength = Math.hypot(x - prevX, y - prevY);
    const outLength = Math.hypot(nextX - x, nextY - y);
    const rIn = Math.min(radius, inLength / 2);
    const rOut = Math.min(radius, outLength / 2);
    const fromX = x + ((prevX - x) / inLength) * rIn;
    const fromY = y + ((prevY - y) / inLength) * rIn;
    const toX = x + ((nextX - x) / outLength) * rOut;
    const toY = y + ((nextY - y) / outLength) * rOut;
    return `${i === 0 ? "M" : "L"}${fromX} ${fromY} Q${x} ${y} ${toX} ${toY}`;
  });
  return `${segments.join(" ")} Z`;
}

function venueShapeSvg(shape, className) {
  if (shape.cells) {
    const points = shape.cells.map(([col, row]) => [cells(col), cells(row)]);
    return `<path class="${className}" d="${roundedPolygonPath(points, VENUE_CORNER)}" />`;
  }
  const box = venueShapeBox(shape);
  const c = venueShapeCenter(shape);
  const rot = shape.rot
    ? ` transform="rotate(${shape.rot} ${c.x} ${c.y})"`
    : "";
  return `<rect class="${className}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${VENUE_CORNER}"${rot} />`;
}

// etykieta rysowana osobno dla każdego kształtu strefy (toalety mają dwa węzły,
// Dealers' Den dwa rzędy stoisk) i obracana razem z nim
function venueLabelSvg(area, shape) {
  const at = venueShapeCenter(shape);
  const size = shape.labelSize || area.labelSize || 3;
  const rot = (shape.rot || 0) + (area.labelRot || 0);
  const lines = (area.label || area.title).split("\n");
  const step = size * 1.05;
  const transform = rot ? ` transform="rotate(${rot} ${at.x} ${at.y})"` : "";
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${at.x}" dy="${i === 0 ? -((lines.length - 1) * step) / 2 : step}">${escapeHtml(line)}</tspan>`,
    )
    .join("");
  return `<text class="venuemap-area-label" x="${at.x}" y="${at.y}" font-size="${size}"${transform}>${tspans}</text>`;
}

// Wejścia - ten sam znacznik co pod planem Dealers' Denu: zielony trójkąt
// stojący tuż przy ścianie, którą się wchodzi. Punkt wskazuje miejsce w ścianie
// (połówki komórek to jej środek), a `rot` obraca strzałkę wokół niego:
// 0 celuje w prawo, -90 w górę, 90 w dół.
const venueEntrances = [
  // z zewnątrz: przejściem między rzędami Dealers' Denu i do przebieralni
  { col: 34, row: 25.5 },
  { col: 34, row: 32.5 },
  // na styku warsztatowej i toalet przy północnej ścianie - wejście do obu
  { col: 66, row: 20, rot: -90 },
  // toalety w dolnej hali
  { col: 46.5, row: 40, rot: 90 },
  // sale prelekcyjne - do obu wchodzi się od strony hali
  { col: 70, row: 22 },
  { col: 70, row: 32 },
  // Klub Łącznik
  { col: 61, row: 38.5 },
];

function venueEntranceSvg(entrance) {
  const size = cells(1.4);
  const gap = cells(0.3);
  const x = cells(entrance.col);
  const y = cells(entrance.row);
  const tipX = x - gap;
  const backX = tipX - size * 0.9;
  const rot = entrance.rot
    ? ` transform="rotate(${entrance.rot} ${x} ${y})"`
    : "";
  return `<path class="venuemap-entrance" d="M${tipX} ${y} L${backX} ${y - size / 2} L${backX} ${y + size / 2} Z"${rot} />`;
}

// punkty programu odbywające się w danej strefie - wiązanie idzie przez
// programLocations, więc program pozostaje jedynym źródłem godzin i tytułów
function venueProgramEvents(areaId) {
  const key = Object.keys(programLocations).find(
    (name) => programLocations[name].venue === areaId,
  );
  if (!key) return [];
  return programEvents
    .filter((event) => event.location === key)
    .sort((a, b) => a.start - b.start);
}

function renderVenueMap(areas) {
  const svg = document.getElementById("venueMapSvg");
  const detail = document.getElementById("venueDetail");
  const tooltip = document.getElementById("venueTooltip");
  const legend = document.getElementById("venueLegend");
  if (!svg || !detail) return;

  svg.setAttribute("viewBox", venueViewBox);

  const intro = `
    <div class="venuemap-intro">
      <p>Cały Wroof mieści się w jednym miejscu &ndash; od terenu przed halą
      i sceny zewnętrznej, aż po halę z Dealers&rsquo; Denem i Klubem Łącznik.</p>
      <p class="venuemap-intro-hint">Wybierz strefę na planie, aby dowiedzieć się, co się w niej dzieje</p>
    </div>`;

  const backdrop = venueBackdrop
    .map((shape) => venueShapeSvg(shape, "venuemap-backdrop-shape"))
    .join("");

  svg.innerHTML = `
    <g class="venuemap-backdrop">${backdrop}</g>
    <g class="venuemap-entrances" aria-hidden="true">
      ${venueEntrances.map(venueEntranceSvg).join("")}
    </g>
    ${areas
      .map(
        (area) => `
      <g class="venuemap-area" data-venue-id="${area.id}" data-venue-cat="${area.cat}"
         tabindex="0" role="button" aria-label="${escapeHtml(area.title)}">
        ${area.shapes.map((shape) => venueShapeSvg(shape, "venuemap-area-shape")).join("")}
        ${area.shapes.map((shape) => venueLabelSvg(area, shape)).join("")}
      </g>`,
      )
      .join("")}
  `;

  if (legend) {
    legend.innerHTML =
      venueCategories
        .map(
          (cat) => `
        <li class="venuemap-legend-item" data-venue-cat="${cat.id}">
          <span class="venuemap-legend-swatch" aria-hidden="true"></span>
          ${escapeHtml(cat.label)}
        </li>`,
        )
        .join("") +
      `
        <li class="venuemap-legend-item">
          <svg class="venuemap-legend-arrow" viewBox="0 0 12 12" aria-hidden="true">
            <path class="venuemap-entrance" d="M11 6 L2 1 L2 11 Z" />
          </svg>
          Wejścia
        </li>`;
  }

  const zones = new Map();
  svg
    .querySelectorAll(".venuemap-area")
    .forEach((el) => zones.set(el.dataset.venueId, el));

  let selectedId = null;
  const drawOrder = areas.map((area) => zones.get(area.id));
  const canHover = window.matchMedia("(hover: hover)").matches;

  function showDetail(area) {
    detail.scrollTop = 0;
    detail.classList.toggle("is-intro", !area);
    if (!area) {
      detail.innerHTML = intro;
      applyPolishTypography(detail);
      return;
    }
    // program strefy pokazuje sekcja z rozkładem, a nie opis - stąd zamiast
    // listy godzin jest odnośnik, który podświetla kolumnę tej sali
    const links = [
      ...(area.link ? [area.link] : []),
      ...(venueProgramEvents(area.id).length
        ? [
            {
              href: "#program",
              label: "Zobacz program tej strefy",
              venue: area.id,
            },
          ]
        : []),
    ];
    // opcjonalna linijka pod tytułem: kto prowadzi strefę i od której działa
    const meta = [
      ...(area.hosts && area.hosts.length
        ? [
            `${area.hosts.length > 1 ? "Prowadzą" : "Prowadzi"}: ${escapeHtml(
              area.hosts.length > 1
                ? `${area.hosts.slice(0, -1).join(", ")} i ${area.hosts[area.hosts.length - 1]}`
                : area.hosts[0],
            )}`,
          ]
        : []),
      ...(area.opens ? [`Otwarcie o ${escapeHtml(area.opens)}`] : []),
    ];
    detail.innerHTML = `
      <h3>${escapeHtml(area.title)}</h3>
      ${
        meta.length
          ? `<p class="venuemap-detail-meta">${meta
              .map((item) => `<span>${item}</span>`)
              .join("")}</p>`
          : ""
      }
      ${
        area.description
          ? `<p>${escapeHtml(area.description)}</p>`
          : `<p class="venuemap-detail-empty">Opis tej strefy pojawi się już niedługo!</p>`
      }
      ${
        links.length
          ? `<div class="venuemap-detail-links">
              ${links
                .map(
                  (link) =>
                    `<a class="venuemap-detail-link" href="${escapeHtml(link.href)}"${link.venue ? ` data-program-venue="${link.venue}"` : ""}>${escapeHtml(link.label)}</a>`,
                )
                .join("")}
            </div>`
          : ""
      }
    `;
    applyPolishTypography(detail);

    detail.querySelectorAll("[data-program-venue]").forEach((el) =>
      el.addEventListener("click", () => {
        if (focusProgramColumn) focusProgramColumn(el.dataset.programVenue);
      }),
    );
  }

  function select(id) {
    selectedId = selectedId === id ? null : id;
    areas.forEach((area) => {
      const isSelected = area.id === selectedId;
      zones.get(area.id).classList.toggle("selected", isSelected);
      zones.get(area.id).setAttribute("aria-pressed", String(isSelected));
    });
    // SVG nie zna z-index, więc wybraną strefę przenosimy na koniec - wcześniej
    // przywracamy pierwotną kolejność, żeby po odznaczeniu duża strefa nie
    // została nad mniejszymi, które na niej leżą
    drawOrder.forEach((el) => svg.appendChild(el));
    if (selectedId) svg.appendChild(zones.get(selectedId));
    showDetail(areas.find((area) => area.id === selectedId));
  }

  // wejście z innych sekcji (nagłówki kolumn programu) tylko ustawia
  // zaznaczenie - w odróżnieniu od kliknięcia w plan nigdy go nie zdejmuje
  selectVenueArea = (id) => {
    if (zones.has(id) && selectedId !== id) select(id);
  };

  // dymek jest pozycjonowany względem całej karty planu (a nie przewijanej
  // zawartości), więc trzymamy go w jej granicach - inaczej wystawałby poza
  // stronę i dokładał jej przewijanie w poziomie
  function moveTooltip(event) {
    const box = tooltip.parentElement.getBoundingClientRect();
    const half = tooltip.offsetWidth / 2;
    const x = event.clientX - box.left;
    tooltip.style.left = `${Math.min(Math.max(x, half), box.width - half)}px`;
    tooltip.style.top = `${event.clientY - box.top}px`;
  }

  zones.forEach((el, id) => {
    const area = areas.find((a) => a.id === id);
    // klik w strefę tylko ją zaznacza - nawet Dealers' Den, który w opisie ma
    // odnośnik do własnej sekcji; przeskok w inne miejsce strony to decyzja
    // osoby czytającej, a nie skutek uboczny wybrania strefy na planie
    el.addEventListener("click", () => select(id));
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select(id);
      }
    });
    el.setAttribute("aria-pressed", "false");
    el.addEventListener("mouseenter", (event) => {
      if (!tooltip || !canHover) return;
      tooltip.textContent = area.title;
      tooltip.hidden = false;
      moveTooltip(event);
    });
    el.addEventListener("mousemove", (event) => {
      if (tooltip && !tooltip.hidden) moveTooltip(event);
    });
    el.addEventListener("mouseleave", () => {
      if (tooltip) tooltip.hidden = true;
    });
  });

  // kliknięcie poza strefą (tło planu, obrys budynku) zdejmuje zaznaczenie
  svg.addEventListener("click", (event) => {
    if (selectedId && !event.target.closest(".venuemap-area")) {
      select(selectedId);
    }
  });

  showDetail(null);
}

const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 50);
});

const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("navLinks");

hamburger.addEventListener("click", () => {
  hamburger.classList.toggle("active");
  navLinks.classList.toggle("open");
});

navLinks.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    hamburger.classList.remove("active");
    navLinks.classList.remove("open");
  });
});

document.querySelectorAll(".faq-item").forEach((item) => {
  item.querySelector(".faq-question").addEventListener("click", () => {
    const wasActive = item.classList.contains("active");
    document
      .querySelectorAll(".faq-item")
      .forEach((i) => i.classList.remove("active"));
    if (!wasActive) item.classList.add("active");
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },
  { threshold: 0.1 },
);

document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));

renderProgramSpecials(programSpecials);
renderProgram(programEvents);
renderVenueMap(venueAreas);
renderDealerDen(dealersList);

[
  document.getElementById("programGrid"),
  document.querySelector(".venuemap-plan-scroll"),
].forEach((el) => el && enableDragScroll(el));

// mapa dociąga kafelki dopiero, gdy sekcja zbliża się do ekranu
const walkSection = document.getElementById("walk");
if (walkSection) {
  const walkObserver = new IntersectionObserver(
    (entries, obs) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      obs.disconnect();
      renderWalkMap();
    },
    { rootMargin: "300px" },
  );
  walkObserver.observe(walkSection);
}
applyPolishTypography();

const carousel = document.querySelector(".carousel");
if (carousel) {
  const track = carousel.querySelector(".carousel-track");
  const slides = track.querySelectorAll("img");
  const prevBtn = carousel.querySelector(".carousel-prev");
  const nextBtn = carousel.querySelector(".carousel-next");
  const dotsContainer = carousel.querySelector(".carousel-dots");
  let current = 0;

  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.classList.add("carousel-dot");
    if (i === 0) dot.classList.add("active");
    dot.addEventListener("click", () => goTo(i));
    dotsContainer.appendChild(dot);
  });

  const dots = dotsContainer.querySelectorAll(".carousel-dot");

  function goTo(index) {
    current = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("active", i === current));
  }

  let autoInterval = setInterval(() => goTo(current + 1), 5000);
  let pauseTimeout;

  function pauseAuto() {
    clearInterval(autoInterval);
    clearTimeout(pauseTimeout);
    pauseTimeout = setTimeout(() => {
      autoInterval = setInterval(() => goTo(current + 1), 5000);
    }, 5000);
  }

  prevBtn.addEventListener("click", () => {
    goTo(current - 1);
    pauseAuto();
  });
  nextBtn.addEventListener("click", () => {
    goTo(current + 1);
    pauseAuto();
  });
  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      goTo(i);
      pauseAuto();
    });
  });
}

const BADGE_TEXTURES = {
  sponsor: {
    suiter: {
      fg: "/badge/suiter-sponsor-fg.png",
      bg: "/badge/suiter-sponsor-bg.png",
    },
    attendee: {
      fg: "/badge/attendee-sponsor-fg.png",
      bg: "/badge/attendee-sponsor-bg.png",
    },
    // helper badges are sponsor-only
    helper: {
      fg: "/badge/helper-fg.png",
      bg: "/badge/helper-bg.png",
    },
  },
  standard: {
    suiter: "/badge/suiter.png",
    attendee: "/badge/attendee.png",
  },
};

const badgeTextureLoader = new THREE.TextureLoader();
const badgeTextureCache = new Map();
const badgeTextureWaiters = new Map();

function configureBadgeTexture(texture) {
  // r128 uses encoding; keep the print colors in display space
  if ("encoding" in texture && THREE.sRGBEncoding !== undefined) {
    texture.encoding = THREE.sRGBEncoding;
  }
  texture.anisotropy = 4;
  texture.needsUpdate = true;
}

function loadBadgeTexture(url) {
  if (!badgeTextureCache.has(url)) {
    const waiters = new Set();
    badgeTextureWaiters.set(url, waiters);
    const texture = badgeTextureLoader.load(
      url,
      (loaded) => {
        configureBadgeTexture(loaded);
        waiters.forEach((fn) => fn(loaded));
        waiters.clear();
      },
      undefined,
      () => {
        console.error(`Failed to load badge texture: ${url}`);
        waiters.clear();
      },
    );
    configureBadgeTexture(texture);
    badgeTextureCache.set(url, texture);
  }
  return badgeTextureCache.get(url);
}

function bindBadgeTexture(material, url) {
  const texture = loadBadgeTexture(url);
  material.map = texture;
  material.needsUpdate = true;
  if (texture.image && texture.image.width) return texture;

  const waiters = badgeTextureWaiters.get(url);
  if (waiters) {
    waiters.add(() => {
      material.map = texture;
      material.needsUpdate = true;
    });
  }
  return texture;
}

function createRoundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 + radius, -height / 2);
  shape.lineTo(width / 2 - radius, -height / 2);
  shape.quadraticCurveTo(
    width / 2,
    -height / 2,
    width / 2,
    -height / 2 + radius,
  );
  shape.lineTo(width / 2, height / 2 - radius);
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
  shape.lineTo(-width / 2 + radius, height / 2);
  shape.quadraticCurveTo(
    -width / 2,
    height / 2,
    -width / 2,
    height / 2 - radius,
  );
  shape.lineTo(-width / 2, -height / 2 + radius);
  shape.quadraticCurveTo(
    -width / 2,
    -height / 2,
    -width / 2 + radius,
    -height / 2,
  );
  return shape;
}

// Builds both badge variants up front and flips between them with a 180°
// reveal spin - geometry and textures swap while the badge is edge-on.
function initBadgePreview(containerId, initialKind, initialType) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`Badge container #${containerId} not found`);
    return;
  }

  let width = container.clientWidth || 1;
  let height = container.clientHeight || 500;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 12);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  if (THREE.sRGBEncoding !== undefined) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 1);
  dirLight1.position.set(5, 5, 10);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight2.position.set(-5, -5, -10);
  scene.add(dirLight2);

  const badgeWidth = 5.2;
  const badgeHeight = 8;
  const badgeRadius = 0.5;

  function buildBadge(kind) {
    const badgeDepth = kind === "sponsor" ? 0.3 : 0.08;
    const badgeBevel = kind === "sponsor" ? 0.05 : 0.02;

    const group = new THREE.Group();

    const shape = createRoundedRectShape(badgeWidth, badgeHeight, badgeRadius);
    const extrudeSettings = {
      depth: badgeDepth,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: badgeBevel,
      bevelThickness: badgeBevel,
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    // r128 MeshPhysicalMaterial supports transmission but not thickness;
    // keep the acrylic look without unsupported props that Three warns about.
    const slabMaterial =
      kind === "sponsor"
        ? new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.05,
            transmission: 0.9,
            transparent: true,
            opacity: 1,
            depthWrite: true,
          })
        : new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0,
            roughness: 0.45,
          });
    const slabMesh = new THREE.Mesh(geometry, slabMaterial);
    slabMesh.renderOrder = 1;
    group.add(slabMesh);

    const printWidth = badgeWidth;
    const printHeight = badgeHeight;
    const printGeometry = new THREE.ShapeGeometry(
      createRoundedRectShape(printWidth, printHeight, badgeRadius),
    );
    // ShapeGeometry uses raw coordinates as UVs, remap to 0..1
    const printPositions = printGeometry.attributes.position;
    const printUVs = printGeometry.attributes.uv;
    for (let i = 0; i < printUVs.count; i++) {
      printUVs.setXY(
        i,
        printPositions.getX(i) / printWidth + 0.5,
        printPositions.getY(i) / printHeight + 0.5,
      );
    }
    printUVs.needsUpdate = true;

    // the bevel pushes the slab face out by bevelThickness on each side
    const printZ = badgeDepth / 2 + badgeBevel + 0.005;

    // alphaTest avoids transparent-sort fights with the acrylic slab so the
    // artwork stays visible at every orbit angle
    const printMaterials = [];

    if (kind === "sponsor") {
      const bgMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.05,
        depthWrite: true,
        side: THREE.DoubleSide,
      });
      const bgMesh = new THREE.Mesh(printGeometry, bgMaterial);
      bgMesh.position.z = -printZ;
      bgMesh.renderOrder = 0;
      group.add(bgMesh);

      const fgMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.05,
        depthWrite: true,
        side: THREE.DoubleSide,
      });
      const fgMesh = new THREE.Mesh(printGeometry, fgMaterial);
      fgMesh.position.z = printZ;
      fgMesh.renderOrder = 2;
      group.add(fgMesh);

      printMaterials.push(bgMaterial, fgMaterial);
    } else {
      const printMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.05,
        depthWrite: true,
      });

      const frontMesh = new THREE.Mesh(printGeometry, printMaterial);
      frontMesh.position.z = printZ;
      frontMesh.renderOrder = 2;
      group.add(frontMesh);

      const backMesh = new THREE.Mesh(printGeometry, printMaterial);
      backMesh.position.z = -printZ;
      backMesh.rotation.y = Math.PI;
      backMesh.renderOrder = 2;
      group.add(backMesh);

      printMaterials.push(printMaterial);
    }

    function applyType(type) {
      const textures = BADGE_TEXTURES[kind][type];
      if (!textures) return;
      if (kind === "sponsor") {
        const [bgMaterial, fgMaterial] = printMaterials;
        bindBadgeTexture(bgMaterial, textures.bg);
        bindBadgeTexture(fgMaterial, textures.fg);
      } else {
        bindBadgeTexture(printMaterials[0], textures);
      }
    }

    return { group, applyType, totalDepth: badgeDepth + badgeBevel * 2 };
  }

  const builds = {
    sponsor: buildBadge("sponsor"),
    standard: buildBadge("standard"),
  };

  Object.values(BADGE_TEXTURES).forEach((types) => {
    Object.values(types).forEach((entry) => {
      if (typeof entry === "string") loadBadgeTexture(entry);
      else Object.values(entry).forEach(loadBadgeTexture);
    });
  });

  let currentKind = initialKind;
  let currentType = initialType;
  let flipY = 0; // accumulated 180° flips
  let activeBuild = builds[currentKind];
  scene.add(activeBuild.group);
  activeBuild.applyType(currentType);

  function activateBuild(kind) {
    const build = builds[kind];
    if (build !== activeBuild) {
      scene.remove(activeBuild.group);
      scene.add(build.group);
      activeBuild = build;
    }
    build.group.rotation.y = flipY;
    build.group.scale.z = 1;
    return build;
  }

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enableZoom = false;
  controls.enablePan = false;

  const cameraDistance = camera.position.length();
  const HOME_POLAR = Math.PI / 2 - 0.18;
  let homeAzimuth = 0;
  const AUTO_SPEED = 0.15;
  const RETURN_SMOOTHING = 3;
  const AUTO_RESUME_MS = 4000;

  const spherical = new THREE.Spherical(
    cameraDistance,
    HOME_POLAR,
    homeAzimuth,
  );

  function placeCamera() {
    camera.position.setFromSpherical(spherical);
    camera.lookAt(controls.target);
  }
  placeCamera();

  // don't start spinning until the badge is actually on screen
  let seen = false;
  if (window.IntersectionObserver) {
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          seen = true;
          visibilityObserver.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    visibilityObserver.observe(container);
  } else {
    seen = true;
  }

  // auto = idle spin, manual = user dragging, return = easing home,
  // reveal = the flip animation
  let state = "auto";
  let azimuth = homeAzimuth;
  let resumeTimeout;
  let reveal = null;

  controls.addEventListener("start", () => {
    state = "manual";
    clearTimeout(resumeTimeout);
  });
  controls.addEventListener("end", () => {
    clearTimeout(resumeTimeout);
    resumeTimeout = setTimeout(() => {
      state = "return";
    }, AUTO_RESUME_MS);
  });

  function resetView() {
    clearTimeout(resumeTimeout);
    state = "return";
  }

  const REVEAL_DURATION_MS = 500;
  function select(kind, type) {
    if (state === "reveal") return false;
    if (kind === currentKind && type === currentType) return false;
    currentKind = kind;
    currentType = type;
    const hasTextures = Boolean(BADGE_TEXTURES[kind][type]);
    const hidden = container.style.display === "none";
    if (!hasTextures || hidden) {
      container.style.display = hasTextures ? "" : "none";
      if (hasTextures) activateBuild(kind).applyType(type);
      resetView();
      return true;
    }
    clearTimeout(resumeTimeout);
    controls.enabled = false;
    spherical.setFromVector3(camera.position.clone().sub(controls.target));
    const startTheta = spherical.theta;

    let swapAfter = THREE.MathUtils.euclideanModulo(
      Math.PI / 2 - startTheta,
      Math.PI,
    );
    if (swapAfter < 0.05) swapAfter += Math.PI;
    let deltaTheta =
      Math.PI +
      THREE.MathUtils.euclideanModulo(
        homeAzimuth - startTheta + Math.PI,
        Math.PI * 2,
      ) -
      Math.PI;
    let flip = true;
    if (deltaTheta < swapAfter + 0.1) {
      deltaTheta += Math.PI;
      flip = false;
    }
    reveal = {
      startTime: performance.now(),
      startTheta,
      startPhi: spherical.phi,
      deltaTheta,
      swapTheta: startTheta + swapAfter,
      swapped: false,
      flip,
      kind,
      type,
    };
    state = "reveal";
    return true;
  }

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    if (state === "auto") {
      if (seen) azimuth += AUTO_SPEED * dt;
      spherical.set(cameraDistance, HOME_POLAR, azimuth);
      placeCamera();
    } else if (state === "reveal") {
      const t = Math.min(
        (performance.now() - reveal.startTime) / REVEAL_DURATION_MS,
        1,
      );
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const theta = reveal.startTheta + reveal.deltaTheta * eased;
      if (!reveal.swapped && theta >= reveal.swapTheta) {
        const previousDepth = activeBuild.totalDepth;
        if (reveal.flip) {
          flipY = THREE.MathUtils.euclideanModulo(flipY + Math.PI, Math.PI * 2);
          homeAzimuth = THREE.MathUtils.euclideanModulo(
            homeAzimuth + Math.PI,
            Math.PI * 2,
          );
        }
        const build = activateBuild(reveal.kind);
        build.applyType(reveal.type);
        if (build.totalDepth !== previousDepth) {
          reveal.morphFromScaleZ = previousDepth / build.totalDepth;
          reveal.easedAtSwap = eased;
          build.group.scale.z = reveal.morphFromScaleZ;
        }
        reveal.swapped = true;
      }
      if (reveal.swapped && reveal.morphFromScaleZ) {
        const morphT = Math.min(
          (eased - reveal.easedAtSwap) / (1 - reveal.easedAtSwap),
          1,
        );
        activeBuild.group.scale.z =
          reveal.morphFromScaleZ + (1 - reveal.morphFromScaleZ) * morphT;
      }
      spherical.set(
        cameraDistance,
        reveal.startPhi + (HOME_POLAR - reveal.startPhi) * eased,
        theta,
      );
      placeCamera();
      if (t >= 1) {
        activeBuild.group.scale.z = 1;
        controls.enabled = true;
        reveal = null;
        azimuth = homeAzimuth;
        state = "auto";
      }
    } else if (state === "return") {
      spherical.setFromVector3(camera.position.clone().sub(controls.target));
      const azimuthDelta =
        THREE.MathUtils.euclideanModulo(
          homeAzimuth - spherical.theta + Math.PI,
          Math.PI * 2,
        ) - Math.PI;
      const polarDelta = HOME_POLAR - spherical.phi;
      if (Math.abs(azimuthDelta) < 0.01 && Math.abs(polarDelta) < 0.01) {
        azimuth = homeAzimuth;
        state = "auto";
      } else {
        const k = 1 - Math.exp(-RETURN_SMOOTHING * dt);
        spherical.radius = cameraDistance;
        spherical.theta += azimuthDelta * k;
        spherical.phi += polarDelta * k;
        placeCamera();
      }
    } else {
      controls.update();
    }

    renderer.render(scene, camera);
  }
  animate();

  const handleResize = () => {
    width = container.clientWidth;
    height = container.clientHeight;
    if (!width || !height) return;

    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
  } else {
    window.addEventListener("resize", handleResize);
  }

  return { select };
}

document.addEventListener("DOMContentLoaded", () => {
  const preview = initBadgePreview("badge-preview", "sponsor", "attendee");
  if (!preview) return;

  let currentKind = "sponsor";
  let currentType = "attendee";

  const switchButtons = document.querySelectorAll(".badge-switch-btn");
  const kindCards = document.querySelectorAll(".ticket-card[data-badge-kind]");
  const noteDefault = document.getElementById("badge-note-default");
  const noteHelper = document.getElementById("badge-note-helper");
  const ticketsSection = document.getElementById("tickets");
  const bgLayers = document.querySelectorAll(".tickets-bg");

  function scrollToPreview() {
    if (ticketsSection) ticketsSection.scrollIntoView({ behavior: "smooth" });
  }

  function refreshCards() {
    const isHelper = currentType === "helper";
    if (noteDefault) noteDefault.hidden = isHelper;
    if (noteHelper) noteHelper.hidden = !isHelper;
    bgLayers.forEach((bg) => {
      bg.classList.toggle("active", bg.dataset.bgType === currentType);
    });
    kindCards.forEach((card) => {
      const kind = card.dataset.badgeKind;
      const isSelected = kind === currentKind;
      const isAvailable = Boolean(BADGE_TEXTURES[kind][currentType]);
      card.classList.toggle("featured", isSelected);
      card.classList.toggle("kind-unavailable", !isAvailable);
      card.setAttribute("aria-pressed", String(isSelected));
      card.setAttribute("aria-disabled", String(!isAvailable));
    });
  }
  refreshCards();

  switchButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.badgeType;
      if (type === currentType) return;
      const kind = BADGE_TEXTURES[currentKind][type] ? currentKind : "sponsor";
      if (!preview.select(kind, type)) return;
      currentType = type;
      currentKind = kind;
      scrollToPreview();
      switchButtons.forEach((other) => {
        const isActive = other === button;
        other.classList.toggle("active", isActive);
        other.setAttribute("aria-pressed", String(isActive));
      });
      refreshCards();
    });
  });

  function selectKind(card) {
    const kind = card.dataset.badgeKind;
    if (kind === currentKind) return;
    if (!BADGE_TEXTURES[kind][currentType]) return;
    if (!preview.select(kind, currentType)) return;
    currentKind = kind;
    refreshCards();
    scrollToPreview();
  }
  kindCards.forEach((card) => {
    card.addEventListener("click", () => selectKind(card));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectKind(card);
      }
    });
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const TICKET_SALE_START = new Date("2026-07-12T19:00:00+02:00");

  const ticketButtons = document.querySelectorAll(
    ".ticket-card .btn[data-stage]",
  );
  if (!ticketButtons.length) return;

  function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    const time = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    return days > 0 ? `${days}d ${time}` : time;
  }

  ticketButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      if (new Date() < TICKET_SALE_START) event.preventDefault();
    });
  });

  let intervalId = null;

  function tick() {
    const msRemaining = TICKET_SALE_START - new Date();
    const isActive = msRemaining <= 0;
    ticketButtons.forEach((button) => {
      button.textContent = isActive ? "Wybieram" : formatCountdown(msRemaining);
      button.classList.toggle("btn-disabled", !isActive);
      button.setAttribute("aria-disabled", String(!isActive));
      button.tabIndex = isActive ? 0 : -1;
    });
    if (isActive && intervalId !== null) clearInterval(intervalId);
  }

  tick();
  intervalId = setInterval(tick, 300);
});
