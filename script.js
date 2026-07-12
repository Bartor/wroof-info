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

const BADGE_TEXTURES = {
  sponsor: {
    suiter: {
      fg: "./badge/suiter-sponsor-fg.png",
      bg: "./badge/suiter-sponsor-bg.png",
    },
    attendee: {
      fg: "./badge/attendee-sponsor-fg.png",
      bg: "./badge/attendee-sponsor-bg.png",
    },
    // helper badges are sponsor-only
    helper: {
      fg: "./badge/helper-fg.png",
      bg: "./badge/helper-bg.png",
    },
  },
  standard: {
    suiter: "./badge/suiter.png",
    attendee: "./badge/attendee.png",
  },
};

const badgeTextureLoader = new THREE.TextureLoader();
const badgeTextureCache = new Map();
function loadBadgeTexture(url) {
  if (!badgeTextureCache.has(url)) {
    badgeTextureCache.set(
      url,
      badgeTextureLoader.load(url, undefined, undefined, () => {
        console.error(`Failed to load badge texture: ${url}`);
      }),
    );
  }
  return badgeTextureCache.get(url);
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

  let width = container.clientWidth;
  let height = container.clientHeight || 500;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 12);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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

    const slabMaterial =
      kind === "sponsor"
        ? new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.05,
            transmission: 0.9,
            ior: 1.5,
            thickness: badgeDepth,
            transparent: true,
            opacity: 1,
          })
        : new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0,
            roughness: 0.45,
          });
    group.add(new THREE.Mesh(geometry, slabMaterial));

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

    // the bevel pushes the slab face out by bevelThickness on each side
    const printZ = badgeDepth / 2 + badgeBevel + 0.005;

    const printMaterials = [];

    if (kind === "sponsor") {
      const bgMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        side: THREE.DoubleSide,
      });
      const bgMesh = new THREE.Mesh(printGeometry, bgMaterial);
      bgMesh.position.z = -printZ;
      group.add(bgMesh);

      const fgMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const fgMesh = new THREE.Mesh(printGeometry, fgMaterial);
      fgMesh.position.z = printZ;
      group.add(fgMesh);

      printMaterials.push(bgMaterial, fgMaterial);
    } else {
      const printMaterial = new THREE.MeshBasicMaterial({ transparent: true });

      const frontMesh = new THREE.Mesh(printGeometry, printMaterial);
      frontMesh.position.z = printZ;
      group.add(frontMesh);

      const backMesh = new THREE.Mesh(printGeometry, printMaterial);
      backMesh.position.z = -printZ;
      backMesh.rotation.y = Math.PI;
      group.add(backMesh);

      printMaterials.push(printMaterial);
    }

    function applyType(type) {
      const textures = BADGE_TEXTURES[kind][type];
      if (!textures) return;
      if (kind === "sponsor") {
        const [bgMaterial, fgMaterial] = printMaterials;
        bgMaterial.map = loadBadgeTexture(textures.bg);
        fgMaterial.map = loadBadgeTexture(textures.fg);
      } else {
        printMaterials[0].map = loadBadgeTexture(textures);
      }
      printMaterials.forEach((material) => {
        material.needsUpdate = true;
      });
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

    camera.aspect = width / height;
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
    ".ticket-card .btn[data-stage]"
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
