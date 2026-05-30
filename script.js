const latestNewsContainer = document.querySelector("#latest-news-list");
const archiveNewsContainer = document.querySelector("#archive-news-list");

if (latestNewsContainer && archiveNewsContainer && Array.isArray(window.newsItems)) {
  const sortedNewsItems = [...window.newsItems].sort((a, b) => {
    const firstDate = new Date(b.date || 0);
    const secondDate = new Date(a.date || 0);
    return firstDate - secondDate;
  });

  const latestNews = sortedNewsItems.slice(0, 3);
  const archiveNews = sortedNewsItems.slice(3);

  latestNewsContainer.innerHTML = latestNews.map(renderNewsCard).join("");
  archiveNewsContainer.innerHTML = archiveNews.length
    ? archiveNews.map(renderNewsCard).join("")
    : `<p class="news-empty">Todavía no hay notas anteriores publicadas.</p>`;
}

initializeRevealAnimations();

function renderNewsCard(item) {
  const imageMarkup = item.image
    ? `<img class="news-card-image" src="${item.image}" alt="${item.title}">`
    : "";
  const dateMarkup = item.date
    ? `<p class="news-card-date">${item.displayDate || formatNewsDate(item.date)}</p>`
    : "";

  return `
    <article class="news-card">
      ${imageMarkup}
      <div class="news-card-body">
        <p class="card-meta">${item.category}</p>
        ${dateMarkup}
        <h3>${item.title}</h3>
        <p class="news-card-author">${item.author || ""}</p>
        <p class="news-card-tagline">${item.tagline || ""}</p>
        <p>${item.summary}</p>
      </div>
      <a href="articulo.html?slug=${item.slug}" class="news-card-link">Leer artículo completo</a>
    </article>
  `;
}

function formatNewsDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    menuToggle.classList.toggle("is-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("is-open");
      menuToggle.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

function initializeRevealAnimations() {
  const revealTargets = [
    ...document.querySelectorAll(
      ".hero-copy, .hero-portrait, .section-heading, .panel, .publication-card, .media-card, .news-card, .contact-panel, .hero-highlights div"
    )
  ];

  revealTargets.forEach((element, index) => {
    element.classList.add("reveal");
    element.style.setProperty("--reveal-delay", `${Math.min(index * 0.05, 0.35)}s`);
  });

  if (!("IntersectionObserver" in window)) {
    revealTargets.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  revealTargets.forEach((element) => observer.observe(element));
}
