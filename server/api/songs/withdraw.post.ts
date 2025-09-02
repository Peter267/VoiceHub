import { db } from '~/drizzle/db'
import { cacheService } from '~/server/services/cacheService'
import { songs, schedules, systemSettings, votes } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能撤回电影'
    })
  }

  const body = await readBody(event)

  if (!body.songId) {
    throw createError({
      statusCode: 400,
      message: '电影ID不能为空'
    })
  }

  // 查找电影
  const songResult = await db.select().from(songs).where(eq(songs.id, body.songId)).limit(1)
  const song = songResult[0]

  if (!song) {
    throw createError({
      statusCode: 404,
      message: '电影不存在'
    })
  }

  // 检查是否是用户自己的投稿
  if (song.requesterId !== user.id && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只能撤回自己的投稿'
    })
  }

  // 检查电影是否已经播放
  if (song.played) {
    throw createError({
      statusCode: 400,
      message: '已播放的电影不能撤回'
    })
  }

  // 检查电影是否已排期
  const scheduleResult = await db.select().from(schedules).where(eq(schedules.songId, body.songId)).limit(1)
  const schedule = scheduleResult[0]

  if (schedule) {
    throw createError({
      statusCode: 400,
      message: '已排期的电影不能撤回'
    })
  }

  // 获取系统设置以检查限制类型
  const settingsResult = await db.select().from(systemSettings).limit(1)
  const settings = settingsResult[0]
  const dailyLimit = settings?.dailySubmissionLimit || 0
  const weeklyLimit = settings?.weeklySubmissionLimit || 0

  // 检查撤销的电影是否在当前限制期间内（用于返还配额）
  let canReturnQuota = false
  const now = new Date()

  if (dailyLimit > 0) {
    // 检查是否在同一天
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

    if (song.createdAt >= startOfDay && song.createdAt < endOfDay) {
      canReturnQuota = true
    }
  } else if (weeklyLimit > 0) {
    // 检查是否在同一周（周一开始）
    const startOfWeek = new Date(now)
    const dayOfWeek = now.getDay()
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 周一为一周开始
    startOfWeek.setDate(now.getDate() - daysToSubtract)
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)

    if (song.createdAt >= startOfWeek && song.createdAt < endOfWeek) {
      canReturnQuota = true
    }
  }

  // 删除电影的所有投票
  await db.delete(votes).where(eq(votes.songId, body.songId))

  // 删除电影
  await db.delete(songs).where(eq(songs.id, body.songId))

  // 清除电影列表缓存
  await cacheService.clearSongsCache()
  console.log('[Cache] 电影缓存已清除（撤回电影）')

  return {
    message: canReturnQuota ? '电影已成功撤回，投稿配额已返还' : '电影已成功撤回',
    songId: body.songId,
    quotaReturned: canReturnQuota
  }
})