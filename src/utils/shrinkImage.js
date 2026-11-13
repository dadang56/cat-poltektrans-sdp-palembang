// Shrinks an uploaded logo before it is stored in app_settings. The logo is
// saved as a data URL inside the settings JSON, which every visitor downloads
// on each visit, so a 2 MB photo there slows the whole app down.
// Returns a data URL no wider/taller than maxSize (WebP, PNG if unsupported).
export function shrinkImageFile(file, maxSize = 320) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error)
        reader.onload = () => {
            const src = reader.result
            // SVG stays as is (already small, and canvas would lose sharpness)
            if (file.type === 'image/svg+xml') return resolve(src)
            const img = new Image()
            img.onerror = () => resolve(src)
            img.onload = () => {
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
                const w = Math.max(1, Math.round(img.width * scale))
                const h = Math.max(1, Math.round(img.height * scale))
                const canvas = document.createElement('canvas')
                canvas.width = w
                canvas.height = h
                canvas.getContext('2d').drawImage(img, 0, 0, w, h)
                let out = canvas.toDataURL('image/webp', 0.9)
                if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/png')
                resolve(out.length < src.length ? out : src)
            }
            img.src = src
        }
        reader.readAsDataURL(file)
    })
}
