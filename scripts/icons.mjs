import sharp from 'sharp';

// Preserve the supplied square artwork in full: no crop, tracing, or redesign.
// This command regenerates branding only; it never writes menu images.
for (const [name, size] of [
  ['icon-192', 192],
  ['icon-512', 512],
  ['apple-touch-icon', 180],
  ['favicon-48', 48],
]) {
  await sharp('static/icons/logo.png')
    .resize(size, size, { fit: 'contain', kernel: 'lanczos3', background: '#202430' })
    .png()
    .toFile(`static/icons/${name}.png`);
}
