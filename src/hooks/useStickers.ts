import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/image'
import type { Sticker } from '../types/db'

/**
 * 自定义表情包:小屋内两人共享可见;添加从相册选图,
 * 压缩后传 stickers 私有桶并写一条元数据;只能删自己加的。
 */
export function useStickers(coupleId: string, userId: string) {
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('couple_id', coupleId)
      .order('id', { ascending: false })
    if (!error && data) setStickers(data as Sticker[])
    setLoading(false)
  }, [coupleId])

  useEffect(() => {
    void load()
  }, [load])

  /** 收藏一张新表情(失败抛错由调用方提示) */
  const add = useCallback(
    async (file: File) => {
      const blob = await compressImage(file, 512, 0.85)
      const path = `${coupleId}/${crypto.randomUUID()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('stickers')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (upErr) throw upErr
      const { error: dbErr } = await supabase
        .from('stickers')
        .insert({ couple_id: coupleId, owner_id: userId, path })
      if (dbErr) throw dbErr
      await load()
    },
    [coupleId, userId, load],
  )

  /** 删除自己收藏的表情 */
  const remove = useCallback(
    async (s: Sticker) => {
      const { error } = await supabase.from('stickers').delete().eq('id', s.id)
      if (error) throw error
      // 删图失败不影响主流程(元数据已删,面板里不会再出现)
      void supabase.storage.from('stickers').remove([s.path])
      await load()
    },
    [load],
  )

  return { stickers, loading, add, remove }
}
