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
  const url = `${window.location.origin}${window.location.pathname}?slug=${encodeURIComponent(item.slug)}`;
  setMetaContent("description", item.seo?.description || item.summary);
  setMetaContent("keywords", item.seo?.keywords || "");
  setCanonicalUrl(url);
  setMetaProperty("og:title", `${item.title} | Ezequiel Brunner`);
  setMetaProperty("og:description", item.seo?.description || item.summary);
  setMetaProperty("og:type", "article");
  setMetaProperty("og:url", url);
  setMetaContent("twitter:title", `${item.title} | Ezequiel Brunner`);
  setMetaContent("twitter:description", item.seo?.description || item.summary);
}

function setMetaProperty(property, content) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) { meta = document.createElement("meta"); meta.setAttribute("property", property); document.head.appendChild(meta); }
  meta.setAttribute("content", content);
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
