import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { users, songs, votes, schedules, notifications, notificationSettings, playTimes, semesters, songBlacklists, systemSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { promises as fs } from 'fs'
import path from 'path'

export default defineEventHandler(async (event) => {
  try {
    // 验证管理员权限
    const user = event.context.user
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: '权限不足'
      })
    }

    const body = await readBody(event)
    const { tables = 'all', includeSystemData = true } = body

    console.log('开始创建数据库备份...')

    // 根据备份类型生成描述
    const backupTypeDesc = tables === 'users' ? '用户数据备份' : '完整数据库备份'

    // 创建备份数据对象
    const backupData = {
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        creator: user.username,
        description: `${backupTypeDesc} - ${new Date().toLocaleString('zh-CN')}`,
        backupType: tables === 'users' ? 'users' : 'full',
        tables: [],
        totalRecords: 0
      },
      data: {}
    }

    // 定义要备份的表和对应的查询
    const tablesToBackup = {
      users: {
        query: async () => {
          const usersData = await db.select().from(users)
          const settingsData = await db.select().from(notificationSettings)
          
          // 手动关联通知设置
          return usersData.map(user => ({
            ...user,
            notificationSettings: settingsData.filter(setting => setting.userId === user.id)
          }))
        },
        description: '用户数据'
      },
      songs: {
        query: async () => {
          const songsData = await db.select().from(songs)
          const usersData = await db.select({ id: users.id, username: users.username, name: users.name }).from(users)
          const votesData = await db.select().from(votes)
          const schedulesData = await db.select().from(schedules)
          const playTimesData = await db.select().from(playTimes)
          
          // 手动关联数据
          return songsData.map(song => ({
            ...song,
            requester: usersData.find(user => user.id === song.requesterId),
            votes: votesData.filter(vote => vote.songId === song.id).map(vote => ({
              ...vote,
              user: usersData.find(user => user.id === vote.userId)
            })),
            schedules: schedulesData.filter(schedule => schedule.songId === song.id),
            preferredPlayTime: playTimesData.find(pt => pt.id === song.preferredPlayTimeId)
          }))
        },
        description: '电影数据'
      },
      votes: {
        query: async () => {
          const votesData = await db.select().from(votes)
          const usersData = await db.select({ id: users.id, username: users.username, name: users.name }).from(users)
          const songsData = await db.select({ id: songs.id, title: songs.title, artist: songs.artist }).from(songs)
          
          return votesData.map(vote => ({
            ...vote,
            user: usersData.find(user => user.id === vote.userId),
            song: songsData.find(song => song.id === vote.songId)
          }))
        },
        description: '投票数据'
      },
      schedules: {
        query: async () => {
          const schedulesData = await db.select().from(schedules)
          const songsData = await db.select({ id: songs.id, title: songs.title, artist: songs.artist }).from(songs)
          const playTimesData = await db.select().from(playTimes)
          
          return schedulesData.map(schedule => ({
            ...schedule,
            song: songsData.find(song => song.id === schedule.songId),
            playTime: playTimesData.find(pt => pt.id === schedule.playTimeId)
          }))
        },
        description: '排期数据'
      },
      notifications: {
        query: async () => {
          const notificationsData = await db.select().from(notifications)
          const usersData = await db.select({ id: users.id, username: users.username, name: users.name }).from(users)
          const songsData = await db.select({ id: songs.id, title: songs.title, artist: songs.artist }).from(songs)
          
          return notificationsData.map(notification => ({
            ...notification,
            user: usersData.find(user => user.id === notification.userId),
            song: notification.songId ? songsData.find(song => song.id === notification.songId) : null
          }))
        },
        description: '通知数据'
      },
      notificationSettings: {
        query: async () => {
          const settingsData = await db.select().from(notificationSettings)
          const usersData = await db.select({ id: users.id, username: users.username, name: users.name }).from(users)
          
          return settingsData.map(setting => ({
            ...setting,
            user: usersData.find(user => user.id === setting.userId)
          }))
        },
        description: '通知设置'
      },
      playTimes: {
        query: () => db.select().from(playTimes),
        description: '播出时段'
      },
      semesters: {
        query: () => db.select().from(semesters),
        description: '学期数据'
      },
      songBlacklist: {
        query: () => db.select().from(songBlacklists),
        description: '电影黑名单'
      }
    }

    // 如果包含系统数据，添加系统设置表
    if (includeSystemData) {
      tablesToBackup.systemSettings = {
        query: () => db.select().from(systemSettings),
        description: '系统设置'
      }
    }

    // 根据请求的表进行备份
    let tablesToProcess
    if (tables === 'all') {
      tablesToProcess = Object.keys(tablesToBackup)
    } else if (tables === 'users') {
      // 仅备份用户相关数据
      tablesToProcess = ['users', 'notificationSettings']
    } else if (Array.isArray(tables)) {
      tablesToProcess = tables
    } else {
      tablesToProcess = [tables]
    }

    let totalRecords = 0

    for (const tableName of tablesToProcess) {
      if (!tablesToBackup[tableName]) {
        console.warn(`未知的表名: ${tableName}`)
        continue
      }

      try {
        console.log(`备份表: ${tableName}`)
        const tableData = await tablesToBackup[tableName].query()
        
        backupData.data[tableName] = tableData
        backupData.metadata.tables.push({
          name: tableName,
          description: tablesToBackup[tableName].description,
          recordCount: tableData.length
        })
        
        totalRecords += tableData.length
        console.log(`✅ ${tableName}: ${tableData.length} 条记录`)
      } catch (error) {
        console.error(`备份表 ${tableName} 失败:`, error)
        throw createError({
          statusCode: 500,
          statusMessage: `备份表 ${tableName} 失败: ${error.message}`
        })
      }
    }

    backupData.metadata.totalRecords = totalRecords

    // 生成备份文件名（用于下载）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePrefix = tables === 'users' ? 'users-backup' : 'database-backup'
    const filename = `${filePrefix}-${timestamp}.json`

    console.log(`✅ 备份完成: ${filename}`)
    console.log(`📊 总计备份 ${totalRecords} 条记录`)

    // 检测运行环境
    const isVercel = process.env.VERCEL || process.env.VERCEL_ENV
    const isNetlify = process.env.NETLIFY
    const isServerless = isVercel || isNetlify

    if (isServerless) {
      // 在无服务器环境中，直接返回备份数据供前端下载
      console.log('🌐 检测到无服务器环境，直接返回备份数据')
      
      // 计算数据大小（估算）
      const dataSize = JSON.stringify(backupData).length

      return {
        success: true,
        message: '数据库备份创建成功',
        backup: {
          filename,
          data: backupData,
          size: dataSize,
          metadata: backupData.metadata,
          downloadMode: 'direct' // 标识为直接下载模式
        }
      }
    } else {
      // 在传统服务器环境中，保存到文件系统
      try {
        const backupDir = path.join(process.cwd(), 'backups')
        try {
          await fs.access(backupDir)
        } catch {
          await fs.mkdir(backupDir, { recursive: true })
        }

        const filepath = path.join(backupDir, filename)
        await fs.writeFile(filepath, JSON.stringify(backupData, null, 2), 'utf8')

        return {
          success: true,
          message: '数据库备份创建成功',
          backup: {
            filename,
            filepath,
            size: (await fs.stat(filepath)).size,
            metadata: backupData.metadata,
            downloadMode: 'file' // 标识为文件下载模式
          }
        }
      } catch (fsError) {
        console.warn('文件系统操作失败，回退到直接返回模式:', fsError.message)
        
        // 如果文件系统操作失败，回退到直接返回模式
        const dataSize = JSON.stringify(backupData).length
        return {
          success: true,
          message: '数据库备份创建成功（直接下载模式）',
          backup: {
            filename,
            data: backupData,
            size: dataSize,
            metadata: backupData.metadata,
            downloadMode: 'direct'
          }
        }
      }
    }

  } catch (error) {
    console.error('创建数据库备份失败:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || '创建数据库备份失败'
    })
  }
})
