// Preserve links to sections shared before the profiles were separated.
const legacyHash = window.location.hash;
const gastronomyAnchors = ["#gastronomia", "#trabaja-conmigo"];
const researchAnchors = ["#sobre-mi", "#publicaciones", "#dossier", "#medios", "#novedades", "#contacto"];
if (gastronomyAnchors.includes(legacyHash)) {
  window.location.replace("gastronomia.html" + legacyHash);
} else if (researchAnchors.includes(legacyHash)) {
  window.location.replace("inteligencia-artificial.html" + legacyHash);
}
