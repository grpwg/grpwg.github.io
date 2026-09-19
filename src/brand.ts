// The lockup: rule, two-line name, latin line. The name column is 300pt per
// glyph with 16pt tracking, so it spans 616 units; PODCAST is stretched to that
// same width with textLength. Shared by the opening and the corner branding.
const NAME = `<rect x="266" y="216" width="70" height="704" fill="#c2192a"/><text x="378" y="505" font-family="MiSans,sans-serif" font-size="300" font-weight="700" letter-spacing="16">光辉</text><text x="378" y="805" font-family="MiSans,sans-serif" font-size="300" font-weight="700" letter-spacing="16">革命</text><text x="378" y="928" font-family="MiSans,sans-serif" font-size="110" font-weight="700" textLength="616" lengthAdjust="spacing">PODCAST</text>`;
const BOX = "240 190 780 770";

export const logo = `<svg class="brand-lockup" viewBox="${BOX}" fill="currentColor" aria-label="光辉革命播客" role="img"><g class="brand-lockup-body">${NAME}</g></svg>`;

export const brandHeading = logo;
