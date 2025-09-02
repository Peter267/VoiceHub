import { db } from '~/drizzle/db'
import { createSongPlayedNotification } from '../../services/notificationService'
import { CacheService } from '~/server/services/cacheService'
import { songs } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能标记电影'
    })
  }
  
  // 检查是否是管理员
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员可以标记电影为已播放'
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
  const songResult = await db.select()
    .from(songs)
    .where(eq(songs.id, body.songId))
    .limit(1)
  const song = songResult[0]
  
  if (!song) {
    throw createError({
      statusCode: 404,
      message: '电影不存在'
    })
  }
  
  // 检查是否是撤回操作
  const isUnmark = body.unmark === true
  
  // 检查电影播放状态
  if (!isUnmark && song.played) {
    throw createError({
      statusCode: 400,
      message: '电影已经标记为已播放'
    })
  } else if (isUnmark && !song.played) {
    throw createError({
      statusCode: 400,
      message: '电影尚未标记为已播放'
    })
  }
  
  // 更新电影状态
  const updatedSongResult = await db.update(songs)
    .set({
      played: !isUnmark,
      playedAt: isUnmark ? null : getBeijingTime()
    })
    .where(eq(songs.id, body.songId))
    .returning()
  const updatedSong = updatedSongResult[0]

  // 清除电影相关缓存
  try {
    const cacheService = CacheService.getInstance()
    await cacheService.clearSongsCache()
  } catch (error) {
    console.error('清除电影缓存失败:', error)
  }
  
  // 如果是标记为已播放，则发送通知
  if (!isUnmark) {
    createSongPlayedNotification(body.songId).catch(err => {
      console.error('发送电影已播放通知失败:', err)
    })
  }
  
  return {
    message: isUnmark ? '电影已成功撤回已播放状态' : '电影已成功标记为已播放',
    song: {
      id: updatedSong.id,
      title: updatedSong.title,
      artist: updatedSong.artist,
      played: updatedSong.played,
      playedAt: updatedSong.playedAt
    }
  }
})