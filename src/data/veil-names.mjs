// Shared by the build script and the home page: the fogged image's filename for a photo.
export const fogName = (file) =>
  file.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() + '-fog.webp';
