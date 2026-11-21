/* BIG FUN – Catálogo de bebidas.
 * Precios en pesos argentinos, siempre números enteros.
 * No modificar precios sin autorización del organizador. */
(function (root) {
  "use strict";

  var CATEGORIES = [
    { id: "cervezas", name: "Cervezas" },
    { id: "clasicos", name: "Tragos clásicos" },
    { id: "otros", name: "Otros tragos" },
    { id: "premium", name: "Destilados y tragos premium" },
    { id: "espumantes", name: "Espumantes" },
    { id: "sin-alcohol", name: "Bebidas sin alcohol" }
  ];

  var PRODUCTS = [
    { id: "heineken", name: "Heineken", price: 10000, category: "cervezas" },
    { id: "imperial", name: "Imperial", price: 8000, category: "cervezas" },

    { id: "fernet", name: "Fernet Branca", price: 12000, category: "clasicos" },
    { id: "campari", name: "Campari", price: 12000, category: "clasicos" },
    { id: "aperol", name: "Aperol", price: 12000, category: "clasicos" },
    { id: "cinzano", name: "Cinzano", price: 12000, category: "clasicos" },
    { id: "gancia", name: "Gancia", price: 12000, category: "clasicos" },
    { id: "cubalibre", name: "Cuba Libre", price: 12000, category: "clasicos" },
    { id: "whisky", name: "Whisky nacional", price: 12000, category: "clasicos" },

    { id: "jager", name: "Jägermeister", price: 20000, category: "otros" },

    { id: "gintonic", name: "Gin Tonic Nacional", price: 12000, category: "premium" },
    { id: "beefeater", name: "Beefeater", price: 19000, category: "premium" },
    { id: "tanqueray", name: "Tanqueray", price: 21000, category: "premium" },
    { id: "bombay", name: "Bombay", price: 25000, category: "premium" },
    { id: "absolut", name: "Absolut Vodka", price: 17000, category: "premium" },
    { id: "sernova", name: "Sernova", price: 12000, category: "premium" },
    { id: "jwred", name: "Johnnie Walker Red Label", price: 17000, category: "premium" },
    { id: "jwblack", name: "Johnnie Walker Black Label", price: 25000, category: "premium" },

    { id: "chandon", name: "Chandon Extra Brut", price: 55000, category: "espumantes" },
    /* Precio indicado por el organizador: se mantiene tal cual aunque supere el crédito inicial. */
    { id: "baronb", name: "Baron B Extra Brut", price: 850000, category: "espumantes" },

    { id: "agua", name: "Agua", price: 5000, category: "sin-alcohol" },
    { id: "gaseosa", name: "Gaseosa", price: 5000, category: "sin-alcohol" },
    { id: "speed", name: "Speed", price: 6000, category: "sin-alcohol" }
  ];

  /* Productos sin fotografía: la tarjeta muestra el nombre en grande. */
  var NO_PHOTO = ["sernova", "jwred", "jwblack", "chandon", "baronb", "agua", "gaseosa", "speed"];

  PRODUCTS.forEach(function (p) {
    p.image = NO_PHOTO.indexOf(p.id) >= 0 ? null : "img/" + p.id + ".jpg";
  });

  var api = { CATEGORIES: CATEGORIES, PRODUCTS: PRODUCTS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BigFunCatalog = api;
})(typeof self !== "undefined" ? self : this);
