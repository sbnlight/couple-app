/** 由 MIME 类型推断文件扩展名(上传路径/内容类型用) */
export function extFromType(type: string): string {
  if (type === 'image/gif') return 'gif'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

/**
 * 前端图片压缩:最长边缩到 maxEdge 以内。
 * - GIF:直接返回原文件,保留动画(canvas 只会画出第一帧、动图变静图)
 * - PNG:输出 PNG,保留透明背景(转 JPEG 会把透明变成白底)
 * - 其他(含 HEIC 经 Safari 转出的 JPEG):压成 JPEG,节约免费存储额度
 * 返回的 Blob 带正确的 type,调用方用 extFromType(blob.type) 取扩展名。
 */
export function compressImage(file: File, maxEdge = 1280, quality = 0.8): Promise<Blob> {
  // 动图直接原样返回,保住动画
  if (file.type === 'image/gif') return Promise.resolve(file)
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
      const isPng = file.type === 'image/png'
      const outType = isPng ? 'image/png' : 'image/jpeg'
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('图片压缩失败'))),
        outType,
        isPng ? undefined : quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('无法读取这张图片'))
    }
    img.src = objectUrl
  })
}
