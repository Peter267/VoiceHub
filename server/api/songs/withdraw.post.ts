import { prisma } from '../../models/schema'
import { CacheService } from '~/server/services/cacheService'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能撤回视频'
    })
  }
  
  const body = await readBody(event)
  
  if (!body.songId) {
    throw createError({
      statusCode: 400,
      message: '视频ID不能为空'
    })
  }
  
  // 查找视频
  const song = await prisma.song.findUnique({
    where: {
      id: body.songId
    }
  })
  
  if (!song) {
    throw createError({
      statusCode: 404,
      message: '视频不存在'
    })
  }
  
  // 检查是否是用户自己的投稿
  if (song.requesterId !== user.id && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只能撤回自己的投稿'
    })
  }
  
  // 检查视频是否已经播放
  if (song.played) {
    throw createError({
      statusCode: 400,
      message: '已播放的视频不能撤回'
    })
  }
  
  // 检查视频是否已排期
  const schedule = await prisma.schedule.findFirst({
    where: {
      songId: body.songId
    }
  })
  
  if (schedule) {
    throw createError({
      statusCode: 400,
      message: '已排期的视频不能撤回'
    })
  }
  
  // 获取系统设置以检查限制类型
  const settings = await prisma.systemSettings.findFirst()
  const dailyLimit = settings?.dailySubmissionLimit || 0
  const weeklyLimit = settings?.weeklySubmissionLimit || 0
  
  // 检查撤销的视频是否在当前限制期间内（用于返还配额）
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
  
  // 删除视频的所有投票
  await prisma.vote.deleteMany({
    where: {
      songId: body.songId
    }
  })
  
  // 删除视频
  await prisma.song.delete({
    where: {
      id: body.songId
    }
  })
  
  // 清除视频列表缓存
  const cacheService = new CacheService()
  await cacheService.clearSongsCache()
  console.log('[Cache] 视频缓存已清除（撤回视频）')
  
  return {
    message: canReturnQuota ? '视频已成功撤回，投稿配额已返还' : '视频已成功撤回',
    songId: body.songId,
    quotaReturned: canReturnQuota
  }
})