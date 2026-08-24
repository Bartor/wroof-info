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
  "p, li, dd, dt, blockquote, figcaption, .badge-note, .program-card-body, .program-card-host, .faq-answer, .denmap-intro, .denmap-detail, .about-text, .ticket-card";

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

function renderProgram(events, containerId = "programGrid") {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Sort events by start time
  const sorted = [...events].sort((a, b) => a.start - b.start);

  container.innerHTML = Object.entries(programLocations)
    .map(([key, label]) => {
      const locationEvents = sorted.filter((e) => e.location === key);
      if (!locationEvents.length) return "";
      return `
      <div class="program-column fade-in">
        <div class="program-location">${label}</div>
        ${locationEvents
          .map((event) => {
            const tagStyle = event.highlight
              ? ' style="background: var(--red); color: var(--white)"'
              : "";
            return `
            <div class="program-card" data-expandable>
              <div class="program-card-header">
                <div class="program-card-time">${formatTime(event.start)} - ${formatTime(event.end)} <span class="program-card-tag"${tagStyle}>${event.tag}</span></div>
                <h3>${event.title}</h3>
              </div>
              <div class="program-card-body">
                <p>${event.description}</p>
                ${event.hosts && event.hosts.length ? `<div class="program-card-host">${formatHosts(event.hosts)}</div>` : ""}
              </div>
            </div>`;
          })
          .join("")}
      </div>`;
    })
    .join("");

  container.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));

  container.querySelectorAll("[data-expandable]").forEach((card) => {
    card.addEventListener("click", () => {
      const wasActive = card.classList.contains("active");
      container
        .querySelectorAll("[data-expandable]")
        .forEach((c) => c.classList.remove("active"));
      if (!wasActive) card.classList.add("active");
    });
  });

  applyPolishTypography(container);
}

const programLocations = {
  stage: "Scena główna",
  workshop: "Sala warsztatowa",
  trade: "Dealer's Den",
};

// const exampleEvent = {
//   start: 10,
//   end: 11,
//   title: "Rejestracja",
//   description: "Rejestracja uczestników.",
//   hosts: ["Wroof"],
//   tag: "Organizacyjne",
//   location: "stage",
// };
const programEvents = [];

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

// Plan Dealer's Denu: dwa bloki stoisk (lewy: pasy A/B, prawy: pasy C/D),
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
      <p>W tym roku na Dealer's Denie znajdziecie</p>
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

  function updateScrollFade(el) {
    const scrollable = el.scrollHeight > el.clientHeight + 2;
    const atTop = el.scrollTop <= 2;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    el.classList.toggle("is-clip-top", scrollable && !atTop);
    el.classList.toggle("is-clip-bottom", scrollable && !atEnd);
  }

  function updateFades() {
    updateScrollFade(detail);
    updateScrollFade(list);
  }

  function showDetail(dealer) {
    detail.scrollTop = 0;
    detail.classList.toggle("is-intro", !dealer);
    if (!dealer) {
      // wstęp zawsze mieści się w panelu, więc nie ma czego wygaszać
      detail.classList.remove("is-clip-top", "is-clip-bottom");
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
    updateScrollFade(detail);
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
    updateScrollFade(list);
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
    updateScrollFade(list);
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

  detail.addEventListener("scroll", () => updateScrollFade(detail));
  list.addEventListener("scroll", () => updateScrollFade(list));
  window.addEventListener("resize", updateFades);

  if (search) {
    search.addEventListener("input", () => {
      query = normalizePl(search.value.trim());
      applyFilter();
    });
  }

  showDetail(null);
  updateScrollFade(list);
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

renderProgram(programEvents);
renderDealerDen(dealersList);

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
