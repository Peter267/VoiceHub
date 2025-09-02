<template>
  <div class="request-form">
    <div class="rules-section">
      <h2 class="section-title">投稿须知</h2>
      <div class="rules-content">
        <div v-if="submissionGuidelines" class="guidelines-content" v-html="submissionGuidelines.replace(/\n/g, '<br>')"></div>
        <div v-else class="default-guidelines">
          <p>1. 投稿时无需加入书名号</p>
          <p>2. 除DJ外，其他类型电影均接收（包括小语种）</p>
          <p>3. 禁止投递含有违规内容的电影</p>
          <p>4. 点播的电影将由管理员进行审核</p>
          <p>5. 审核通过后将安排在播放时段播出</p>
          <p>6. 提交即表明我已阅读投稿须知并已知该电影有概率无法播出</p>
          <p>7. 本系统仅提供音乐搜索和播放管理功能，不存储任何音乐文件。所有音乐内容均来自第三方音乐平台，版权归原平台及版权方所有。用户点播时请确保遵守相关音乐平台的服务条款，尊重音乐作品版权。我们鼓励用户支持正版音乐，在官方平台购买和收听喜爱的音乐作品。</p>
          <p>8. 最终解释权归广播站所有</p>
        </div>
      </div>
    </div>

    <div class="form-container">
      <form @submit.prevent="handleSearch" class="song-request-form">
        <!-- 电影搜索区域 -->
        <div class="search-section">
          <div class="search-label">电影搜索</div>
          <div class="search-input-group">
            <input
              id="title"
              v-model="title"
              type="text"
              required
              placeholder="请输入电影名称"
              class="search-input"
              @input="checkSimilarSongs"
            />
            <button type="submit" :disabled="loading || searching || !title.trim()" class="search-button">
              {{ loading || searching ? '处理中...' : '搜索' }}
            </button>
          </div>
        </div>

        <!-- 搜索结果容器 -->
        <div class="search-results-container">
          <!-- 投稿状态显示 - 横向布局，只在设置了限额时显示 -->
          <div v-if="user && submissionStatus && submissionStatus.limitEnabled" class="submission-status-horizontal">
            <!-- 超级管理员提示 -->
            <div v-if="user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')" class="admin-notice-horizontal">
              <span class="admin-icon">👑</span>
              <span class="admin-text">您是管理员，不受投稿限制</span>
            </div>
            
            <!-- 投稿关闭提示 -->
            <div v-else-if="submissionStatus.submissionClosed" class="submission-closed-notice">
              <span class="closed-icon">🚫</span>
              <span class="closed-text">投稿功能已关闭</span>
            </div>
            
            <!-- 投稿状态内容 -->
            <div v-else class="status-content-horizontal">
              <div v-if="submissionStatus.dailyLimit" class="status-item-horizontal">
                <span class="status-label">今日投稿：</span>
                <span class="status-value">{{ submissionStatus.dailyUsed }} / {{ submissionStatus.dailyLimit }}</span>
                <span class="status-remaining">剩余 {{ Math.max(0, submissionStatus.dailyLimit - submissionStatus.dailyUsed) }}</span>
              </div>
              
              <div v-if="submissionStatus.weeklyLimit" class="status-item-horizontal">
                <span class="status-label">本周投稿：</span>
                <span class="status-value">{{ submissionStatus.weeklyUsed }} / {{ submissionStatus.weeklyLimit }}</span>
                <span class="status-remaining">剩余 {{ Math.max(0, submissionStatus.weeklyLimit - submissionStatus.weeklyUsed) }}</span>
              </div>
            </div>
          </div>

          <!-- 音乐平台选择按钮 -->
          <div class="platform-selection">
            <button
              type="button"
              :class="['platform-btn', { active: platform === 'netease' }]"
              @click="switchPlatform('netease')"
            >
              网易云音乐
            </button>
            <button
              type="button"
              :class="['platform-btn', { active: platform === 'tencent' }]"
              @click="switchPlatform('tencent')"
            >
              QQ音乐
            </button>
          </div>



          <div class="results-content">
            <!-- 加载状态 -->
            <div v-if="searching" class="loading-state">
              <div class="loading-spinner"></div>
              <p class="loading-text">处理中...</p>
            </div>

            <!-- 搜索结果列表 -->
            <Transition name="results-fade" mode="out-in">
              <div v-if="searchResults.length > 0 && !searching" class="results-list" key="results">
                <TransitionGroup name="result-item" tag="div" class="results-grid">
                  <div
                    v-for="(result, index) in searchResults"
                    :key="`${platform}-${result.id || index}`"
                    class="result-item"
                  >
                    <div class="result-cover">
                      <img :src="convertToHttps(result.cover)" alt="封面" class="cover-img" />
                      <div class="play-overlay" @click.stop="playSong(result)">
                        <div class="play-button-bg">
                          <Icon name="play" :size="24" color="white" />
                        </div>
                      </div>
                    </div>
                    <div class="result-info">
                      <h4 class="result-title">{{ result.song || result.title }}</h4>
                      <p class="result-artist">{{ result.singer || result.artist }}</p>
                      <p class="result-album" v-if="result.album">专辑：{{ result.album }}</p>
                    </div>
                    <div class="result-actions">
                      <!-- 检查是否已存在相似电影 -->
                      <div v-if="getSimilarSong(result)" class="similar-song-info">
                        <!-- 根据电影状态显示不同的文本 -->
                        <span v-if="getSimilarSong(result)?.played" class="similar-text status-played">电影已播放</span>
                        <span v-else-if="getSimilarSong(result)?.scheduled" class="similar-text status-scheduled">电影已排期</span>
                        <span v-else class="similar-text">电影已存在</span>
                        
                        <!-- 始终显示点赞按钮，但根据状态设置不同样式 -->
                        <button
                          class="like-btn"
                          :class="{
                            'disabled': getSimilarSong(result)?.played || getSimilarSong(result)?.scheduled || getSimilarSong(result)?.voted || submitting
                          }"
                          @click.stop.prevent="getSimilarSong(result)?.played || getSimilarSong(result)?.scheduled ? null : handleLikeFromSearch(getSimilarSong(result))"
                          :disabled="getSimilarSong(result)?.played || getSimilarSong(result)?.scheduled || getSimilarSong(result)?.voted || submitting"
                          :title="
                            getSimilarSong(result)?.played ? '已播放的电影不能点赞' :
                            getSimilarSong(result)?.scheduled ? '已排期的电影不能点赞' :
                            getSimilarSong(result)?.voted ? '已点赞' : '点赞'
                          "
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                          </svg>
                          {{ 
                            getSimilarSong(result)?.played ? '已播放' :
                            getSimilarSong(result)?.scheduled ? '已排期' :
                            getSimilarSong(result)?.voted ? '已点赞' : '点赞' 
                          }}
                        </button>
                      </div>
                      <button
                        v-else
                        class="select-btn"
                        :disabled="submitting"
                        @click.stop.prevent="submitSong(result)"
                      >
                        {{ submitting ? '投稿中...' : '选择投稿' }}
                      </button>
                    </div>
                  </div>
                </TransitionGroup>

                <!-- 手动输入按钮 -->
                <div class="no-results-action">
                  <button
                    type="button"
                    class="manual-submit-btn"
                    @click="showManualModal = true"
                  >
                    以上没有我想要的电影，手动输入提交
                  </button>
                </div>
              </div>

              <!-- 空状态 -->
              <div v-else-if="!searching && hasSearched" class="empty-state" key="empty">
                <div class="empty-icon">🔍</div>
                <p class="empty-text">未找到相关电影</p>
                <p class="empty-hint">试试其他关键词或切换平台</p>
                <button
                  type="button"
                  class="manual-submit-btn"
                  @click="showManualModal = true"
                >
                  手动输入提交
                </button>
              </div>

              <!-- 初始状态 -->
              <div v-else-if="!searching" class="initial-state" key="initial">
                <div class="search-illustration">
                  <img src="/public/images/search.svg" alt="搜索电影" class="search-svg" />
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- 播出时段选择 -->
        <div
          v-if="playTimeSelectionEnabled && playTimes.length > 0"
          class="form-group"
        >
          <label for="playTime">期望播出时段</label>
          <div class="input-wrapper">
            <select id="playTime" v-model="preferredPlayTimeId" class="form-select">
              <option value="">选择时段</option>
              <option
                v-for="playTime in enabledPlayTimes"
                :key="playTime.id"
                :value="playTime.id"
              >
                {{ playTime.name }}
                <template v-if="playTime.startTime || playTime.endTime">
                  ({{ formatPlayTimeRange(playTime) }})
                </template>
              </option>
            </select>
          </div>
        </div>
      </form>

      <div v-if="similarSongs.length > 0" class="similar-song-alert">
        <div class="alert-header">
          <div class="alert-header-left">
            <Icon name="warning" :size="16" class="alert-icon" />
            <span class="alert-title">发现可能相似的电影</span>
          </div>
          <!-- 宽屏时显示在右上角的继续投稿按钮 -->
          <button type="button" class="ignore-btn desktop-continue-btn" @click="ignoreSimilar" :disabled="submitting">
            继续投稿
          </button>
        </div>
        <div class="similar-songs-list">
          <div v-for="song in similarSongs" :key="song.id" class="similar-song-item">
            <div class="song-info">
              <p class="song-title">
                《{{ song.title }} - {{ song.artist }}》
                <span v-if="song.played" class="song-status status-played">已播放</span>
                <span v-else-if="song.scheduled" class="song-status status-scheduled">已排期</span>
              </p>
              <!-- 根据电影状态显示不同的提示 -->
              <p v-if="song.played" class="alert-hint">该电影已播放，无法进行投票操作</p>
              <p v-else-if="song.scheduled" class="alert-hint">该电影已排期，无法进行投票操作</p>
              <p v-else-if="!song.voted" class="alert-hint">该电影已在列表中，是否要投票支持？</p>
              <p v-else-if="song.voted" class="voted-status">
                <Icon name="success" :size="14" style="margin-right: 4px;" />
                您已为此电影投票
              </p>
            </div>
            <!-- 只有在电影未排期、未播放且未投票时才显示投票按钮 -->
            <div v-if="!song.voted && !song.played && !song.scheduled" class="song-actions">
              <button
                type="button"
                class="vote-btn small"
                @click="voteForSimilar(song)"
                :disabled="voting || submitting"
              >
                {{ voting ? '投票中...' : '投票支持' }}
              </button>
            </div>
          </div>
        </div>
        <!-- 移动端时显示在底部的继续投稿按钮 -->
        <div class="alert-actions mobile-continue-actions">
          <button type="button" class="ignore-btn mobile-continue-btn" @click="ignoreSimilar" :disabled="submitting">
            继续投稿
          </button>
        </div>
      </div>

    </div>

    <!-- 重复电影弹窗 -->
    <DuplicateSongModal
      :show="showDuplicateModal"
      :song="duplicateSong"
      @close="closeDuplicateModal"
      @like="handleLikeDuplicate"
    />

    <!-- 手动输入弹窗 -->
    <Teleport to="body">
      <Transition name="modal-animation">
        <div v-if="showManualModal" class="modal-overlay" @click.self="showManualModal = false">
          <div class="modal-content">
            <div class="modal-header">
              <h3>手动输入电影信息</h3>
              <button @click="showManualModal = false" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label for="modal-title">电影名称</label>
                <div class="input-wrapper">
                  <input
                    id="modal-title"
                    :value="title"
                    type="text"
                    readonly
                    class="form-input readonly"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="modal-artist">豆瓣链接名称</label>
                <div class="input-wrapper">
                  <input
                    id="modal-artist"
                    v-model="manualArtist"
                    type="text"
                    required
                    placeholder="请输入豆瓣链接名称"
                    class="form-input"
                  />
                </div>
              </div>

              <div class="modal-actions">
                <button
                  type="button"
                  class="btn btn-secondary"
                  @click="showManualModal = false"
                >
                  取消
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  @click="handleManualSubmit"
                  :disabled="!manualArtist.trim() || submitting"
                >
                  {{ submitting ? '提交中...' : '确认提交' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useSongs } from '~/composables/useSongs'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useSiteConfig } from '~/composables/useSiteConfig'
import { useAuth } from '~/composables/useAuth'
import { useSemesters } from '~/composables/useSemesters'
import { useMusicSources } from '~/composables/useMusicSources'
import { getEnabledSources } from '~/utils/musicSources'
import DuplicateSongModal from './DuplicateSongModal.vue'
import Icon from '../UI/Icon.vue'
import { convertToHttps } from '~/utils/url'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['request', 'vote'])

// 站点配置
const { guidelines: submissionGuidelines, initSiteConfig } = useSiteConfig()

// 用户认证
const auth = useAuth()
const user = computed(() => auth.user.value)

// 学期管理
const { fetchCurrentSemester, currentSemester } = useSemesters()

const title = ref('')
const artist = ref('')
const platform = ref('tencent') // 默认使用QQ音乐
const preferredPlayTimeId = ref('')
const error = ref('')
const success = ref('')
const submitting = ref(false)
const voting = ref(false)
const similarSongs = ref([])
const songService = useSongs()
const playTimes = ref([])
const playTimeSelectionEnabled = ref(false)
const loadingPlayTimes = ref(false)

// 投稿状态
const submissionStatus = ref(null)
const loadingSubmissionStatus = ref(false)

// 重复电影弹窗相关
const showDuplicateModal = ref(false)
const duplicateSong = ref(null)

// 搜索相关
const searching = ref(false)
const searchResults = ref([])
const selectedCover = ref('')
const selectedUrl = ref('')
const audioPlayer = useAudioPlayer() // 使用全局音频播放器

// 搜索请求控制器
const searchAbortController = ref(null)

// 音源管理器
const musicSources = useMusicSources()
const { 
  currentSource, 
  sourceStatus, 
  sourceStatusSummary, 
  currentSourceInfo 
} = musicSources
const searchError = ref('')

// 手动输入相关
const showManualModal = ref(false)
const manualArtist = ref('')
const hasSearched = ref(false)

// 获取播出时段
const fetchPlayTimes = async () => {
  loadingPlayTimes.value = true
  try {
    const response = await fetch('/api/play-times')
    if (response.ok) {
      const data = await response.json()
      playTimes.value = data.playTimes || []
      playTimeSelectionEnabled.value = data.enabled || false
    }
  } catch (err) {
    console.error('获取播出时段失败:', err)
  } finally {
    loadingPlayTimes.value = false
  }
}

onMounted(async () => {
  fetchPlayTimes()
  initSiteConfig()
  fetchSubmissionStatus()
  // 获取当前学期
  await fetchCurrentSemester()
  // 只有在用户已登录时才加载电影列表以便检查相似电影
  if (auth.isAuthenticated.value) {
    try {
      const currentSemesterName = currentSemester.value?.name
      await songService.fetchSongs(false, currentSemesterName)
    } catch (error) {
      console.error('加载电影列表失败:', error)
    }
  }
  // 音源健康检查功能已移除
})

// 过滤出启用的播出时段
const enabledPlayTimes = computed(() => {
  return playTimes.value.filter((pt) => pt.enabled)
})

// 格式化播出时段时间范围
const formatPlayTimeRange = (playTime) => {
  if (!playTime) return ''

  if (playTime.startTime && playTime.endTime) {
    return `${playTime.startTime} - ${playTime.endTime}`
  } else if (playTime.startTime) {
    return `${playTime.startTime} 开始`
  } else if (playTime.endTime) {
    return `${playTime.endTime} 结束`
  }

  return '不限时间'
}

// 监听电影服务中的相似电影
watch(
  () => songService.similarSongFound.value,
  (newVal) => {
    // 保持兼容性，如果有相似电影，将其放入数组
    if (newVal) {
      similarSongs.value = [newVal]
    } else {
      similarSongs.value = []
    }
  }
)

// 监听用户状态变化，当用户登录后重新获取投稿状态
watch(
  () => user.value,
  (newUser) => {
    if (newUser) {
      fetchSubmissionStatus()
    } else {
      submissionStatus.value = null
    }
  }
)

// 检查相似电影
const checkSimilarSongs = async () => {
  if (title.value.trim().length > 2) {
    console.log('检查相似电影:', title.value, artist.value)
    const similar = await songService.checkSimilarSongs(
      title.value.trim(),
      artist.value.trim()
    )
    console.log('相似电影结果:', similar, songService.similarSongFound.value)
    similarSongs.value = similar
  } else {
    similarSongs.value = []
  }
}

// 投票支持相似电影
const voteForSimilar = async (song) => {
  if (!song || song.voted) return

  voting.value = true
  try {
    // 直接调用songService的投票方法，避免重复处理
    await songService.voteSong(song.id)
    
    // 更新本地状态
    song.voted = true
    song.voteCount = (song.voteCount || 0) + 1
    
    // 投票成功后刷新电影列表
    setTimeout(() => {
      songService.refreshSongsSilent().catch(err => {
        console.error('刷新电影列表失败', err)
      })
    }, 500)
    
    // 清除表单并隐藏提示
    title.value = ''
    artist.value = ''
    similarSongs.value = []
  } catch (err) {
    error.value = err.message || '投票失败，请稍后重试'
    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }
  } finally {
    voting.value = false
  }
}

// 忽略相似电影，继续投稿
const ignoreSimilar = () => {
  similarSongs.value = []
}



// 检查搜索结果是否已存在完全匹配的电影
// 标准化字符串（与useSongs中的逻辑保持一致）
const normalizeString = (str) => {
  return str
    .toLowerCase()
    .replace(/[\s\-_\(\)\[\]【】（）「」『』《》〈〉""''""''、，。！？：；～·]/g, '')
    .replace(/[&＆]/g, 'and')
    .replace(/[feat\.?|ft\.?]/gi, '')
    .trim()
}

const getSimilarSong = (result) => {
  const title = result.song || result.title
  const artist = result.singer || result.artist
  
  if (!title || !artist) return null
  
  const normalizedTitle = normalizeString(title)
  const normalizedArtist = normalizeString(artist)
  
  // 获取当前学期名称
  const currentSemesterName = currentSemester.value?.name
  
  // 检查完全匹配的电影（标准化后），只检查当前学期的电影
  return songService.songs.value.find(song => {
    const songTitle = normalizeString(song.title)
    const songArtist = normalizeString(song.artist)
    const titleMatch = songTitle === normalizedTitle && songArtist === normalizedArtist
    
    // 如果有当前学期信息，只检查当前学期的电影
    if (currentSemesterName) {
      return titleMatch && song.semester === currentSemesterName
    }
    
    // 如果没有学期信息，检查所有电影（向后兼容）
    return titleMatch
  })
}

// 从搜索结果中点赞已存在的电影
const handleLikeFromSearch = async (song) => {
  if (!song || song.voted) {
    return
  }
  
  // 检查电影状态
  if (song.played || song.scheduled) {
    if (window.$showNotification) {
      const message = song.played ? '已播放的电影不能点赞' : '已排期的电影不能点赞'
      window.$showNotification(message, 'warning')
    }
    return
  }
  
  try {
    await songService.voteSong(song.id)
    // songService.voteSong 已经包含了成功提示，这里不需要重复显示
  } catch (error) {
    // 错误提示由 songService.voteSong 处理，这里不需要重复显示
    console.error('点赞失败:', error)
  }
}

// 关闭重复电影弹窗
const closeDuplicateModal = () => {
  showDuplicateModal.value = false
  duplicateSong.value = null
}

// 处理重复电影弹窗中的点赞
const handleLikeDuplicate = async (songId) => {
  try {
    await songService.voteSong(songId)
    if (window.$showNotification) {
      window.$showNotification(`点赞成功！`, 'success')
    }
    closeDuplicateModal()
  } catch (error) {
    if (window.$showNotification) {
      window.$showNotification('点赞失败，请稍后重试', 'error')
    }
  }
}

// 平台切换函数
const switchPlatform = (newPlatform) => {
  if (platform.value === newPlatform) return

  // 如果有正在进行的搜索请求，立即取消
  if (searchAbortController.value) {
    searchAbortController.value.abort()
    searchAbortController.value = null
    searching.value = false
  }

  platform.value = newPlatform

  // 清空之前的搜索结果，避免显示错误的平台来源
  searchResults.value = []
  
  // 如果已经有搜索结果，自动重新搜索
  if (title.value.trim() && hasSearched.value) {
    handleSearch()
  }
}

// 搜索电影
const handleSearch = async () => {
  error.value = ''
  success.value = ''
  searchError.value = ''

  if (!title.value.trim()) {
    error.value = '电影名称不能为空'
    if (window.$showNotification) {
      window.$showNotification('电影名称不能为空', 'error')
    }
    return
  }

  // 如果有正在进行的搜索请求，先取消
  if (searchAbortController.value) {
    searchAbortController.value.abort()
    searchAbortController.value = null
  }

  // 创建新的AbortController
  searchAbortController.value = new AbortController()
  const signal = searchAbortController.value.signal

  searching.value = true
  try {
    // 使用多音源搜索
    const searchParams = {
      keywords: title.value.trim(),
      platform: platform.value,
      limit: 20,
      signal: signal // 传递AbortSignal
    }

    console.log('开始多音源搜索:', searchParams)
    const results = await musicSources.searchSongs(searchParams)
    
    if (results && results.success && results.data && results.data.length > 0) {
      // 转换搜索结果格式以兼容现有UI
      searchResults.value = results.data.map((item) => ({
        ...item,
        musicId: item.id,
        hasUrl: false,
        // 统一字段名称
        song: item.title || item.song,
        singer: item.artist || item.singer,
        // 保存实际的平台来源信息
        actualSource: results.source,
        actualMusicPlatform: item.musicPlatform || (results.source === 'netease-backup' ? 'netease' : results.source)
      }))
      
      console.log('搜索成功，找到', results.data.length, '首电影')
    } else {
      searchResults.value = []
      const errorMsg = results && results.error ? results.error : '没有找到匹配的电影'
      error.value = errorMsg
      if (window.$showNotification) {
        window.$showNotification(errorMsg, 'info')
      }
    }
  } catch (err) {
    // 如果请求被取消，不显示错误信息
    if (err.name === 'AbortError' || signal.aborted) {
      console.log('搜索请求已被取消')
      return
    }
    
    console.error('搜索错误:', err)
    searchError.value = err.message || '搜索请求失败，请稍后重试'
    error.value = searchError.value
    
    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }
  } finally {
    // 只有在请求没有被取消的情况下才更新状态
    if (!signal.aborted) {
      searching.value = false
      hasSearched.value = true
      // 清理AbortController
      searchAbortController.value = null
    }
  }
}

// 获取音乐播放URL
const getAudioUrl = async (result) => {
  if (result.hasUrl || result.url) return result

  try {
    // 根据搜索结果的sourceInfo.source字段判断音源类型
    const sourceType = result.sourceInfo?.source || ''
    console.log('获取音频URL，音源类型:', sourceType, '电影ID:', result.musicId || result.id)
    console.log('完整的result对象:', result)
    
    // 对于vkeys音源的处理
    if (sourceType === 'vkeys') {
      if (result.url) {
        result.hasUrl = true
        console.log('Vkeys音源直接使用URL:', result.url)
        return result
      } else {
        console.warn('Vkeys音源结果中没有找到URL字段，根据平台尝试备用源')
        
        // 根据平台直接尝试对应的备用源
        if (platform.value === 'tencent') {
          console.log('QQ音乐平台，直接使用vkeys的tencent/geturl接口获取播放链接')
          try {
            const songId = result.musicId || result.id
            
            // 构建QQ音乐geturl请求参数，使用id而不是mid
            const params = new URLSearchParams()
            if (songId) {
              params.append('id', songId)
            } else {
              throw new Error('缺少电影ID参数')
            }
            params.append('quality', '8') // QQ音乐默认音质为8(HQ高音质)
            
            // 获取vkeys音源配置
            const enabledSources = getEnabledSources()
            const vkeysSource = enabledSources.find(source => source.id === 'vkeys')
            
            if (!vkeysSource) {
              throw new Error('未找到vkeys音源配置')
            }
            
            const getUrlResponse = await $fetch(`${vkeysSource.baseUrl}/tencent/geturl?${params.toString()}`, {
              timeout: vkeysSource.timeout || 8000
            })
            
            console.log('QQ音乐geturl返回结果:', getUrlResponse)
            
            if (getUrlResponse && getUrlResponse.code === 200 && getUrlResponse.data && getUrlResponse.data.url) {
              result.url = getUrlResponse.data.url
              result.hasUrl = true
              // 更新其他信息
              if (getUrlResponse.data.cover) result.cover = getUrlResponse.data.cover
              if (getUrlResponse.data.song) result.title = getUrlResponse.data.song
              if (getUrlResponse.data.singer) result.artist = getUrlResponse.data.singer
              console.log('成功获取电影URL (QQ音乐geturl):', getUrlResponse.data.url)
              return result
            } else {
              console.warn('QQ音乐geturl无法获取URL:', getUrlResponse)
            }
          } catch (qqError) {
            console.error('QQ音乐geturl获取URL失败:', qqError)
          }
        } else if (platform.value === 'netease') {
          console.log('网易云平台，尝试使用getSongDetail获取')
          try {
            const { getQuality } = useAudioQuality()
            const quality = getQuality(platform.value)
            const songDetail = await musicSources.getSongDetail({
              ids: [result.musicId || result.id],
              quality: quality
            })
            
            if (songDetail && songDetail.url) {
              result.url = songDetail.url
              result.hasUrl = true
              if (songDetail.cover) result.cover = songDetail.cover
              if (songDetail.duration) result.duration = songDetail.duration
              console.log('成功获取电影URL (vkeys getSongDetail):', songDetail.url)
              return result
            }
          } catch (error) {
            console.error('vkeys getSongDetail失败:', error)
          }
          
          // 如果getSongDetail失败，尝试网易云备用源
          console.log('vkeys失败，尝试使用网易云备用源获取播放链接')
          try {
            const { getQuality } = useAudioQuality()
            const quality = getQuality(platform.value)
            const songId = result.musicId || result.id
            
            const urlResult = await musicSources.getSongUrl(songId, quality)
            console.log('网易云备用源返回结果:', urlResult)
            
            if (urlResult && urlResult.success && urlResult.url) {
              result.url = urlResult.url
              result.hasUrl = true
              console.log('成功获取电影URL (网易云备用源):', urlResult.url)
              return result
            } else {
              console.warn('网易云备用源也无法获取URL:', urlResult)
            }
          } catch (backupError) {
            console.error('网易云备用源获取URL失败:', backupError)
          }
        }
      }
    }
    
    // 对于网易云备用源，直接调用getSongUrl获取播放链接
    if (sourceType === 'netease-backup') {
      console.log('检测到网易云备用源，开始获取播放链接')
      const { getQuality } = useAudioQuality()
      const quality = getQuality(platform.value)
      const songId = result.musicId || result.id

      console.log('调用getSongUrl，参数:', { songId, quality })
      try {
        const urlResult = await musicSources.getSongUrl(songId, quality)
        console.log('getSongUrl返回结果:', urlResult)
        
        if (urlResult && urlResult.success && urlResult.url) {
          // 更新结果中的URL和其他信息
          result.url = urlResult.url
          result.hasUrl = true
          
          // 更新搜索结果中的对应项
          const index = searchResults.value.findIndex(
            (item) => (item.musicId || item.id) === (result.musicId || result.id)
          )
          if (index !== -1) {
            searchResults.value[index] = { ...result }
          }
          
          console.log('成功获取电影URL (网易云备用源):', urlResult.url)
        } else {
          console.warn('未能获取到有效的电影URL，urlResult:', urlResult)
          if (urlResult && urlResult.error) {
            console.error('getSongUrl错误:', urlResult.error)
          }
        }
      } catch (urlError) {
        console.error('调用getSongUrl失败:', urlError)
      }
    }

    return result
  } catch (err) {
    console.error('获取音乐URL错误:', err)
    error.value = '获取音乐URL失败，请稍后重试'
    if (window.$showNotification) {
      window.$showNotification('获取音乐URL失败，请稍后重试', 'error')
    }
    return result
  }
}

// 播放电影
const playSong = async (result) => {
  // 如果还没有获取URL，先获取
  if (!result.hasUrl && !result.url) {
    result = await getAudioUrl(result)
  }

  // 如果没有URL，提示错误
  if (!result.url) {
    error.value = '该电影无法播放，可能是付费内容'
    if (window.$showNotification) {
      window.$showNotification('该电影无法播放，可能是付费内容', 'error')
    }
    return
  }

  // 准备播放所需的数据
  const song = {
    id: result.musicId || Date.now(),
    title: result.song || result.title,
    artist: result.singer || result.artist,
    cover: result.cover || null,
    musicUrl: result.url,
    musicPlatform: platform.value,
    musicId: result.musicId ? String(result.musicId) : null,
  }

  // 使用全局播放器播放电影
  audioPlayer.playSong(song)

  // 如果有音乐平台信息，请求歌词
  if (song.musicPlatform && song.musicId) {
    try {
      const { useLyrics } = await import('~/composables/useLyrics')
      const lyrics = useLyrics()
      // 请求歌词
      await lyrics.fetchLyrics(song.musicPlatform, song.musicId)
    } catch (error) {
      console.error('获取歌词失败:', error)
    }
  }
}

// 选择搜索结果
const selectResult = async (result) => {
  // 防止重复点击和事件冒泡
  event?.stopPropagation()

  // 先获取完整信息
  if (!result.hasUrl) {
    result = await getAudioUrl(result)
  }

  // 标准化属性名称（处理不同API返回格式的差异）
  const songTitle = result.song || result.title
  const singerName = result.singer || result.artist

  title.value = songTitle
  artist.value = singerName
  selectedCover.value = result.cover || ''
  selectedUrl.value = result.url || ''

  // 如果没有URL，给出提示
  if (!result.url) {
    success.value = '已选择电影，但可能无法播放完整版本'
    if (window.$showNotification) {
      window.$showNotification('已选择电影，但可能无法播放完整版本', 'info')
    }
  }

  console.log('已选择电影:', songTitle, '- 填充表单但不自动提交')
}

// 提交选中的电影
const submitSong = async (result) => {
  // 防止重复点击和重复提交
  if (submitting.value) return
  console.log('执行submitSong，提交电影:', result.title || result.song)

  // 检查投稿限额
  const limitCheck = checkSubmissionLimit()
  if (!limitCheck.canSubmit) {
    error.value = limitCheck.message
    if (window.$showNotification) {
      window.$showNotification(limitCheck.message, 'error')
    }
    return
  }

  // 使用搜索结果中的数据
  const songTitle = result.song || result.title
  const songArtist = result.singer || result.artist

  // 只有在用户已登录且电影列表已加载时才检查是否已存在完全匹配的电影
  if (auth.isAuthenticated.value && songService.songs.value && songService.songs.value.length > 0) {
    const existingSong = songService.songs.value.find(song => 
      song.title.toLowerCase() === songTitle.toLowerCase() && 
      song.artist.toLowerCase() === songArtist.toLowerCase()
    )
    if (existingSong) {
      // 显示重复电影弹窗
      duplicateSong.value = existingSong
      showDuplicateModal.value = true
      return
    }
  }

  submitting.value = true
  error.value = ''

  title.value = songTitle
  artist.value = songArtist
  selectedCover.value = result.cover || ''
  selectedUrl.value = result.url || result.file || ''

  try {
    // 检查黑名单
    const blacklistCheck = await $fetch('/api/blacklist/check', {
      method: 'POST',
      body: {
        title: title.value,
        artist: artist.value
      }
    })

    if (blacklistCheck.isBlocked) {
      const reasons = blacklistCheck.reasons.map(r => r.reason).join('; ')
      error.value = `该电影无法点播: ${reasons}`
      if (window.$showNotification) {
        window.$showNotification(error.value, 'error')
      }
      submitting.value = false
      return
    }
  } catch (err) {
    console.error('黑名单检查失败:', err)
    // 黑名单检查失败不阻止提交，只记录错误
  }

  // 确保获取完整的URL
  if (!selectedUrl.value && result.musicId) {
    const fullResult = await getAudioUrl(result)
    selectedUrl.value = fullResult.url || ''
  }

  try {
    // 构建电影数据对象
    const songData = {
      title: title.value,
      artist: artist.value,
      preferredPlayTimeId: preferredPlayTimeId.value
        ? parseInt(preferredPlayTimeId.value)
        : null,
      cover: selectedCover.value,
      musicPlatform: result.actualMusicPlatform || platform.value, // 优先使用搜索结果的实际平台来源
      musicId: result.musicId ? String(result.musicId) : null,
    }

    // 只emit事件，让父组件处理实际的API调用
    emit('request', songData)

    // 成功提示由父组件处理，这里只重置表单
    resetForm()
  } catch (err) {
    error.value = err.message || '投稿失败，请稍后重试'
    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }
  } finally {
    submitting.value = false
  }
}

// 直接提交表单
const handleSubmit = async () => {
  if (submitting.value) return

  // 检查投稿限额
  const limitCheck = checkSubmissionLimit()
  if (!limitCheck.canSubmit) {
    error.value = limitCheck.message
    if (window.$showNotification) {
      window.$showNotification(limitCheck.message, 'error')
    }
    return
  }

  submitting.value = true
  error.value = ''

  try {
    // 构建电影数据对象
    const songData = {
      title: title.value,
      artist: artist.value,
      preferredPlayTimeId: preferredPlayTimeId.value
        ? parseInt(preferredPlayTimeId.value)
        : null,
      cover: selectedCover.value,
      musicPlatform: platform.value,
      musicId: null, // 手动输入时没有musicId
    }

    // 只emit事件，让父组件处理实际的API调用
    emit('request', songData)

    // 成功提示由父组件处理，这里只重置表单
    resetForm()
  } catch (err) {
    error.value = err.message || '投稿失败，请稍后重试'
    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }
  } finally {
    submitting.value = false
  }
}

// 手动输入相关方法
const handleManualSubmit = async () => {
  if (!title.value.trim() || !manualArtist.value.trim()) {
    error.value = '请输入完整的电影信息'
    if (window.$showNotification) {
      window.$showNotification('请输入完整的电影信息', 'error')
    }
    return
  }

  // 检查投稿限额
  const limitCheck = checkSubmissionLimit()
  if (!limitCheck.canSubmit) {
    error.value = limitCheck.message
    if (window.$showNotification) {
      window.$showNotification(limitCheck.message, 'error')
    }
    return
  }

  submitting.value = true
  error.value = ''

  try {
    // 检查黑名单
    const blacklistCheck = await $fetch('/api/blacklist/check', {
      method: 'POST',
      body: {
        title: title.value,
        artist: manualArtist.value
      }
    })

    if (blacklistCheck.isBlocked) {
      const reasons = blacklistCheck.reasons.map(r => r.reason).join('; ')
      error.value = `该电影无法点播: ${reasons}`
      if (window.$showNotification) {
        window.$showNotification(error.value, 'error')
      }
      submitting.value = false
      return
    }
    // 构建电影数据对象
    const songData = {
      title: title.value,
      artist: manualArtist.value,
      preferredPlayTimeId: preferredPlayTimeId.value
        ? parseInt(preferredPlayTimeId.value)
        : null,
      cover: '',
      musicPlatform: platform.value,
      musicId: null, // 手动输入时没有musicId
    }

    // 只emit事件，让父组件处理实际的API调用
    emit('request', songData)

    // 成功提示由父组件处理，这里只重置表单和关闭弹窗
    resetForm()
    showManualModal.value = false
  } catch (err) {
    error.value = err.message || '投稿失败，请稍后重试'
    if (window.$showNotification) {
      window.$showNotification(error.value, 'error')
    }
  } finally {
    submitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  title.value = ''
  artist.value = ''
  preferredPlayTimeId.value = ''
  similarSongs.value = []
  searchResults.value = []
  selectedCover.value = ''
  selectedUrl.value = ''
  showManualModal.value = false
  manualArtist.value = ''
  hasSearched.value = false
}

// 停止播放
const stopPlaying = () => {
  audioPlayer.stopSong()
}

// 获取投稿状态
const fetchSubmissionStatus = async () => {
  if (!user.value) return
  
  loadingSubmissionStatus.value = true
  
  try {
    const authConfig = auth.getAuthConfig()
    const response = await $fetch('/api/songs/submission-status', authConfig)
    submissionStatus.value = response
  } catch (err) {
    console.error('获取投稿状态失败:', err)
  } finally {
    loadingSubmissionStatus.value = false
  }
}

// 检查投稿限额
const checkSubmissionLimit = () => {
  // 超级管理员不受投稿限制
  if (user.value && (user.value.role === 'SUPER_ADMIN' || user.value.role === 'ADMIN')) {
    return { canSubmit: true, message: '' }
  }

  if (!submissionStatus.value || !submissionStatus.value.limitEnabled) {
    return { canSubmit: true, message: '' }
  }

  // 检查投稿是否已关闭
  if (submissionStatus.value.submissionClosed) {
    return { 
      canSubmit: false, 
      message: '投稿功能已关闭' 
    }
  }

  const { dailyLimit, weeklyLimit, dailyUsed, weeklyUsed } = submissionStatus.value

  // 检查日限额
  if (dailyLimit && dailyUsed >= dailyLimit) {
    return { 
      canSubmit: false, 
      message: `今日投稿已达上限 (${dailyUsed}/${dailyLimit})` 
    }
  }

  // 检查周限额
  if (weeklyLimit && weeklyUsed >= weeklyLimit) {
    return { 
      canSubmit: false, 
      message: `本周投稿已达上限 (${weeklyUsed}/${weeklyLimit})` 
    }
  }

  return { canSubmit: true, message: '' }
}

// 暴露方法给父组件
defineExpose({
  refreshSubmissionStatus: fetchSubmissionStatus
})
</script>

<style scoped>
.request-form {
  width: 100%;
  color: #ffffff;
  display: flex;
  gap: 2rem;
  height: calc(100vh - 160px);
  max-height: calc(100vh - 160px);
  overflow: hidden;
}

.rules-section {
  background: rgba(0, 0, 0, 0.4);
  border-radius: 13px;
  padding: 1.5rem;
  width: 40%;
  height: 100%;
  overflow-y: auto;
}

.form-container {
  width: 60%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.song-request-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 1rem;
  position: relative;
}

/* 搜索区域样式 */
.search-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.search-label {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #FFFFFF;
  white-space: nowrap;
}

.search-input-group {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}

.search-input {
  background: #040E15;
  border: 1px solid #242F38;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  flex: 1;
}

.search-input:focus {
  outline: none;
  border-color: #0B5AFE;
}

.search-button {
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  color: #FFFFFF;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.3s ease;
}

.search-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 67, 248, 0.3);
}

.search-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}



.section-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 16px;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 1rem;
}

.rules-content {
  font-family: 'MiSans', sans-serif;
  font-weight: 400;
  font-size: 16px;
  line-height: 1.8;
  letter-spacing: 0.04em;
}

.rules-content p {
  margin-bottom: 0.8rem;
}

.guidelines-content {
  line-height: 1.8;
}

.default-guidelines p {
  margin-bottom: 0.8rem;
}



/* 横向投稿状态样式 */
.submission-status-horizontal {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.admin-notice-horizontal {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
}

.admin-notice-horizontal .admin-icon {
  font-size: 16px;
}

.admin-notice-horizontal .admin-text {
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  font-size: 14px;
  color: #FFD700;
}

.submission-closed-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
}

.submission-closed-notice .closed-icon {
  font-size: 16px;
}

.submission-closed-notice .closed-text {
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  font-size: 14px;
  color: #FF6B6B;
}

.status-content-horizontal {
  display: flex;
  align-items: center;
  gap: 2rem;
  justify-content: center;
  flex-wrap: wrap;
}

.status-item-horizontal {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-item-horizontal .status-label {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #FFFFFF;
}

.status-item-horizontal .status-value {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #0B5AFE;
}

.status-item-horizontal .status-remaining {
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(11, 90, 254, 0.1);
  border: 1px solid rgba(11, 90, 254, 0.3);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
}



.form-row {
  display: flex;
  gap: 1rem;
  width: 100%;
}

.form-row .form-group {
  flex: 1;
  min-width: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0; /* 防止被压缩 */
  position: relative;
  z-index: 10;
}

.form-group label {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 20px;
  letter-spacing: 0.04em;
  color: #ffffff;
}

.input-wrapper {
  width: 100%;
}

.form-input,
.form-select {
  background: #040e15;
  border: 1px solid #242f38;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  width: 100%;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #0b5afe;
}

/* 平台选择按钮样式 */
.platform-selection {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: flex-start;
  flex-shrink: 0;
}

.platform-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.platform-btn.active {
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
  border-color: rgba(255, 255, 255, 0.16);
  color: #FFFFFF;
}

.platform-btn:hover:not(.active) {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

/* 音源状态显示 */
.source-status-display {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
  backdrop-filter: blur(10px);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.status-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  font-family: 'MiSans', sans-serif;
}

.status-summary {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
}

.status-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 12px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
}

.source-item.healthy {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.3);
  color: #4ade80;
}

.source-item.unhealthy {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.source-item.checking {
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.3);
  color: #fbbf24;
}

.source-item.current {
  box-shadow: 0 0 0 2px rgba(11, 90, 254, 0.4);
  transform: scale(1.02);
}

.source-name {
  font-weight: 600;
}

.source-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.source-item.healthy .source-indicator {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
}

.source-item.unhealthy .source-indicator {
  background: #ef4444;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
}

.source-item.checking .source-indicator {
  background: #fbbf24;
  box-shadow: 0 0 6px rgba(251, 191, 36, 0.6);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #f87171;
  font-size: 12px;
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
}

/* 搜索结果容器样式 */
.search-results-container {
  flex: 1;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 13px;
  display: flex;
  flex-direction: column;
  min-height: 400px;
  padding: 1rem 1.5rem 1.5rem 1.5rem; /* 上边距小一点 */
  position: relative;
  z-index: 1;
}

.results-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 1rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(11, 90, 254, 0.2);
  border-top-color: #0B5AFE;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  color: rgba(255, 255, 255, 0.6);
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
  margin: 0;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 搜索结果列表 */
.results-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 200px;
}

.results-grid {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-right: 0.5rem;
  min-height: 200px;
  max-height: 400px;
}

/* 滚动条样式 */
.results-grid::-webkit-scrollbar {
  width: 6px;
}

.results-grid::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.results-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.results-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* 空状态和初始状态 */
.empty-state,
.initial-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  gap: 1rem;
  padding: 2rem;
  min-height: 300px;
}

.empty-icon,
.initial-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.empty-text,
.initial-text {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #FFFFFF;
  margin: 0;
}

.empty-hint,
.initial-hint {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  margin: 0;
}

/* 搜索插图样式 */
.search-illustration {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 200px;
}

.search-svg {
  width: 30%;
  max-width: 400px;
  min-width: 200px;
  height: auto;
  object-fit: contain;
}

/* 手动输入触发按钮 */
.manual-input-trigger {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.manual-submit-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1.5rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #FFFFFF;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manual-submit-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.form-notice {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 0.5rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.submit-button {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1.5rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.3s ease;
}

.submit-button:hover {
  transform: translateY(-2px);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 错误和成功提示现在使用全局通知 */

.similar-song-alert {
  background: #21242d;
  border-radius: 10px;
  padding: 1rem;
  box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
  margin-top: 1rem;
}

.alert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.alert-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.alert-icon {
  color: #f59e0b;
  flex-shrink: 0;
}

.alert-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #ffffff;
}

.alert-content {
  margin-bottom: 1rem;
}

.similar-songs-list {
  margin-bottom: 1rem;
  max-height: 80px; /* 减小高度，防止与搜索结果重叠 */
  overflow-y: auto;
}

.similar-song-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.similar-song-item:last-child {
  border-bottom: none;
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-title {
  margin: 0 0 0.25rem 0;
  font-size: 14px;
  color: #ffffff;
  font-weight: 500;
}

.song-actions {
  margin-left: 1rem;
  flex-shrink: 0;
}

.vote-btn.small {
  padding: 0.3rem 0.6rem;
  font-size: 12px;
}

/* 电影状态样式 */
.song-status {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  margin-left: 0.5rem;
}

.status-played {
  color: #ef4444;
}

.status-scheduled {
  color: #f59e0b;
}

.alert-hint {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  margin-top: 0.5rem;
}

.voted-status {
  color: #10b981;
  font-size: 14px;
  font-weight: 600;
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.alert-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.vote-btn {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.vote-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 67, 248, 0.3);
}

.vote-btn:disabled {
  background: rgba(255, 255, 255, 0.2);
  cursor: not-allowed;
  transform: none;
}

.ignore-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

/* 桌面端继续投稿按钮 */
.desktop-continue-btn {
  display: none;
}

/* 移动端继续投稿按钮 */
.mobile-continue-actions {
  display: block;
}

.mobile-continue-btn {
  display: block;
}

/* 宽屏时的样式 */
@media (min-width: 768px) {
  .desktop-continue-btn {
    display: inline-flex;
    padding: 6px 12px;
    font-size: 12px;
    border-radius: 6px;
  }
  
  .mobile-continue-actions {
    display: none;
  }
  
  .similar-songs-list {
    max-height: 80px;
  }
}

/* 移动端时增加相似电影列表高度 */
@media (max-width: 767px) {
  .similar-songs-list {
    max-height: 150px;
  }
}

/* 动画样式 */
.results-fade-enter-active,
.results-fade-leave-active {
  transition: all 0.3s ease;
}

.results-fade-enter-from,
.results-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.result-item-enter-active {
  transition: all 0.4s ease;
}

.result-item-leave-active {
  transition: all 0.3s ease;
}

.result-item-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.result-item-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.result-item-move {
  transition: transform 0.3s ease;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: rgba(30, 41, 59, 0.95);
  border-radius: 0.75rem;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  margin: 0;
  color: #FFFFFF;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #FFFFFF;
}

.modal-body {
  padding: 1.5rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.16);
  color: #FFFFFF;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-primary {
  background: linear-gradient(180deg, #0043F8 0%, #0075F8 100%);
  border-color: rgba(255, 255, 255, 0.16);
  color: #FFFFFF;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 67, 248, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.readonly {
  background: rgba(255, 255, 255, 0.05) !important;
  color: rgba(255, 255, 255, 0.6) !important;
  cursor: not-allowed;
}

/* 弹窗动画 */
.modal-animation-enter-active,
.modal-animation-leave-active {
  transition: all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
}

.modal-animation-enter-from,
.modal-animation-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.result-item {
  display: flex;
  padding: 1rem 1.5rem 1rem 1.5rem;
  gap: 1.2rem;
  transition: all 0.2s ease;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.result-cover {
  width: 80px;
  height: 80px;
  position: relative;
  flex-shrink: 0;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  border-radius: 6px;
  transition: opacity 0.2s ease;
  cursor: pointer;
}

.result-cover:hover .play-overlay {
  opacity: 1;
}

.play-button-bg {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(11, 90, 254, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: transform 0.2s ease;
}

.play-button-bg:hover {
  transform: scale(1.1);
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  color: #ffffff;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-artist {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin: 0.5rem 0;
}

.result-album,
.result-quality,
.result-pay {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  margin: 0.25rem 0;
}



.result-actions {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 0.5rem;
  margin-right: 0.5rem;
}

.similar-song-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
}

.similar-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-family: 'MiSans', sans-serif;
  font-weight: 500;
}

.similar-text.status-played {
  color: #ef4444;
  font-weight: 600;
}

.similar-text.status-scheduled {
  color: #f59e0b;
  font-weight: 600;
}

.like-btn {
  background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  padding: 0.4rem 0.8rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.2s ease;
}

.like-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.like-btn:disabled {
  background: rgba(255, 255, 255, 0.2);
  cursor: not-allowed;
  transform: none;
}

.like-btn.disabled {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  cursor: not-allowed;
  opacity: 0.5;
}

.like-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.select-btn {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

/* 音频播放器现在使用全局组件 */

/* 手动提交按钮样式 */
.no-results-action {
  margin-top: 1rem;
  text-align: center;
  padding: 1rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.manual-submit-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1.5rem;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manual-submit-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

/* 手动输入区域样式 */
.manual-input-section {
  margin-top: 2rem;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 13px;
  padding: 1.5rem;
}

.manual-title {
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 18px;
  margin-bottom: 1rem;
  color: #ffffff;
}

.manual-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.manual-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.manual-cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manual-cancel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.manual-confirm-btn {
  background: linear-gradient(180deg, #0043f8 0%, #0075f8 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #ffffff;
  font-family: 'MiSans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.manual-confirm-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 67, 248, 0.3);
}

.manual-confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .request-form {
    flex-direction: column;
    height: auto;
    max-height: none;
    overflow: visible;
  }

  .rules-section {
    width: 100%;
    height: auto;
    margin-bottom: 1rem;
    padding: 1rem;
  }

  .form-container {
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    height: auto;
  }

  .song-request-form {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: auto;
    gap: 1rem;
  }

  .search-results-container {
    flex: 1;
    height: auto;
    max-height: 70vh;
    padding: 1rem;
    overflow: visible;
    display: flex;
    flex-direction: column;
  }

  .results-content {
    height: auto;
    max-height: 60vh;
    overflow: visible;
    flex: 1;
  }

  /* 移动端搜索区域 */
  .search-section {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .search-label {
    font-size: 14px;
  }

  .search-input-group {
    flex-direction: column;
    gap: 0.75rem;
  }

  .search-button {
    padding: 0.75rem;
  }

  /* 移动端平台选择按钮 */
  .platform-selection {
    flex-direction: row;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
  }

  .platform-selection::-webkit-scrollbar {
    display: none; /* Chrome, Safari and Opera */
  }

  .platform-btn {
    padding: 0.6rem 0.8rem;
    font-size: 13px;
    flex-shrink: 0;
    min-width: fit-content;
  }

  /* 移动端音源状态显示 */
  .source-status-display {
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .status-header {
    margin-bottom: 0.5rem;
  }

  .status-title {
    font-size: 13px;
  }

  .status-summary {
    font-size: 11px;
    padding: 0.2rem 0.4rem;
  }

  .status-sources {
    gap: 0.4rem;
  }

  .source-item {
    padding: 0.4rem 0.6rem;
    font-size: 11px;
  }

  .source-indicator {
    width: 6px;
    height: 6px;
  }

  .error-message {
    margin-top: 0.5rem;
    padding: 0.4rem 0.6rem;
    font-size: 11px;
  }

  .form-row {
    flex-direction: column;
    gap: 1rem;
  }

  .form-group label {
    font-size: 18px;
  }

  .form-actions {
    justify-content: center;
  }

  .submit-button {
    width: 100%;
    padding: 0.75rem;
  }

  .alert-actions {
    flex-direction: column;
    gap: 0.5rem;
  }

  .vote-btn,
  .ignore-btn {
    width: 100%;
  }

  .audio-player {
    flex-direction: column;
    padding: 0.75rem;
  }

  .player-info {
    width: 100%;
  }

  .audio-player audio {
    width: 100%;
  }

  .close-player {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
  }

  /* 移动端平台选择Tab */
  .tab-header {
    gap: 2px;
  }

  .tab-btn {
    padding: 0.6rem 0.8rem;
    font-size: 13px;
  }

  /* 移动端搜索结果优化 */
  .result-item {
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .result-cover {
    width: 60px;
    height: 60px;
    align-self: center;
  }

  .result-info {
    text-align: center;
  }

  .result-title {
    font-size: 15px;
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    line-height: 1.3;
    margin-bottom: 0.5rem;
  }

  .result-artist {
    font-size: 13px;
    margin: 0.3rem 0;
  }

  .result-album {
    font-size: 11px;
    margin: 0.2rem 0;
  }

  .result-actions {
    justify-content: center;
  }

  .select-btn {
    width: 100%;
    padding: 0.6rem 1rem;
  }

  /* 移动端弹窗优化 */
  .modal-content {
    width: 95%;
    max-width: none;
  }

  .modal-actions {
    flex-direction: column;
    gap: 0.75rem;
  }

  .btn {
    width: 100%;
    padding: 0.75rem;
  }

  /* 移动端搜索插图 */
  .search-svg {
    width: 50%;
    max-width: 250px;
    min-width: 120px;
  }

  .search-illustration {
    padding: 0.5rem;
    min-height: 120px;
  }

  /* 移动端搜索结果列表 */
  .results-list {
    flex: 1;
    height: auto;
    max-height: 50vh;
    overflow: visible;
  }

  .results-grid {
    max-height: 50vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 2rem; /* 确保底部内容可见 */
  }

  /* 移动端期望排期选择 */
  .form-group {
    margin-bottom: 1rem;
    z-index: 10;
    position: relative;
  }

  .form-select {
    position: relative;
    z-index: 10;
  }

  /* 确保相似电影提示在移动端可见 */
  .similar-song-alert {
    margin-top: 1rem;
    margin-bottom: 1rem;
    z-index: 20;
    position: relative;
  }
}
</style>