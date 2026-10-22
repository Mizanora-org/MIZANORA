// Offline mock for next/font/google.
//
// WHY THIS FILE EXISTS
// next/font downloads the font CSS and the font files from Google Fonts WHILE THE APP IS BUILT.
// That is great for the shop (the fonts are then served from our own domain, fast and private),
// but it means the build fails when the build machine has no access to fonts.googleapis.com.
// With this mock the build runs completely offline: the font files are replaced by empty ones,
// and the CSS is generated locally.
//
// HOW TO USE IT
//   NEXT_FONT_GOOGLE_MOCKED_RESPONSES=./scripts/google-fonts-mock.js npm run build
// (the npm script "build:offline" does exactly that)
//
// NOTE: the mock is only for building/verifying. The real deployment should use the normal
// "npm run build", so the real fonts are downloaded and the shop looks exactly as designed.

/** One @font-face block for a weight of a family. */
const face = (family, weight, subset) => `/* ${subset} */
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/mizanora-mock/${family.toLowerCase().replace(/[^a-z]+/g, '-')}-${weight}.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}`;

/** A family with several weights. */
const many = (family, weights, subset) => weights.map((w) => face(family, w, subset)).join('\n');

module.exports = {
  // The exact URLs next/font asks Google for (see app/layout.js). A family can be asked for with a
  // fixed list of weights or with a range, so both spellings are listed here.
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&display=swap': many('Plus Jakarta Sans', [600, 700, 800], 'latin'),
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200..800&display=swap': many('Plus Jakarta Sans', [600, 700, 800], 'latin'),
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap': many('Amiri', [400, 700], 'arabic'),
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400..700&display=swap': many('Amiri', [400, 700], 'arabic'),
  'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap': face('Inter', 400, 'latin'),
  'https://fonts.googleapis.com/css2?family=Inter&display=swap': face('Inter', 400, 'latin'),
};
