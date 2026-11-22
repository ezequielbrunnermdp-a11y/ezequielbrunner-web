/* ÚNICO PUNTO PARA INCORPORAR EL LOGO OFICIAL
   1. Copiá el archivo en public/brand/ (por ejemplo public/brand/logo-el-condor.svg).
   2. Escribí su nombre en `logo` (sin barra inicial): logo: 'brand/logo-el-condor.svg'.
   3. `logoLarge` es la versión grande para la portada; `logoOnDark`, una variante opcional para fondos oscuros.
   El logo actual es cobre sobre fondo transparente y funciona sobre marfil y sobre espresso.
   El original y el PNG sin fondo están en brand-source/.
   Mientras `logo` sea null, el campus muestra el nombre en texto. */
export const BRAND = {
  name: 'EL CÓNDOR',
  subtitle: 'Campus de formación',
  fullName: 'El Cóndor Coffee Shop',
  logo: 'brand/logo-el-condor-420.webp' as string | null,
  logoLarge: 'brand/logo-el-condor.webp' as string | null,
  logoOnDark: null as string | null,
  logoAlt: 'El Cóndor Coffee Shop',
};
