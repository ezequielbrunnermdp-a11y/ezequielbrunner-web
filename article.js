const articleContainer = document.querySelector("#article-content");
const articleParams = new URLSearchParams(window.location.search);
const articleSlug = articleParams.get("slug");
const articleItem = Array.isArray(window.newsItems)
  ? window.newsItems.find((item) => item.slug === articleSlug)
  : null;

if (articleContainer) {
  if (!articleItem) {
    articleContainer.innerHTML = `
      <div class="article-body">
        <p class="card-meta">Artículo no encontrado</p>
        <h1>La nota que buscás no está disponible.</h1>
        <p>Verificá el enlace o regresá a la sección de novedades para abrir un artículo publicado.</p>
      </div>
    `;
  } else {
    document.title = `${articleItem.title} | Ezequiel Brunner`;
    updateArticleSeo(articleItem);

    const imageMarkup = articleItem.image
      ? `<img class="article-image" src="${articleItem.image}" alt="${articleItem.title}">`
      : "";
    const dateMarkup = articleItem.date
      ? `<p class="news-card-date">${articleItem.displayDate || formatArticleDate(articleItem.date)}</p>`
      : "";

    const contentMarkup = articleItem.content
      .map((paragraph) => `<p>${paragraph}</p>`)
      .join("");

    articleContainer.innerHTML = `
      ${imageMarkup}
      <div class="article-body">
        <p class="card-meta">${articleItem.category}</p>
        ${dateMarkup}
        <h1>${articleItem.title}</h1>
        <p class="news-card-author">${articleItem.author || ""}</p>
        <p class="news-card-tagline">${articleItem.tagline || ""}</p>
        <p class="article-summary">${articleItem.summary}</p>
        <div class="article-content">
          ${contentMarkup}
        </div>
      </div>
    `;
  }
}

initializeRevealAnimations();

function formatArticleDate(dateString) {
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

function updateArticleSeo(item) {
  setMetaContent("description", item.seo?.description || item.summary);
  setMetaContent("keywords", item.seo?.keywords || "");
  setCanonicalUrl(`${window.location.origin}${window.location.pathname}?slug=${item.slug}`);
}

function setMetaContent(name, content) {
  if (!content) {
    return;
  }

  let meta = document.querySelector(`meta[name="${name}"]`);

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
}

function setCanonicalUrl(url) {
  let canonical = document.querySelector('link[rel="canonical"]');

  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }

  canonical.setAttribute("href", url);
}

const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");

if (menuButton && nav) {
  menuButton.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuButton.classList.toggle("is-open", isOpen);
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      menuButton.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
}

function initializeRevealAnimations() {
  const revealTargets = [
    ...document.querySelectorAll(".article-back, .article-card, .site-header, .site-footer")
  ];

  revealTargets.forEach((element, index) => {
    element.classList.add("reveal");
    element.style.setProperty("--reveal-delay", `${Math.min(index * 0.06, 0.2)}s`);
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
      threshold: 0.15,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  revealTargets.forEach((element) => observer.observe(element));
}
