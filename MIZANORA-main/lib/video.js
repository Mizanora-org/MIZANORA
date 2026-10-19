// Turn a pasted video link into something we can show.
// Supports YouTube (watch, shorts, live, youtu.be), Facebook, Instagram, TikTok, Vimeo, Dailymotion, Streamable, Google Drive (share link),
// Dropbox (share link), Cloudinary, and ANY direct media file link (.mp4 .webm .mov .m4v .ogv .m3u8).
export function parseVideo(raw) {
  const url = String(raw || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  let m;
  if ((m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/i))) {
    const vertical = /\/shorts\//i.test(url);
    return { type: 'youtube', url, id: m[1], vertical, src: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0&playsinline=1`, thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`, label: 'YouTube' };
  }
  if (/^https?:\/\/(?:[\w-]+\.)?(?:facebook\.com|fb\.watch|fb\.com)\//i.test(url)) {
    return { type: 'facebook', url, vertical: /\/reel\//i.test(url), src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`, thumb: '', label: 'Facebook' };
  }
  if ((m = url.match(/instagram\.com\/(reel|reels|p|tv)\/([\w-]+)/i))) {
    const kind = m[1] === 'reels' ? 'reel' : m[1];
    return { type: 'instagram', url, vertical: true, src: `https://www.instagram.com/${kind}/${m[2]}/embed`, thumb: '', label: 'Instagram' };
  }
  if ((m = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i))) {
    return { type: 'tiktok', url, vertical: true, src: `https://www.tiktok.com/embed/v2/${m[1]}`, thumb: '', label: 'TikTok' };
  }
  if ((m = url.match(/vimeo\.com\/(?:video\/|channels\/[\w-]+\/|groups\/[\w-]+\/videos\/)?(\d{6,})/i))) {
    return { type: 'vimeo', url, vertical: false, src: `https://player.vimeo.com/video/${m[1]}?autoplay=1&playsinline=1`, thumb: '', label: 'Vimeo' };
  }
  if ((m = url.match(/(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-z0-9]+)/i))) {
    return { type: 'dailymotion', url, vertical: false, src: `https://www.dailymotion.com/embed/video/${m[1]}?autoplay=1`, thumb: '', label: 'Dailymotion' };
  }
  if ((m = url.match(/streamable\.com\/(?:e\/)?([a-z0-9]+)/i))) {
    return { type: 'streamable', url, vertical: false, src: `https://streamable.com/e/${m[1]}?autoplay=1`, thumb: '', label: 'Streamable' };
  }
  if ((m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{20,})/i))) {
    return { type: 'drive', url, vertical: false, src: `https://drive.google.com/file/d/${m[1]}/preview`, thumb: '', label: 'Google Drive' };
  }
  if (/^https?:\/\/(?:www\.)?dropbox\.com\/(?:s|scl)\//i.test(url) && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
    const base = url.replace(/[?&]dl=[01]/i, '').replace(/[?&]$/, '');
    const direct = base + (base.includes('?') ? '&' : '?') + 'raw=1';
    return { type: 'file', url, vertical: false, src: direct, thumb: '', label: 'Dropbox video' };
  }
  if (/\.(mp4|webm|mov|m4v|ogv|m3u8)(\?|#|$)/i.test(url) || /res\.cloudinary\.com\/[^/]+\/video\/upload\//i.test(url)) return { type: 'file', url, vertical: false, src: url, thumb: '', label: 'Video' };
  return null;
}

export const parseVideos = (list) => (Array.isArray(list) ? list : []).map(parseVideo).filter(Boolean);
