// v31: site images - the pure model (shared by the admin panel, the server and the tests).
// The admin adds image LINKS (no upload) in Admin > Images; they power the Muaaz Iqbal
// gallery, the home feed's "Muaaz Iqbal" cards and the image sitemap.

export const IMAGES_COLLECTION = 'siteImages';

export const cleanImage = (x = {}) => {
  const url = String(x.url || '').trim().slice(0, 500);
  return {
    id: String(x.id || '').replace(/[^\w-]/g, '').slice(0, 60) || `img${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    title: String(x.title || '').replace(/[<>]/g, '').trim().slice(0, 140),
    caption: String(x.caption || '').replace(/[<>]/g, '').trim().slice(0, 300),
    url,
    group: String(x.group || 'muaaz').replace(/[^\w-]/g, '').slice(0, 30) || 'muaaz',
    atMs: Number(x.atMs) || Date.now(),
  };
};
