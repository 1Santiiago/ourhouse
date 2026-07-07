const sharp = require('sharp')
const fs = require('fs')

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

// SVG do ícone — o ₢ verde
const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="100" fill="#07111F"/>
  <rect x="40" y="40" width="432" height="432" rx="80" fill="#10B981"/>
  <text
    x="256" y="340"
    font-family="Arial Black, sans-serif"
    font-weight="900"
    font-size="260"
    fill="white"
    text-anchor="middle"
  >₢</text>
</svg>
`

if (!fs.existsSync('public/icons')) fs.mkdirSync('public/icons', { recursive: true })

Promise.all(
  sizes.map(size =>
    sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(`public/icons/icon-${size}.png`)
      .then(() => console.log(`✓ icon-${size}.png`))
  )
).then(() => console.log('\nTodos os ícones gerados em public/icons/'))