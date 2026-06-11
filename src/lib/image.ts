/**
 * 前端图片压缩:最长边缩到 maxEdge 以内,输出 JPEG Blob。
 * 头像用 512,聊天图片(M2)用 1280,节约 Supabase 免费存储额度。
 * iPhone 的 HEIC 照片经 <input type="file"> 选择时 Safari 会自动转成 JPEG,无需特殊处理。
 */
export function compressImage(file: File, maxEdge = 1280, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建画布'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('图片压缩失败'))),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('无法读取这张图片'))
    }
    img.src = objectUrl
  })
}
