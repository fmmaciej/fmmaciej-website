function assetUrl(collection, source) {
  if (!source) return null;
  if (/^(?:https?:)?\//.test(source)) return source;
  return `/assets/music/${collection}/generated/${source}`;
}

function resolveMedia(media, collection, fallbackAlt = "") {
  const variants = media?.image?.variants || {};
  const variant = (size) => {
    const item = variants[String(size)];
    return item ? { ...item, src: assetUrl(collection, item.src) } : null;
  };
  const image480 = variant(480);
  const image960 = variant(960) || image480;
  const image1600 = variant(1600) || image960;

  return {
    ...media,
    alt: media?.alt || fallbackAlt,
    thumb480: image480?.src,
    thumb960: image960?.src,
    display1600: image1600?.src,
    thumb_w: image480?.width || 480,
    thumb_h: image480?.height || 300
  };
}

function resolvePreset(preset, fallbackAlt = "") {
  const variants = preset?.variants || {};
  return {
    id: null,
    alt: preset?.alt || fallbackAlt,
    thumb480: variants["480"] || preset?.src || null,
    thumb960: variants["960"] || variants["480"] || preset?.src || null,
    display1600: variants["1600"] || variants["960"] || variants["480"] || preset?.src || null,
    thumb_w: preset?.width || 480,
    thumb_h: preset?.height || 300
  };
}

module.exports = { assetUrl, resolveMedia, resolvePreset };
