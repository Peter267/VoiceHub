<template>
  <div class="schedule-list">
    <!-- 两列布局：左侧日期选择，右侧排期展示 -->
    <div class="schedule-container">
      <!-- 左侧日期选择列表 - 移除标题和框 -->
      <div class="date-selector">
        <!-- 添加移动端日期导航按钮 -->
        <div class="mobile-date-nav">
          <button
            class="date-nav-btn prev"
            @click="previousDate"
            :disabled="currentDateIndex === 0"
          >
            <Icon name="chevron-left" :size="16" />
          </button>
          <div
            class="current-date-mobile"
            v-html="currentDateFormatted"
            @click="toggleDatePicker"
          ></div>
          <button
            class="date-nav-btn next"
            @click="nextDate"
            :disabled="currentDateIndex >= availableDates.length - 1"
          >
            <Icon name="chevron-right" :size="16" />
          </button>
        </div>
        
        <!-- 添加移动端日期选择弹窗 -->
        <Transition name="date-picker-fade">
          <div v-if="showDatePicker" class="date-picker-modal">
            <div class="date-picker-overlay" @click="showDatePicker = false"></div>
            <div class="date-picker-content">
              <div class="date-picker-header">
                <h3>选择日期</h3>
                <button class="close-btn" @click="showDatePicker = false">×</button>
              </div>
              <div class="date-picker-list">
                <div 
                  v-for="(date, index) in availableDates" 
                  :key="date"
                  :class="['date-picker-item', { 'active': currentDateIndex === index }]"
                  @click="selectDateAndClose(index)"
                  v-html="formatDate(date, false)"
                  v-ripple
                >
                </div>
                
                <div v-if="availableDates.length === 0" class="empty-dates">
                  暂无排期日期
                </div>
              </div>
            </div>
          </div>
        </Transition>
        
        <!-- 桌面端日期列表 -->
        <div class="date-list">
          <div 
            v-for="(date, index) in availableDates" 
            :key="date"
            :class="['date-item', { 'active': currentDateIndex === index }]"
            @click="selectDate(index)"
            v-html="formatDate(date)"
            v-ripple
          >
          </div>
          
          <div v-if="availableDates.length === 0" class="empty-dates">
            暂无排期日期
          </div>
        </div>
        <!-- 添加滚动指示器 -->
        <div class="scroll-indicator-container">
          <div class="scroll-indicator"></div>
        </div>
      </div>
      
      <!-- 分隔线 - 添加径向渐变效果 -->
      <div class="vertical-divider"></div>
      
      <!-- 右侧排期内容 -->
      <div class="schedule-content">
        <div class="schedule-header">
          <h2 class="current-date" v-html="currentDateFormatted"></h2>
        </div>
        
        <!-- 使用Transition组件包裹内容 -->
        <Transition name="schedule-fade" mode="out-in">
          <div v-if="loading" class="loading" key="loading">
            加载中...
          </div>

          <div v-else-if="error" class="error" key="error">
            {{ error }}
          </div>

          <div v-else-if="!schedules || schedules.length === 0" class="empty" key="empty-all">
            <div class="icon mb-4">📽</div>
            <p>暂无排期信息</p>
            <p class="text-sm text-gray">点播后等待管理员安排播出时间</p>
          </div>

          <div v-else-if="currentDateSchedules.length === 0" class="empty" key="empty-date">
            <div class="icon mb-4">📅</div>
            <p>当前日期暂无排期</p>
            <p>请选择其他日期查看</p>
          </div>

          <div v-else class="schedule-items" :key="currentDate">
            <!-- 按播出时段分组显示 -->
            <template v-if="schedulesByPlayTime && Object.keys(schedulesByPlayTime).length > 0">
              <div v-for="(schedules, playTimeId) in schedulesByPlayTime" :key="playTimeId" class="playtime-group">
                <div class="playtime-header" v-if="shouldShowPlayTimeHeader(playTimeId)">
                  <h4 v-if="playTimeId === 'null'">未指定时段</h4>
                  <h4 v-else-if="getPlayTimeById(playTimeId)">
                    {{ getPlayTimeById(playTimeId).name }}
                    <span class="playtime-time" v-if="getPlayTimeById(playTimeId).startTime || getPlayTimeById(playTimeId).endTime">
                      ({{ formatPlayTimeRange(getPlayTimeById(playTimeId)) }})
                    </span>
                  </h4>
                </div>

                <div class="song-cards">
                  <div
                    v-for="schedule in schedules"
                    :key="schedule.id"
                    class="song-card"
                    :class="{ 'played': schedule.song.played }"
                  >
                    <div class="song-card-main">
                      <!-- 添加电影封面 -->
                      <div class="song-cover">
                        <template v-if="schedule.song.cover">
                          <img
                            :src="convertToHttps(schedule.song.cover)"
                            :alt="schedule.song.title"
                            class="cover-image"
                            @error="handleImageError($event, schedule.song)"
                          />
                        </template>
                        <div v-else class="text-cover">
                          {{ getFirstChar(schedule.song.title) }}
                        </div>
                        <!-- 添加播放按钮 - 在有平台信息时显示 -->
                        <div v-if="schedule.song.musicPlatform && schedule.song.musicId" class="play-button-overlay" @click="togglePlaySong(schedule.song)">
                          <button class="play-button" :title="isCurrentPlaying(schedule.song.id) ? '暂停' : '播放'">
                            <Icon v-if="isCurrentPlaying(schedule.song.id)" name="pause" :size="16" color="white" />
                            <Icon v-else name="play" :size="16" color="white" />
                          </button>
                        </div>
                      </div>

                      <div class="song-info">
                        <h3 class="song-title" :title="schedule.song.title + ' - ' + schedule.song.artist">
                          {{ schedule.song.title }} - {{ schedule.song.artist }}
                        </h3>
                        <div class="song-meta">
                          <span class="requester">投稿人：{{ schedule.song.requester }}</span>
                        </div>
                      </div>
                      
                      <!-- 热度展示 -->
                      <div class="action-area">
                        <div class="vote-count">
                          <span class="count">{{ schedule.song.voteCount }}</span>
                          <span class="label">热度</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </div>

    <!-- 使用全局音频播放器，此处不需要audio元素 -->
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useSongs } from '~/composables/useSongs'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useMusicSources } from '~/composables/useMusicSources'
import Icon from '~/components/UI/Icon.vue'
import { convertToHttps } from '~/utils/url'

const props = defineProps({
  schedules: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  }
})

// 音频播放相关 - 使用全局音频播放器
const audioPlayer = useAudioPlayer()

// 获取播放时段启用状态
const { playTimeEnabled } = useSongs()

// 确保schedules不为null
const safeSchedules = computed(() => props.schedules || [])

// 日期选择器状态
const showDatePicker = ref(false)

// 按日期分组排期
const safeGroupedSchedules = computed(() => {
  const groups = {}

  if (!safeSchedules.value || !safeSchedules.value.length) {
    return {}
  }

  safeSchedules.value.forEach(schedule => {
    if (!schedule || !schedule.playDate) return

    try {
      // 使用UTC时间处理日期
      const scheduleDate = new Date(schedule.playDate)
      const date = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getDate()).padStart(2, '0')}`

    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(schedule)
    } catch (err) {
      // 无需在此处记录错误
    }
  })

  // 按日期排序
  const sortedGroups = {}
  Object.keys(groups).sort().forEach(date => {
    sortedGroups[date] = groups[date]
  })

  return sortedGroups
})

// 日期导航
const availableDates = computed(() => {
  return Object.keys(safeGroupedSchedules.value).sort()
})

const currentDateIndex = ref(0)

// 当前显示的日期
const currentDate = computed(() => {
  if (availableDates.value.length === 0) return ''
  return availableDates.value[currentDateIndex.value]
})

// 当日期列表变化时切换到今天日期
watch(availableDates, (newDates) => {
  if (newDates.length > 0) {
    findAndSelectTodayOrClosestDate()
  }
}, { immediate: false })

// 提取日期选择逻辑到独立函数
const findAndSelectTodayOrClosestDate = () => {
  if (availableDates.value.length === 0) return

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  
  // 在宽屏模式下，优先显示最近的日期（今天或之后最近的日期）
  if (!isMobile.value) {
    const todayTime = today.getTime()
    let closestFutureIndex = -1
    let minFutureDiff = Number.MAX_SAFE_INTEGER
    
    // 查找今天或之后最近的日期
    availableDates.value.forEach((dateStr, index) => {
      const dateParts = dateStr.split('-')
      const date = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2])
      )
      const diff = date.getTime() - todayTime
      
      // 优先选择今天或未来的日期
      if (diff >= 0 && diff < minFutureDiff) {
        minFutureDiff = diff
        closestFutureIndex = index
      }
    })
    
    // 如果找到了今天或未来的日期，选择它
    if (closestFutureIndex >= 0) {
      currentDateIndex.value = closestFutureIndex
      return
    }
    
    // 如果没有今天或未来的日期，选择最近的过去日期
    let closestPastIndex = -1
    let minPastDiff = Number.MAX_SAFE_INTEGER
    
    availableDates.value.forEach((dateStr, index) => {
      const dateParts = dateStr.split('-')
      const date = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2])
      )
      const diff = todayTime - date.getTime()
      
      if (diff > 0 && diff < minPastDiff) {
        minPastDiff = diff
        closestPastIndex = index
      }
    })
    
    if (closestPastIndex >= 0) {
      currentDateIndex.value = closestPastIndex
    } else {
      // 如果都没找到，默认选择第一个
      currentDateIndex.value = 0
    }
  } else {
    // 移动端保持原有逻辑：优先选择今天
    const todayIndex = availableDates.value.findIndex(date => date === todayStr)
    
    if (todayIndex >= 0) {
      // 如果找到今天的日期，则选择它
      currentDateIndex.value = todayIndex
    } else {
      // 如果今天没有排期，找到最接近今天的日期
      const todayTime = today.getTime()
      let closestDate = -1
      let minDiff = Number.MAX_SAFE_INTEGER
      
      availableDates.value.forEach((dateStr, index) => {
        const dateParts = dateStr.split('-')
        const date = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2])
        )
        const diff = Math.abs(date.getTime() - todayTime)
        
        if (diff < minDiff) {
          minDiff = diff
          closestDate = index
        }
      })
      
      if (closestDate >= 0) {
        currentDateIndex.value = closestDate
      }
    }
  }
}

// 格式化当前日期
const currentDateFormatted = computed(() => {
  if (!currentDate.value) return '无日期'
  return formatDate(currentDate.value, isMobile.value)
})

// 当前日期的排期
const currentDateSchedules = computed(() => {
  if (!currentDate.value) return []
  return safeGroupedSchedules.value[currentDate.value] || []
})

// 上一个日期
const previousDate = () => {
  if (currentDateIndex.value > 0) {
    currentDateIndex.value--
  }
}

// 下一个日期
const nextDate = () => {
  if (currentDateIndex.value < availableDates.value.length - 1) {
    currentDateIndex.value++
  }
}

// 选择特定日期
const selectDate = (index) => {
  currentDateIndex.value = index
  showDatePicker.value = false
}

// 切换日期选择器显示状态
const toggleDatePicker = () => {
  showDatePicker.value = !showDatePicker.value
}

// 选择日期并关闭弹窗
const selectDateAndClose = (index) => {
  currentDateIndex.value = index
  showDatePicker.value = false
}

// 重置日期到第一天
const resetDate = () => {
  currentDateIndex.value = 0
}

// 格式化日期
const formatDate = (dateStr, isMobile = false) => {
  try {
    // 解析日期字符串
    const parts = dateStr.split('-')
    if (parts.length !== 3) {
      throw new Error('无效的日期格式')
    }

    const year = parseInt(parts[0])
    const month = parseInt(parts[1])
    const day = parseInt(parts[2])

    // 创建日期对象
    const date = new Date(year, month - 1, day)

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      throw new Error('无效的日期')
    }

    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekday = weekdays[date.getDay()]

    // 移动端显示更紧凑的格式
    if (isMobile) {
      return `${month}月${day}日 ${weekday}`
    }

    return `${year}年${month}月${day}日\n<span class="weekday">${weekday}</span>`
  } catch (e) {
    return dateStr || '未知日期'
  }
}

// 添加窗口大小变化监听
let resizeTimer = null
const isMobile = ref(window.innerWidth <= 768)

// 定义窗口大小变化处理函数
const handleResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    isMobile.value = window.innerWidth <= 768
  }, 100)
}







// 监听窗口大小变化
onMounted(async () => {
  window.addEventListener('resize', handleResize)
  // 初始化移动状态
  isMobile.value = window.innerWidth <= 768
  
  // 寻找今天的日期并自动选择 - 初始加载时也尝试一次
  findAndSelectTodayOrClosestDate()
})

// 组件销毁前移除事件监听器
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

// 处理图片加载错误
const handleImageError = (event, song) => {
  event.target.style.display = 'none'
  event.target.parentNode.classList.add('text-cover')
  event.target.parentNode.textContent = getFirstChar(song.title)
}

// 获取电影标题的第一个字符作为封面
const getFirstChar = (title) => {
  if (!title) return '音'
  return title.trim().charAt(0)
}



// 切换电影播放/暂停
const togglePlaySong = async (song) => {
  // 检查是否为当前电影且正在播放
  if (audioPlayer.isCurrentSong(song.id) && audioPlayer.getPlayingStatus().value) {
    // 如果正在播放，则暂停
    audioPlayer.pauseSong()
    return
  }

  // 如果是当前电影但已暂停，则恢复播放
  if (audioPlayer.isCurrentSong(song.id) && !audioPlayer.getPlayingStatus().value) {
    // 检查当前全局电影是否有URL
    const currentGlobalSong = audioPlayer.getCurrentSong().value
    if (currentGlobalSong && currentGlobalSong.musicUrl) {
      // 如果有URL，直接恢复播放
      audioPlayer.playSong(currentGlobalSong)
    } else {
      // 如果没有URL，重新获取
      if (song.musicPlatform && song.musicId) {
        try {
          const url = await getMusicUrl(song.musicPlatform, song.musicId)
          if (url) {
            const playableSong = {
              ...song,
              musicUrl: url
            }
            audioPlayer.playSong(playableSong)
          } else {
            if (window.$showNotification) {
              window.$showNotification('无法获取音乐播放链接，请稍后再试', 'error')
            }
          }
        } catch (error) {
          console.error('获取音乐URL失败:', error)
          if (window.$showNotification) {
            window.$showNotification('获取音乐播放链接失败', 'error')
          }
        }
      }
    }
    return
  }

  // 如果有平台和ID信息，动态获取URL
  if (song.musicPlatform && song.musicId) {
    try {
      const url = await getMusicUrl(song.musicPlatform, song.musicId)
      if (url) {
        // 构建当前时段的播放列表
        const currentTimeSlot = getCurrentTimeSlot(song)
        let playlist = []
        let songIndex = 0
        
        if (currentTimeSlot && currentTimeSlot.songs) {
          // 为播放列表中的每首电影获取音乐URL（如果需要的话）
          playlist = await Promise.all(currentTimeSlot.songs.map(async (s) => {
            let musicUrl = s.musicUrl
            
            // 如果电影没有musicUrl但有平台信息，尝试获取
            if (!musicUrl && s.musicPlatform && s.musicId) {
              try {
                musicUrl = await getMusicUrl(s.musicPlatform, s.musicId)
              } catch (error) {
                console.warn(`无法获取电影 ${s.title} 的播放链接:`, error)
                musicUrl = null
              }
            }
            
            return {
              id: s.id,
              title: s.title,
              artist: s.artist,
              cover: s.cover,
              musicUrl: musicUrl,
              musicPlatform: s.musicPlatform,
              musicId: s.musicId
            }
          }))
          
          // 找到当前电影在播放列表中的索引
          songIndex = playlist.findIndex((s) => s.id === song.id)
          if (songIndex === -1) songIndex = 0
        }
        
        const playableSong = {
          ...song,
          musicUrl: url
        }
        
        // 更新播放列表中当前电影的URL
        if (playlist.length > 0 && songIndex >= 0) {
          playlist[songIndex] = playableSong
        }
        
        audioPlayer.playSong(playableSong, playlist, songIndex)
      } else {
        if (window.$showNotification) {
          window.$showNotification('无法获取音乐播放链接，请稍后再试', 'error')
        }
      }
    } catch (error) {
      console.error('获取音乐URL失败:', error)
      if (window.$showNotification) {
        window.$showNotification('获取音乐播放链接失败', 'error')
      }
    }
  }
}

// 获取电影所在的时段
const getCurrentTimeSlot = (song) => {
  if (!schedulesByPlayTime.value) return null
  
  for (const [playTimeId, schedules] of Object.entries(schedulesByPlayTime.value)) {
    if (schedules.some((schedule) => schedule.song.id === song.id)) {
      return {
        id: playTimeId,
        songs: schedules.map(schedule => schedule.song)
      }
    }
  }
  return null
}

// 动态获取音乐URL
const getMusicUrl = async (platform, musicId) => {
  const { getQuality } = useAudioQuality()
  const { getSongUrl } = useMusicSources()

  try {
    const quality = getQuality(platform)

    // 首先尝试vkeys API
    let apiUrl
    if (platform === 'netease') {
      apiUrl = `https://api.vkeys.cn/v2/music/netease?id=${musicId}&quality=${quality}`
    } else if (platform === 'tencent') {
      apiUrl = `https://api.vkeys.cn/v2/music/tencent?id=${musicId}&quality=${quality}`
    } else {
      throw new Error('不支持的音乐平台')
    }

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error('vkeys API请求失败')
    }

    const data = await response.json()
    if (data.code === 200 && data.data && data.data.url) {
      // 将HTTP URL改为HTTPS
      let url = data.data.url
      if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://')
      }
      console.log('vkeys API获取音乐URL成功')
      return url
    }

    // vkeys API返回了响应但没有有效的URL，尝试备用源
    throw new Error('vkeys API未返回有效的音乐URL')
  } catch (error) {
    console.error('vkeys API获取音乐URL失败:', error)
    
    // 如果是网易云平台，尝试使用备用源
    if (platform === 'netease') {
      console.log('尝试使用网易云备用源获取音乐URL...')
      try {
        const quality = getQuality(platform)
        const backupResult = await getSongUrl(musicId, quality)
        
        if (backupResult && backupResult.url) {
          console.log('网易云备用源获取音乐URL成功')
          return backupResult.url
        } else {
          console.error('网易云备用源未返回有效的URL')
        }
      } catch (backupError) {
        console.error('网易云备用源获取音乐URL也失败:', backupError)
      }
    }
    
    // vkeys和备用源都失败了
    throw new Error('所有音源都无法获取音乐播放链接')
  }
}

// 判断当前是否正在播放指定ID的电影
const isCurrentPlaying = (songId) => {
  return audioPlayer.isCurrentPlaying(songId)
}

// 格式化播放时间
const formatPlayTime = (schedule) => {
  try {
    // 根据电影播放状态显示不同文本
    if (schedule.song && schedule.song.played) {
      return "已播放"
    } else {
      return "已排期"
    }
  } catch (e) {
    return '时间未定'
  }
}

// 按播出时段分组的排期
const schedulesByPlayTime = computed(() => {
  if (!currentDateSchedules.value || currentDateSchedules.value.length === 0) {
    return null;
  }

  const grouped = {};

  // 先对排期按时段和序号排序
  const sortedSchedules = [...currentDateSchedules.value].sort((a, b) => {
    // 先按时段分组，确保转换为字符串
    const playTimeIdA = a.playTimeId !== null && a.playTimeId !== undefined ? String(a.playTimeId) : 'null';
    const playTimeIdB = b.playTimeId !== null && b.playTimeId !== undefined ? String(b.playTimeId) : 'null';

    if (playTimeIdA !== playTimeIdB) {
      // 未指定时段排在最后
      if (playTimeIdA === 'null') return 1;
      if (playTimeIdB === 'null') return -1;
      // 使用数字比较而不是字符串比较
      return parseInt(playTimeIdA) - parseInt(playTimeIdB);
    }

    // 时段相同则按序号排序
    return a.sequence - b.sequence;
  });

  // 分组
  for (const schedule of sortedSchedules) {
    // 确保正确处理播放时段ID
    const playTimeId = schedule.playTimeId !== null && schedule.playTimeId !== undefined ? String(schedule.playTimeId) : 'null';

    if (!grouped[playTimeId]) {
      grouped[playTimeId] = [];
    }

    grouped[playTimeId].push(schedule);
  }

  return grouped;
});

// 根据ID获取播出时段信息
const getPlayTimeById = (id) => {
  if (id === 'null') return null;

  try {
    const numId = parseInt(id);
    if (isNaN(numId)) return null;

    // 从排期中查找
    for (const schedule of currentDateSchedules.value) {
      // 确保正确比较
      if (schedule.playTimeId === numId && schedule.playTime) {
        return schedule.playTime;
      }
    }
  } catch (err) {
    // 无需在此处记录错误
  }

  return null;
};

// 格式化播出时段时间范围
const formatPlayTimeRange = (playTime) => {
  if (!playTime) return '';

  if (playTime.startTime && playTime.endTime) {
    return `${playTime.startTime} - ${playTime.endTime}`;
  } else if (playTime.startTime) {
    return `${playTime.startTime} 开始`;
  } else if (playTime.endTime) {
    return `${playTime.endTime} 结束`;
  }

  return '不限时间';
};

// 判断是否显示播放时段标题
const shouldShowPlayTimeHeader = (playTimeId) => {
  // 如果播放时段功能未启用且是未指定时段，则不显示
  if (!playTimeEnabled.value && playTimeId === 'null') {
    return false;
  }
  return true; // 显示其他所有时段
};

// 波纹效果指令
const vRipple = {
  mounted(el) {
    el.addEventListener('click', e => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      
      el.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600); // 与CSS动画时间一致
    });
  }
};
</script>

<style scoped>
.schedule-list {
  width: 100% !important;
  position: relative;
  box-sizing: border-box;
  margin: 0 !important;
  padding: 0 !important;
  max-width: none !important;
  min-height: 50vh; /* 确保排期列表有足够的高度 */
}

/* 学期选择器样式 */
.semester-selector {
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, rgba(11, 90, 254, 0.1) 0%, rgba(33, 36, 45, 0.9) 100%);
  border-radius: 12px;
  border: 1px solid rgba(11, 90, 254, 0.2);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.semester-label {
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 500;
  margin-right: 0.75rem;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.semester-select {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  color: #FFFFFF;
  padding: 0.6rem 1rem;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 180px;
  backdrop-filter: blur(5px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.semester-select:hover {
  background: linear-gradient(135deg, rgba(11, 90, 254, 0.2) 0%, rgba(255, 255, 255, 0.15) 100%);
  border-color: rgba(11, 90, 254, 0.6);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(11, 90, 254, 0.2);
}

.semester-select:focus {
  outline: none;
  border-color: #0B5AFE;
  box-shadow: 0 0 0 3px rgba(11, 90, 254, 0.3), 0 4px 12px rgba(11, 90, 254, 0.2);
  transform: translateY(-1px);
}

.semester-select option {
  background: #1A1D24;
  color: #FFFFFF;
  padding: 0.5rem;
}

/* 两列布局容器 */
.schedule-container {
  display: flex;
  gap: 0; /* 移除间隙，使用分隔线 */
  width: 100% !important;
  box-sizing: border-box;
  margin: 0 !important;
  padding: 0 !important;
  max-width: none !important;
  min-height: 45vh; /* 确保容器有足够的高度 */
}

/* 左侧日期选择器 - 移除背景和边框 */
.date-selector {
  width: 200px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.date-list {
  max-height: 500px;
  overflow-y: auto;
  width: 100%;
}

/* 增强日期项目样式 */
.date-item {
  padding: 0.8rem 1rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 0.5rem;
  border-radius: 8px;
  white-space: pre-line;
  text-align: left;
  line-height: 1.4;
  position: relative;
  overflow: hidden;
}

.date-item:hover {
  background: #21242D;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.date-item.active {
  background: #21242D;
  color: #FFFFFF;
  font-weight: 600;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(11, 90, 254, 0.2);
  border-left: 3px solid #0B5AFE;
}

.empty-dates {
  padding: 2rem 1rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
}

.weekday {
  display: block;
  font-size: 12px;
  opacity: 0.7;
  margin-top: 2px;
}

/* 垂直分隔线 - 添加径向渐变效果 */
.vertical-divider {
  width: 2px;
  background: linear-gradient(
    180deg,
    rgba(217, 217, 217, 0) 0%,
    rgba(217, 217, 217, 0.5) 50%,
    rgba(217, 217, 217, 0) 100%
  );
  margin: 0 1.5rem;
  position: relative;
}

/* 右侧排期内容 */
.schedule-content {
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 250px); /* 缩小右侧内容区域宽度 */
  min-height: 40vh; /* 确保内容区域有足够的高度 */
}

.schedule-header {
  margin-bottom: 1.5rem;
}

.current-date {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 20px;
  color: #FFFFFF;
  margin: 0;
}

/* 加载和错误状态 */
.loading {
  padding: 3rem;
  text-align: center;
  border-radius: 10px;
  background: #21242D;
  margin: 1rem 0;
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.loading::before {
  content: "";
  display: block;
  width: 40px;
  height: 40px;
  margin-bottom: 1rem;
  border-radius: 50%;
  border: 3px solid rgba(11, 90, 254, 0.2);
  border-top-color: #0B5AFE;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error, .empty {
  padding: 2rem;
  text-align: center;
  border-radius: 10px;
  background: #21242D;
  margin: 1rem 0;
  color: rgba(255, 255, 255, 0.6);
}

.error {
  color: #ef4444;
}

.empty .icon {
  font-size: 3rem;
  opacity: 0.5;
}

/* 排期时段分组 */
.playtime-group {
  margin-bottom: 2rem;
}

.playtime-header h4 {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 1rem 0;
}

.playtime-time {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
  margin-left: 0.5rem;
}

/* 电影卡片样式 - 固定宽度布局 */
.song-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.song-card {
  width: 320px;
  flex-shrink: 0;
  background: #21242D;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}

/* 针对不同屏幕尺寸的响应式调整 */
@media (max-width: 1400px) {
  .song-card {
    width: 300px;
  }
}

@media (max-width: 1200px) {
  .song-card {
    width: 280px;
  }
}

@media (max-width: 1024px) {
  .song-card {
    width: calc(50% - 0.5rem);
  }
}

@media (max-width: 768px) {
  .song-card {
    width: 100%;
  }
}



.song-card-main {
  padding: 1rem;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
  position: relative;
  height: 90px; /* 减小卡片高度 */
  display: flex; /* 使用flex布局 */
  align-items: center; /* 垂直居中 */
  gap: 15px; /* 元素之间的间隔 */
}



/* 电影封面样式 */
.song-cover {
  width: 55px;
  height: 55px;
  flex-shrink: 0;
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 文字封面样式 */
.text-cover {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0043F8 0%, #0075F8 100%);
  color: #FFFFFF;
  font-size: 28px;
  font-weight: bold;
  font-family: 'MiSans', sans-serif;
}

/* 播放按钮叠加层 */
.play-button-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.2s ease;
  cursor: pointer;
}

.song-cover:hover .play-button-overlay {
  opacity: 1;
}

/* 播放按钮样式 */
.play-button {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(11, 90, 254, 0.8);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.play-button:hover {
  transform: scale(1.1);
}

.play-icon {
  margin-left: 2px;
}

.pause-icon {
  font-size: 10px;
}

.song-info {
  width: calc(70% - 75px); /* 减去封面宽度和间距 */
}

.song-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  letter-spacing: 0.04em;
  color: #FFFFFF;
  margin-bottom: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.requester {
  font-family: 'MiSans', sans-serif;
  font-weight: normal;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  text-align: left;
}

/* 热度样式 */
.action-area {
  position: absolute;
  top: 50%;
  right: 1rem;
  transform: translateY(-50%);
  display: flex;
  flex-direction: row;
  align-items: center;
}

.vote-count {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.vote-count .count {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 20px;
  color: #0B5AFE;
  text-shadow: 0px 20px 30px rgba(0, 114, 248, 0.5), 
               0px 8px 15px rgba(0, 114, 248, 0.5),
               0px 4px 10px rgba(0, 179, 248, 0.3), 
               0px 2px 10px rgba(0, 179, 248, 0.2), 
               inset 3px 3px 10px rgba(255, 255, 255, 0.4), 
               inset -1px -1px 15px rgba(255, 255, 255, 0.4);
}

.vote-count .label {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: #FFFFFF;
  opacity: 0.4;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .schedule-list {
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden;
  }
  
  .schedule-container {
    flex-direction: column;
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  
  .date-selector {
    width: 100% !important;
    max-width: 100% !important;
    margin-bottom: 1rem;
    padding: 0 !important;
  }
  
  /* 显示移动端日期导航 */
  .mobile-date-nav {
    display: flex !important;
    width: 100% !important;
    position: relative;
    z-index: 10;
    box-sizing: border-box;
    max-width: 100% !important;
    min-width: auto !important;
    margin: 0 !important;
    padding: 0.75rem 1rem !important;
    border-radius: 10px !important;
  }
  
  /* 隐藏桌面端日期列表，但确保元素存在 */
  .date-list {
    height: 0;
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    position: absolute;
  }
  
  .scroll-indicator-container {
    display: none;
  }
  
  .mobile-scroll-hint {
    display: none;
  }
  
  .vertical-divider {
    display: none;
  }
  
  .schedule-content {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    box-sizing: border-box;
  }
  
  .schedule-header {
    display: none; /* 隐藏桌面端日期标题 */
  }
  
  .song-cards {
    gap: 0.75rem;
  }
  
  /* 修复电影卡片布局 */
  .song-card-main {
    height: auto;
    min-height: 70px;
    padding: 0.75rem;
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
  }

  .song-info {
    flex: 1;
    min-width: 0;
  }

  .action-area {
    position: static;
    transform: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .playtime-header h4 {
    font-size: 15px;
    text-align: center;
  }
  
  /* 确保加载状态在移动端正确显示 */
  .loading, .error, .empty {
    padding: 2rem 1rem;
    width: 100%;
  }
}

/* 小屏幕设备额外优化 */
@media (max-width: 480px) {
  .current-date-mobile {
    font-size: 14px;
  }
  
  .date-nav-btn {
    width: 32px;
    height: 32px;
  }
  
  /* 移动端日期导航强化样式 */
  .mobile-date-nav {
    background: linear-gradient(135deg, #21242D 0%, #2C3039 100%);
    box-shadow: 0px 5px 15px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.05);
    margin-bottom: 1.5rem;
    padding: 1rem;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    box-sizing: border-box;
    border-radius: 10px !important;
  }
  
  .song-info {
    width: 70%;
  }
  
  .song-title {
    font-size: 14px;
  }
  
  .requester {
    font-size: 11px;
  }
  
  .vote-count .count {
    font-size: 18px;
  }
  
  .vote-count .label {
    font-size: 10px;
  }
}

/* 添加日期切换过渡动画 */
.schedule-fade-enter-active,
.schedule-fade-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.schedule-fade-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.schedule-fade-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

/* 波纹效果样式 */
.ripple-effect {
  position: absolute;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
  transform: scale(0);
  animation: ripple 0.6s linear;
  pointer-events: none;
  width: 100px;
  height: 100px;
  margin-left: -50px;
  margin-top: -50px;
}

@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

/* 左侧日期选择器 - 移除背景和边框 */
.date-selector {
  width: 200px;
  flex-shrink: 0;
}

.date-list {
  max-height: 500px;
  overflow-y: auto;
}

/* 移动端滑动提示 */
.mobile-scroll-hint {
  display: none;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 0.5rem;
}

/* 滚动指示器 */
.scroll-indicator-container {
  display: none;
  width: 100%;
  height: 2px;
  background-color: rgba(255, 255, 255, 0.1);
  margin-top: 0.5rem;
  border-radius: 1px;
  overflow: hidden;
}

.scroll-indicator {
  height: 100%;
  width: 20%;
  background-color: rgba(11, 90, 254, 0.6);
  border-radius: 1px;
  animation: scroll-hint 1.5s infinite;
}

@keyframes scroll-hint {
  0% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(400%);
  }
  100% {
    transform: translateX(0);
  }
}

/* 移动端日期导航 */
.mobile-date-nav {
  display: none;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  background: #21242D;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  position: relative;
  z-index: 10;
  min-width: 100%;
}

.date-nav-btn {
  background: rgba(11, 90, 254, 0.1);
  border: 1px solid rgba(11, 90, 254, 0.2);
  color: #FFFFFF;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.date-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.date-nav-btn:hover:not(:disabled) {
  background: rgba(11, 90, 254, 0.2);
}

.current-date-mobile {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #FFFFFF;
  text-align: center;
  flex: 1;
  white-space: pre-line;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.current-date-mobile:after {
  content: "▼";
  font-size: 10px;
  opacity: 0.7;
  margin-left: 5px;
  display: inline-block;
  vertical-align: middle;
}

.current-date-mobile:hover {
  color: #0B5AFE;
}

/* 日期选择器弹窗样式 */
.date-picker-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: center;
}

.date-picker-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
}

.date-picker-content {
  position: relative;
  width: 85%;
  max-width: 350px;
  max-height: 70vh;
  background: #1A1D24;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  animation: scale-in 0.2s ease;
  display: flex;
  flex-direction: column;
}

.date-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.date-picker-header h3 {
  margin: 0;
  font-size: 16px;
  color: white;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 22px;
  cursor: pointer;
  padding: 0 5px;
  line-height: 1;
}

.date-picker-list {
  padding: 1rem;
  overflow-y: auto;
  max-height: 60vh;
}

.date-picker-item {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;
  white-space: pre-line;
}

.date-picker-item:hover {
  background: rgba(11, 90, 254, 0.1);
  transform: translateY(-2px);
}

.date-picker-item.active {
  background: rgba(11, 90, 254, 0.2);
  border-left: 3px solid #0B5AFE;
}

/* 过渡动画 */
.date-picker-fade-enter-active,
.date-picker-fade-leave-active {
  transition: opacity 0.2s ease;
}

.date-picker-fade-enter-from,
.date-picker-fade-leave-to {
  opacity: 0;
}

@keyframes scale-in {
  0% {
    transform: scale(0.9);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>