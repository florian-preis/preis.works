// Shared by the build scripts and the pages: plain-letter names made from a photo's filename.
// slug: "20260726_Lerici, Liguria, Italy.jpg" -> "20260726-lerici-liguria-italy" (also the photo's address on the Photography page)
export const slug = (file) =>
  file.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
// The fogged image's filename for a photo
export const fogName = (file) => slug(file) + '-fog.webp';
