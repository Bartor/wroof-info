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

function renderDealers(dealers, containerId = "dealersGrid") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const cols = [[], [], []];
  dealers.forEach((ex, i) => cols[i % 3].push(ex));

  container.innerHTML = cols
    .map(
      (col) => `
      <div class="program-column fade-in">
        ${col
          .map(
            (ex) => `
            <div class="program-card" data-expandable>
              <div class="program-card-header">
                <h3>${ex.title}</h3>
              </div>
              <div class="program-card-body">
                <p>${ex.description}</p>
              </div>
            </div>`,
          )
          .join("")}
      </div>`,
    )
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
}

// const exampleDealer = {
//   title: "FluffyFluff Fluffies",
//   description: "Przedmioty i takie tam.",
// };
const dealersList = [];

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
renderDealers(dealersList);

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
