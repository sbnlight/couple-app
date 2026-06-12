import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Anniversary } from '../types/db'

/** 纪念日列表:两人共同管理(都能添加/删除) */
export function useAnniversaries(coupleId: string) {
  const [list, setList] = useState<Anniversary[]>([])

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('anniversaries')
      .select('*')
      .eq('couple_id', coupleId)
      .order('anniv_date', { ascending: true })
    if (!error && data) setList(data as Anniversary[])
  }, [coupleId])

  useEffect(() => {
    void load()
  }, [load])

  const add = useCallback(
    async (title: string, date: string) => {
      const { error } = await supabase
        .from('anniversaries')
        .insert({ couple_id: coupleId, title, anniv_date: date })
      if (error) throw error
      await load()
    },
    [coupleId, load],
  )

  const remove = useCallback(
    async (id: number) => {
      const { error } = await supabase.from('anniversaries').delete().eq('id', id)
      if (error) throw error
      await load()
    },
    [load],
  )

  return { list, reload: load, add, remove }
}
