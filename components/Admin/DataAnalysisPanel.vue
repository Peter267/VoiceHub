<template>
  <div class="data-analysis-panel">
    <!-- 全局加载状态 -->
    <LoadingState 
      v-if="isLoading && !hasInitialData"
      title="加载数据分析"
      message="正在获取最新的统计数据..."
      spinner-type="pulse"
      :steps="loadingSteps"
      :current-step="currentLoadingStep"
    />
    
    <!-- 错误边界 -->
    <ErrorBoundary 
      v-else-if="error && !hasInitialData"
      :error="error"
      error-title="数据加载失败"
      error-message="无法获取数据分析信息，请检查网络连接或稍后重试"
      :show-details="true"
      :on-retry="refreshAllData"
    />
    
    <!-- 主要内容 -->
    <div v-else class="panel-content">
      <!-- 面板标题和控制区域 -->
      <div class="panel-header">
        <div class="header-left">
          <h2>数据分析</h2>
          <div v-if="error" class="error-message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            {{ error }}
          </div>
        </div>
        <div class="header-controls">
          <button 
            @click="refreshAllData" 
            :disabled="isLoading"
            class="refresh-btn"
            title="刷新数据"
          >
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="2"
              :class="{ 'spinning': isLoading }"
            >
              <polyline points="23,4 23,10 17,10"/>
              <polyline points="1,20 1,14 7,14"/>
              <path d="M20.49,9A9,9,0,0,0,5.64,5.64L1,10m22,4a9,9,0,0,1-14.85,4.36L23,14"/>
            </svg>
          </button>
          <div class="semester-selector">
            <label for="semester-select">选择学期:</label>
            <select 
              id="semester-select" 
              v-model="selectedSemester" 
              @change="handleSemesterChange"
              class="semester-select"
              :disabled="isLoading"
            >
              <option value="all">全部学期</option>
              <option 
                v-for="semester in availableSemesters" 
                :key="semester.id" 
                :value="semester.name"
              >
                {{ semester.name }}
              </option>
            </select>
          </div>
        </div>
      </div>
    
    <!-- 数据概览卡片 -->
    <div class="stats-grid">
      <StatCard
        label="注册用户"
        :value="analysisData.totalUsers"
        subtitle="系统中的用户总数"
        icon="users"
        icon-class="success"
        :is-loading="isLoading"
        format="number"
      />
      
      <StatCard
        label="总电影数"
        :value="analysisData.totalSongs"
        :change="analysisData.songsChange"
        change-label="较上周"
        subtitle="活跃电影库"
        icon="songs"
        icon-class="primary"
        :trend-data="analysisData.songsTrend"
        :is-loading="isLoading"
        format="number"
      />
      
      <StatCard
        label="排期总数"
        :value="analysisData.totalSchedules"
        :change="analysisData.schedulesChange"
        change-label="较上周"
        subtitle="本学期排期"
        icon="schedule"
        icon-class="info"
        :trend-data="analysisData.schedulesTrend"
        :is-loading="isLoading"
        format="number"
      />
      
      <StatCard
        label="点播总数"
        :value="analysisData.totalRequests"
        :change="analysisData.requestsChange"
        change-label="较上周"
        subtitle="累计点播"
        icon="votes"
        icon-class="warning"
        :trend-data="analysisData.requestsTrend"
        :is-loading="isLoading"
        format="number"
      />
    </div>
    
    <!-- 实时数据卡片 -->
    <div class="realtime-stats">
      <div class="realtime-card">
        <div class="realtime-header">
          <h3>实时数据</h3>
          <div class="live-indicator">
            <div class="pulse-dot"></div>
            <span>实时</span>
          </div>
        </div>
        <div class="realtime-grid">
          <div class="realtime-item online-users-item" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave" ref="onlineUsersRef">
            <span class="realtime-label">活跃用户</span>
            <span class="realtime-value">{{ realtimeStats.activeUsers }}</span>
          </div>
          <div class="realtime-item">
            <span class="realtime-label">今日点播</span>
            <span class="realtime-value">{{ realtimeStats.todayRequests }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="charts-grid">
      <div class="chart-card enhanced">
        <div class="chart-header">
          <h3>电影点播趋势</h3>
          <div class="chart-actions">
            <button class="chart-btn" title="查看详情">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="chart-container">
          <div v-if="trendData.length > 0" class="chart-content">
            <div class="trend-chart-wrapper">
              <svg class="trend-svg" viewBox="0 0 400 200">
                <!-- 网格线 -->
                <defs>
                  <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                
                <!-- 趋势线 -->
                <polyline
                  :points="getTrendPoints(trendData)"
                  fill="none"
                  stroke="#4f46e5"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="trend-line"
                />
                
                <!-- 数据点 -->
                <circle
                  v-for="(item, index) in trendData.slice(0, 10)"
                  :key="index"
                  :cx="(index / 9) * 360 + 20"
                  :cy="180 - (item.count / Math.max(...trendData.map(d => d.count))) * 160"
                  r="4"
                  fill="#4f46e5"
                  class="trend-point"
                />
              </svg>
            </div>
            <div class="trend-legend">
              <div v-for="(item, index) in trendData.slice(0, 5)" :key="index" class="trend-item">
                <span class="trend-date">{{ item.date }}</span>
                <span class="trend-count">{{ item.count }} 首</span>
              </div>
            </div>
          </div>
          <div v-else class="chart-placeholder">
            <div class="placeholder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3v18h18"/>
                <path d="M7 12l3-3 3 3 5-5"/>
              </svg>
            </div>
            <p>暂无趋势数据</p>
            <span class="placeholder-subtext">数据收集中...</span>
          </div>
        </div>
      </div>
      
      <div class="chart-card enhanced">
        <div class="chart-header">
          <h3>热门电影排行</h3>
        </div>
        <div class="chart-container">
          <div v-if="topSongs.length > 0" class="chart-content">
            <div class="songs-ranking">
              <div v-for="(song, index) in topSongs" :key="song.id" class="song-item enhanced">
                <div class="song-rank-badge" :class="getRankClass(index)">
                  <span v-if="index < 3" class="rank-icon">{{ getRankIcon(index) }}</span>
                  <span v-else class="rank-number">{{ index + 1 }}</span>
                </div>
                <div class="song-info">
                  <div class="song-title">{{ song.title }}</div>
                  <div class="song-artist">{{ song.artist }}</div>
                </div>
                <div class="song-stats">
                  <div class="vote-count">{{ song.voteCount }}</div>
                  <div class="vote-label">次点赞</div>
                  <div class="vote-bar">
                    <div 
                      class="vote-fill" 
                      :style="{ width: (song.voteCount / Math.max(...topSongs.map(s => s.voteCount))) * 100 + '%' }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="chart-placeholder">
            <div class="placeholder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
            </div>
            <p>暂无热门电影</p>
            <span class="placeholder-subtext">等待用户点播...</span>
          </div>
        </div>
      </div>
      
      <!-- 活跃用户排名 -->
      <div class="chart-card enhanced">
        <div class="chart-header">
          <h3>活跃用户排名</h3>
          <div v-if="panelStates.activeUsers.loading" class="panel-loading">
            <svg class="loading-spinner" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
              </circle>
            </svg>
          </div>
        </div>
        <div class="chart-container">
          <!-- 错误状态 -->
          <div v-if="panelStates.activeUsers.error" class="chart-error">
            <div class="error-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <p>{{ panelStates.activeUsers.error }}</p>
            <button @click="loadActiveUsers" class="retry-btn">重试</button>
          </div>
          <!-- 加载状态 -->
          <div v-else-if="panelStates.activeUsers.loading" class="chart-loading">
            <div class="loading-content">
              <div class="loading-text">加载活跃用户数据...</div>
            </div>
          </div>
          <!-- 正常内容 -->
          <div v-else-if="activeUsers.length > 0" class="chart-content">
            <div class="users-ranking">
              <div v-for="(user, index) in activeUsers" :key="user.id" class="user-item">
                <div class="user-rank">
                  <div :class="['rank-badge', getRankClass(index)]">
                    <span v-if="index < 3" class="rank-icon">{{ getRankIcon(index) }}</span>
                    <span v-else class="rank-number">{{ index + 1 }}</span>
                  </div>
                </div>
                <div class="user-info">
                  <div class="user-name">{{ user.name }}</div>
                  <div class="user-details">
                    <span class="contribution-count">{{ user.contributions }}首投稿</span>
                    <span class="like-count">{{ user.likes }}次点赞</span>
                  </div>
                </div>
                <div class="user-stats">
                  <div class="activity-score">{{ user.activityScore }}</div>
                  <div class="score-label">活跃度</div>
                  <div class="activity-bar">
                    <div 
                      class="activity-fill" 
                      :style="{ width: `${(user.activityScore / Math.max(...activeUsers.map(u => u.activityScore))) * 100}%` }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- 空状态 -->
          <div v-else class="chart-placeholder">
            <div class="placeholder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p>暂无活跃用户数据</p>
            <span class="placeholder-subtext">等待用户活动...</span>
          </div>
        </div>
      </div>
      
      <div class="chart-card enhanced">
        <div class="chart-header">
          <h3>学期对比分析</h3>
        </div>
        <div class="chart-container">
          <div v-if="semesterComparison.length > 0" class="chart-content">
            <div class="semester-comparison">
              <div v-for="semester in semesterComparison" :key="semester.semester" class="semester-card">
                <div class="semester-header">
                  <div class="semester-title">
                    <h4>{{ semester.semester }}</h4>
                    <span v-if="semester.isActive" class="current-badge">当前学期</span>
                  </div>
                  <div class="semester-period">
                    {{ formatSemesterPeriod(semester.semester) }}
                  </div>
                </div>
                <div class="semester-metrics">
                  <div class="metric-item">
                    <div class="metric-icon songs">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                      </svg>
                    </div>
                    <div class="metric-content">
                      <div class="metric-value">{{ semester.totalSongs }}</div>
                      <div class="metric-label">电影总数</div>
                    </div>
                  </div>
                  <div class="metric-item">
                    <div class="metric-icon schedules">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    </div>
                    <div class="metric-content">
                      <div class="metric-value">{{ semester.totalSchedules }}</div>
                      <div class="metric-label">排期数量</div>
                    </div>
                  </div>
                  <div class="metric-item">
                    <div class="metric-icon requests">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 12l2 2 4-4"/>
                        <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
                        <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
                        <path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3"/>
                        <path d="M12 21c0-1 1-3 3-3s3 2 3 3-1 3-3 3-3-2-3-3"/>
                      </svg>
                    </div>
                    <div class="metric-content">
                      <div class="metric-value">{{ semester.totalRequests }}</div>
                      <div class="metric-label">点播次数</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="chart-placeholder">
            <div class="placeholder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3v18h18"/>
                <path d="M7 12l3-3 3 3 5-5"/>
              </svg>
            </div>
            <p>暂无学期数据</p>
            <span class="placeholder-subtext">等待学期设置...</span>
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
  
  <!-- 全局悬浮提示框 -->
  <Teleport to="body">
    <div v-if="tooltip.show" class="users-tooltip-global" :style="tooltip.style" @mouseenter="handleTooltipMouseEnter" @mouseleave="handleTooltipMouseLeave">
      <!-- 有活跃用户时的提示 -->
      <div v-if="realtimeStats.activeUsersList && realtimeStats.activeUsersList.length > 0">
        <div class="tooltip-header">
          <h4>活跃用户列表</h4>
          <span class="user-count">({{ realtimeStats.activeUsersList.length }}人)</span>
        </div>
        <div class="users-list">
          <div v-for="user in realtimeStats.activeUsersList" :key="user.id" class="user-item-tooltip">
            <div class="user-avatar">
              <div class="avatar-placeholder">
                {{ user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase() }}
              </div>
            </div>
            <div class="user-info-tooltip">
              <div class="user-name">{{ user.name || user.username }}</div>
              <div class="user-username">@{{ user.username }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 无活跃用户时的提示 -->
      <div v-else class="empty-tooltip">
        <div class="tooltip-header">
          <h4>活跃用户列表</h4>
        </div>
        <div class="empty-message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <p>暂无活跃用户</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useSemesters } from '~/composables/useSemesters'
import StatCard from './Common/StatCard.vue'
import LoadingState from './Common/LoadingState.vue'
import ErrorBoundary from './Common/ErrorBoundary.vue'

// 使用学期管理 composable
const { fetchSemesters, semesters: availableSemesters, currentSemester } = useSemesters()

// 响应式数据
const selectedSemester = ref('all')
const isLoading = ref(false)
const error = ref(null)
const hasInitialData = ref(false)
const currentLoadingStep = ref(0)

// 加载步骤
const loadingSteps = [
  '获取学期信息',
  '加载统计数据',
  '获取图表数据',
  '加载实时数据'
]

const analysisData = ref({
  totalSongs: 0,
  totalUsers: 0,
  totalSchedules: 0,
  totalRequests: 0,
  // 变化百分比
  songsChange: 0,
  usersChange: 0,
  schedulesChange: 0,
  requestsChange: 0,
  // 趋势数据
  songsTrend: [],
  usersTrend: [],
  schedulesTrend: [],
  requestsTrend: []
})

// 图表数据
const trendData = ref([])
const topSongs = ref([])
const activeUsers = ref([])
const userEngagement = ref({})
const semesterComparison = ref([])

// 各个面板的loading和error状态
const panelStates = ref({
  trends: { loading: false, error: null },
  topSongs: { loading: false, error: null },
  activeUsers: { loading: false, error: null },
  userEngagement: { loading: false, error: null },
  semesterComparison: { loading: false, error: null }
})
const realtimeStats = ref({
  activeUsers: 0,
  activeUsersList: [],
  todayRequests: 0,
  popularGenres: [],
  peakHours: []
})

// 悬停提示状态
const showUsersList = ref(false)

// 全局tooltip状态
const tooltip = ref({
  show: false,
  isHovered: false,
  style: {
    position: 'fixed',
    top: '0px',
    left: '0px',
    zIndex: 999999
  }
})

// 鼠标进入事件处理
const handleMouseEnter = (event) => {
  const rect = event.target.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  // 计算tooltip位置
  let left = rect.left + rect.width / 2
  let top = rect.top - 10
  
  // 确保tooltip不超出视口边界
  const tooltipWidth = 320 // 预估tooltip宽度
  const tooltipHeight = 300 // 预估tooltip高度
  
  if (left + tooltipWidth / 2 > viewportWidth) {
    left = viewportWidth - tooltipWidth / 2 - 10
  }
  if (left - tooltipWidth / 2 < 0) {
    left = tooltipWidth / 2 + 10
  }
  if (top - tooltipHeight < 0) {
    top = rect.bottom + 10
  }
  
  tooltip.value.style.left = `${left}px`
  tooltip.value.style.top = `${top}px`
  tooltip.value.style.transform = 'translateX(-50%)'
  tooltip.value.show = true
}

// 鼠标离开事件处理
const handleMouseLeave = () => {
  // 延迟隐藏，给用户时间移动到tooltip上
  setTimeout(() => {
    if (!tooltip.value.isHovered) {
      tooltip.value.show = false
    }
  }, 100)
}

// tooltip鼠标进入事件
const handleTooltipMouseEnter = () => {
  tooltip.value.isHovered = true
}

// tooltip鼠标离开事件
const handleTooltipMouseLeave = () => {
  tooltip.value.isHovered = false
  tooltip.value.show = false
}

// 处理学期切换
const handleSemesterChange = async () => {
  await Promise.all([
    loadAnalysisData(),
    loadChartData(),
    loadRealtimeStats()
  ])
}

// 加载分析数据
const loadAnalysisData = async () => {
  try {
    isLoading.value = true
    error.value = null
    currentLoadingStep.value = 1
    
    // 构建API查询参数
    const params = new URLSearchParams()
    if (selectedSemester.value && selectedSemester.value !== 'all') {
      params.append('semester', selectedSemester.value)
    }
    
    // 调用API获取统计数据
    const response = await $fetch(`/api/admin/stats?${params.toString()}`, {
      method: 'GET'
    })
    
    // 更新分析数据
    analysisData.value = {
      totalSongs: response.totalSongs || 0,
      totalUsers: response.totalUsers || 0,
      totalSchedules: response.totalSchedules || 0,
      totalRequests: response.weeklyRequests || 0,
      // 变化百分比
      songsChange: response.songsChange || 0,
      usersChange: response.usersChange || 0,
      schedulesChange: response.schedulesChange || 0,
      requestsChange: response.requestsChange || 0,
      // 趋势数据
      songsTrend: response.songsTrend || [],
      usersTrend: response.usersTrend || [],
      schedulesTrend: response.schedulesTrend || [],
      requestsTrend: response.requestsTrend || []
    }
  } catch (err) {
    console.error('加载分析数据失败:', err)
    error.value = '加载数据失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

// 加载实时统计数据
const loadRealtimeStats = async () => {
  try {
    currentLoadingStep.value = 3
    const response = await $fetch('/api/admin/stats/realtime', {
      method: 'GET'
    })
    
    realtimeStats.value = {
      activeUsers: response.activeUsers || 0,
      activeUsersList: response.activeUsersList || [],
      todayRequests: response.todayRequests || 0,
      popularGenres: response.popularGenres || [],
      peakHours: response.peakHours || []
    }
  } catch (err) {
    console.error('加载实时数据失败:', err)
  }
}

// 加载图表数据
const loadChartData = async () => {
  currentLoadingStep.value = 2
  
  // 构建API查询参数
  const params = new URLSearchParams()
  if (selectedSemester.value && selectedSemester.value !== 'all') {
    params.append('semester', selectedSemester.value)
  }
  
  // 重置所有面板状态
  Object.keys(panelStates.value).forEach(key => {
    panelStates.value[key].loading = true
    panelStates.value[key].error = null
  })
  
  // 独立加载趋势数据
  const loadTrends = async () => {
    try {
      const trends = await $fetch(`/api/admin/stats/trends?${params.toString()}`, {
        method: 'GET'
      })
      trendData.value = trends || []
      panelStates.value.trends.error = null
    } catch (err) {
      console.warn('获取趋势数据失败:', err)
      panelStates.value.trends.error = '加载趋势数据失败'
      trendData.value = []
    } finally {
      panelStates.value.trends.loading = false
    }
  }
  
  // 独立加载热门电影数据
  const loadTopSongs = async () => {
    try {
      const topSongsData = await $fetch(`/api/admin/stats/top-songs?limit=10&${params.toString()}`, {
        method: 'GET'
      })
      topSongs.value = topSongsData || []
      panelStates.value.topSongs.error = null
    } catch (err) {
      console.warn('获取热门电影数据失败:', err)
      panelStates.value.topSongs.error = '加载热门电影失败'
      topSongs.value = []
    } finally {
      panelStates.value.topSongs.loading = false
    }
  }
  
  // 独立加载活跃用户数据
  const loadActiveUsers = async () => {
    try {
      const activeUsersData = await $fetch(`/api/admin/stats/active-users?limit=10&${params.toString()}`, {
        method: 'GET'
      })
      activeUsers.value = activeUsersData || []
      panelStates.value.activeUsers.error = null
      console.log('活跃用户数据加载完成:', activeUsersData)
      console.log('activeUsers.value长度:', activeUsers.value.length)
    } catch (err) {
      console.warn('获取活跃用户数据失败:', err)
      panelStates.value.activeUsers.error = '加载活跃用户失败'
      activeUsers.value = []
    } finally {
      panelStates.value.activeUsers.loading = false
    }
  }
  
  // 独立加载用户参与度数据
  const loadUserEngagement = async () => {
    try {
      const engagement = await $fetch(`/api/admin/stats/user-engagement?${params.toString()}`, {
        method: 'GET'
      })
      userEngagement.value = engagement || {}
      panelStates.value.userEngagement.error = null
    } catch (err) {
      console.warn('获取用户参与度数据失败:', err)
      panelStates.value.userEngagement.error = '加载用户参与度失败'
      userEngagement.value = {}
    } finally {
      panelStates.value.userEngagement.loading = false
    }
  }
  
  // 独立加载学期对比数据
  const loadSemesterComparison = async () => {
    try {
      const comparison = await $fetch('/api/admin/stats/semester-comparison', {
        method: 'GET'
      })
      semesterComparison.value = comparison || []
      panelStates.value.semesterComparison.error = null
    } catch (err) {
      console.warn('获取学期对比数据失败:', err)
      panelStates.value.semesterComparison.error = '加载学期对比失败'
      semesterComparison.value = []
    } finally {
      panelStates.value.semesterComparison.loading = false
    }
  }
  
  // 并行执行所有加载任务，但每个都是独立的
  await Promise.allSettled([
    loadTrends(),
    loadTopSongs(),
    loadActiveUsers(),
    loadUserEngagement(),
    loadSemesterComparison()
  ])
}

// 组件挂载时初始化
onMounted(async () => {
  try {
    currentLoadingStep.value = 0
    // 获取学期列表
    await fetchSemesters()
    
    // 设置默认学期为当前学期
    if (currentSemester.value) {
      selectedSemester.value = currentSemester.value.name
    }
    
    // 并行加载所有数据
    await Promise.all([
      loadAnalysisData(),
      loadChartData(),
      loadRealtimeStats()
    ])
    
    hasInitialData.value = true
    
    // 设置定时刷新实时数据（每30秒）
    setInterval(() => {
      loadRealtimeStats()
    }, 30000)
    
  } catch (err) {
    console.error('初始化数据分析面板失败:', err)
    error.value = '初始化失败，请刷新页面重试'
  }
})

// 刷新所有数据
const refreshAllData = async () => {
  await Promise.all([
    loadAnalysisData(),
    loadChartData(),
    loadRealtimeStats()
  ])
}

// 独立重试函数
const loadActiveUsers = async () => {
  const params = new URLSearchParams()
  if (selectedSemester.value && selectedSemester.value !== 'all') {
    params.append('semester', selectedSemester.value)
  }
  
  panelStates.value.activeUsers.loading = true
  panelStates.value.activeUsers.error = null
  
  try {
    const activeUsersData = await $fetch(`/api/admin/stats/active-users?limit=10&${params.toString()}`, {
      method: 'GET'
    })
    activeUsers.value = activeUsersData || []
    panelStates.value.activeUsers.error = null
    console.log('活跃用户数据重新加载完成:', activeUsersData)
  } catch (err) {
    console.warn('重新获取活跃用户数据失败:', err)
    panelStates.value.activeUsers.error = '加载活跃用户失败'
    activeUsers.value = []
  } finally {
    panelStates.value.activeUsers.loading = false
  }
}

// 获取趋势图点坐标
const getTrendPoints = (data) => {
  if (!data || data.length === 0) return ''
  
  // 过滤并验证数据，确保 count 是有效数字
  const validData = data.filter(d => d && typeof d.count === 'number' && !isNaN(d.count))
  if (validData.length === 0) return ''
  
  const maxCount = Math.max(...validData.map(d => d.count))
  // 防止除零错误
  if (maxCount === 0) return ''
  
  return validData.slice(0, 10).map((item, index) => {
    const x = (index / Math.max(validData.slice(0, 10).length - 1, 1)) * 360 + 20
    const y = 180 - (item.count / maxCount) * 160
    return `${x},${y}`
  }).join(' ')
}

// 获取排名样式类
const getRankClass = (index) => {
  if (index === 0) return 'rank-gold'
  if (index === 1) return 'rank-silver'
  if (index === 2) return 'rank-bronze'
  return 'rank-normal'
}

// 获取排名图标
const getRankIcon = (index) => {
  const icons = ['🥇', '🥈', '🥉']
  return icons[index] || (index + 1)
}

// 格式化学期时间段
const formatSemesterPeriod = (semester) => {
  // 解析学期名称，例如 "2024春" -> "2024年春季学期"
  const match = semester.match(/(\d{4})(春|秋)/)
  if (match) {
    const year = match[1]
    const season = match[2] === '春' ? '春季' : '秋季'
    return `${year}年${season}学期`
  }
  return semester
}
</script>

<style scoped>
.data-analysis-panel {
  padding: 20px;
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid #1f1f1f;
  color: #e2e8f0;
  min-height: 100vh;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(139, 92, 246, 0.1));
  border-radius: 16px;
  border: 1px solid rgba(79, 70, 229, 0.2);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-header h2 {
  margin: 0;
  font-size: 32px;
  font-weight: 800;
  color: #f8fafc;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #f8fafc, #e2e8f0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 14px;
  font-weight: 500;
}

.error-message svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(79, 70, 229, 0.1);
  border: 1px solid rgba(79, 70, 229, 0.3);
  border-radius: 10px;
  color: #a5b4fc;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(79, 70, 229, 0.2);
  border-color: rgba(79, 70, 229, 0.5);
  color: #c7d2fe;
  transform: scale(1.05);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-btn svg {
  width: 20px;
  height: 20px;
  transition: transform 0.2s ease;
}

.refresh-btn svg.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.semester-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.semester-selector label {
  font-weight: 500;
  color: #cbd5e1;
}

.semester-select {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  padding: 8px 12px;
  color: #e2e8f0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.semester-select:hover {
  border-color: #4f46e5;
}

.semester-select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

/* 实时数据样式 */
.realtime-stats {
  margin-bottom: 32px;
}

.realtime-card {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1));
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s ease;
}

.realtime-card:hover {
  border-color: rgba(16, 185, 129, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(16, 185, 129, 0.1);
}

.realtime-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.realtime-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #f1f5f9;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(16, 185, 129, 0.2);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  color: #6ee7b7;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  animation: pulse-live 2s infinite;
}

@keyframes pulse-live {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.realtime-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
}

.realtime-item {
  text-align: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

.realtime-label {
  display: block;
  font-size: 14px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.realtime-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #10b981;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
}

.chart-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.chart-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.chart-card:hover::before {
  opacity: 1;
}

.chart-card:hover {
  border-color: #3a3a3a;
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.chart-card.enhanced {
  background: linear-gradient(135deg, #1a1a1a, #1f1f1f);
  border: 1px solid #2d2d2d;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.chart-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
}

.chart-actions {
  display: flex;
  gap: 8px;
}

.chart-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(79, 70, 229, 0.1);
  border: 1px solid rgba(79, 70, 229, 0.2);
  border-radius: 8px;
  color: #a5b4fc;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chart-btn:hover {
  background: rgba(79, 70, 229, 0.2);
  border-color: rgba(79, 70, 229, 0.4);
  color: #c7d2fe;
}

.chart-btn svg {
  width: 16px;
  height: 16px;
}

.chart-container {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
}

/* 趋势图样式 */
.trend-svg {
  width: 100%;
  height: 200px;
  margin-bottom: 16px;
}

.trend-grid {
  stroke: #2a2a2a;
  stroke-width: 1;
  opacity: 0.3;
}

.trend-line {
  fill: none;
  stroke: #4f46e5;
  stroke-width: 2;
  filter: drop-shadow(0 0 4px rgba(79, 70, 229, 0.3));
}

.trend-point {
  fill: #4f46e5;
  stroke: #1a1a1a;
  stroke-width: 2;
  cursor: pointer;
  transition: all 0.2s ease;
}

.trend-point:hover {
  fill: #6366f1;
  r: 6;
  filter: drop-shadow(0 0 8px rgba(79, 70, 229, 0.5));
}

.trend-legend {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #94a3b8;
  margin-top: 8px;
}

.trend-legend-item {
  text-align: center;
  flex: 1;
}

.trend-legend-date {
  display: block;
  margin-bottom: 4px;
}

.trend-legend-value {
  display: block;
  font-weight: 600;
  color: #4f46e5;
}

.chart-content {
  width: 100%;
  padding: 10px;
  height: 100%;
  overflow-y: auto;
}

.songs-ranking {
  max-height: 280px;
  overflow-y: auto;
  padding-right: 8px;
}

.songs-ranking::-webkit-scrollbar {
  width: 6px;
}

.songs-ranking::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.songs-ranking::-webkit-scrollbar-thumb {
  background: rgba(79, 70, 229, 0.3);
  border-radius: 3px;
  transition: background 0.3s ease;
}

.songs-ranking::-webkit-scrollbar-thumb:hover {
  background: rgba(79, 70, 229, 0.5);
}

.chart-placeholder {
  text-align: center;
  color: #64748b;
  font-size: 16px;
  padding: 60px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.placeholder-icon {
  width: 64px;
  height: 64px;
  opacity: 0.3;
  margin-bottom: 8px;
}

.placeholder-icon svg {
  width: 100%;
  height: 100%;
}

.chart-placeholder p {
  margin: 10px 0;
  color: #94a3b8;
  font-size: 16px;
}

.placeholder-text {
  font-size: 16px;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 4px;
}

.placeholder-subtext {
  font-size: 14px !important;
  color: #475569 !important;
}

.trend-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #2d2d2d;
}

.trend-date {
  color: #cbd5e1;
}

.trend-count {
  color: #4f46e5;
  font-weight: 500;
}

.song-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  margin-bottom: 12px;
}

.song-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #4f46e5, #7c3aed);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.song-item:hover::before {
  opacity: 1;
}

.song-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.song-rank-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 16px;
  font-weight: 700;
  font-size: 16px;
  transition: all 0.3s ease;
}

.rank-gold {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #1a1a1a;
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
}

.rank-silver {
  background: linear-gradient(135deg, #e5e7eb, #9ca3af);
  color: #1a1a1a;
  box-shadow: 0 0 20px rgba(156, 163, 175, 0.3);
}

.rank-bronze {
  background: linear-gradient(135deg, #d97706, #92400e);
  color: #fff;
  box-shadow: 0 0 20px rgba(217, 119, 6, 0.3);
}

.rank-normal {
  background: rgba(79, 70, 229, 0.1);
  border: 2px solid rgba(79, 70, 229, 0.3);
  color: #a5b4fc;
}

.rank-icon {
  font-size: 18px;
}

.rank-number {
  font-size: 14px;
  font-weight: 600;
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-title {
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 4px;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 14px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 80px;
}

.vote-count {
  font-weight: 600;
  color: #10b981;
  font-size: 16px;
  margin-bottom: 2px;
}

.vote-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.vote-bar {
  width: 60px;
  height: 4px;
  background: rgba(16, 185, 129, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.vote-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #059669);
  border-radius: 2px;
  transition: width 0.5s ease;
}

.engagement-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #2d2d2d;
}

.engagement-label {
  color: #cbd5e1;
}

.engagement-value {
  color: #4f46e5;
  font-weight: 500;
}

.semester-comparison {
  display: grid;
  gap: 16px;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 8px;
}

.semester-comparison::-webkit-scrollbar {
  width: 6px;
}

.semester-comparison::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.semester-comparison::-webkit-scrollbar-thumb {
  background: rgba(79, 70, 229, 0.3);
  border-radius: 3px;
  transition: background 0.3s ease;
}

.semester-comparison::-webkit-scrollbar-thumb:hover {
  background: rgba(79, 70, 229, 0.5);
}

.semester-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s ease;
}

.semester-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(79, 70, 229, 0.3);
  transform: translateY(-2px);
}

.semester-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.semester-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.semester-title h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
}

.current-badge {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.semester-period {
  font-size: 12px;
  color: #94a3b8;
  text-align: right;
}

.semester-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.metric-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.metric-icon.songs {
  background: rgba(79, 70, 229, 0.2);
  color: #a5b4fc;
}

.metric-icon.schedules {
  background: rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
}

.metric-icon.requests {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.metric-icon svg {
  width: 12px;
  height: 12px;
}

.metric-content {
  flex: 1;
  min-width: 0;
}

.metric-value {
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
  line-height: 1;
}

.metric-label {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.semester-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #2d2d2d;
}

.semester-name {
  color: #f1f5f9;
  font-weight: 500;
  flex: 1;
}

.semester-stats {
  color: #94a3b8;
  font-size: 0.9em;
  flex: 2;
}

.semester-active {
  color: #10b981;
  font-weight: 500;
  font-size: 0.9em;
  flex: 1;
  text-align: right;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }
  
  .charts-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .realtime-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }
}

@media (max-width: 768px) {
  .data-analysis-panel {
    padding: 16px;
  }
  
  .panel-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .header-controls {
    justify-content: space-between;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .realtime-card {
    padding: 16px;
  }
  
  .realtime-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .chart-card {
    padding: 16px;
  }
  
  .trend-svg {
    height: 150px;
  }
  
  .song-item {
    padding: 12px;
  }
  
  .song-rank-badge {
    width: 32px;
    height: 32px;
    font-size: 14px;
    margin-right: 12px;
  }
  
  .song-title {
    font-size: 14px;
  }
  
  .song-artist {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .data-analysis-panel {
    padding: 12px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .realtime-grid {
    grid-template-columns: 1fr;
  }
  
  .trend-legend {
    font-size: 10px;
  }
  
  .chart-btn {
    width: 28px;
    height: 28px;
  }
  
  .chart-btn svg {
    width: 14px;
    height: 14px;
  }
}

/* 活跃用户排名样式 */
.users-ranking {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
}

.user-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.user-rank {
  flex-shrink: 0;
}

.rank-badge {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.rank-badge.gold {
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  color: #92400e;
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
}

.rank-badge.silver {
  background: linear-gradient(135deg, #c0c0c0, #e5e7eb);
  color: #374151;
  box-shadow: 0 4px 12px rgba(192, 192, 192, 0.3);
}

.rank-badge.bronze {
  background: linear-gradient(135deg, #cd7f32, #d97706);
  color: #92400e;
  box-shadow: 0 4px 12px rgba(205, 127, 50, 0.3);
}

.rank-badge.other {
  background: rgba(100, 116, 139, 0.2);
  color: #cbd5e1;
  border: 1px solid rgba(100, 116, 139, 0.3);
}

.rank-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}

.rank-number {
  font-size: 16px;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 4px;
}

.user-details {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #94a3b8;
}

.contribution-count,
.like-count {
  display: flex;
  align-items: center;
  gap: 4px;
}

.user-stats {
  text-align: right;
  flex-shrink: 0;
}

.activity-score {
  font-size: 20px;
  font-weight: 700;
  color: #10b981;
  line-height: 1;
}

.score-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
  margin-bottom: 8px;
}

.activity-bar {
  width: 80px;
  height: 4px;
  background: rgba(100, 116, 139, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.activity-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 2px;
  transition: width 0.3s ease;
}

@media (max-width: 768px) {
  .user-item {
    padding: 12px;
    gap: 12px;
  }
  
  .rank-badge {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }
  
  .rank-icon {
    width: 16px;
    height: 16px;
  }
  
  .user-name {
    font-size: 14px;
  }
  
  .user-details {
    font-size: 12px;
    gap: 12px;
  }
  
  .activity-score {
    font-size: 16px;
  }
  
  .activity-bar {
    width: 60px;
  }
}

@media (max-width: 480px) {
  .user-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .user-rank {
    align-self: center;
  }
  
  .user-info {
    text-align: center;
    width: 100%;
  }
  
  .user-stats {
    text-align: center;
    width: 100%;
  }
  
  .user-details {
    justify-content: center;
  }
  
  .activity-bar {
    margin: 0 auto;
  }
}

/* 面板状态样式 */
.panel-loading {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  color: #4f46e5;
}

.chart-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #94a3b8;
}

.loading-content {
  text-align: center;
}

.loading-text {
  font-size: 14px;
  margin-top: 8px;
}

.chart-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #ef4444;
  text-align: center;
  gap: 16px;
}

.error-icon {
  width: 48px;
  height: 48px;
  color: #ef4444;
  opacity: 0.7;
}

.error-icon svg {
  width: 100%;
  height: 100%;
}

.chart-error p {
  margin: 0;
  font-size: 14px;
  color: #fca5a5;
}

/* 活跃用户悬停提示样式 */
.online-users-item {
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
}

.online-users-item:hover {
  background: rgba(79, 70, 229, 0.1);
  border-radius: 8px;
}

.users-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-radius: 12px;
  padding: 16px;
  min-width: 280px;
  max-width: 320px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
  z-index: 99999;
  animation: tooltipFadeIn 0.2s ease-out;
}

.users-tooltip::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-bottom: none;
  border-right: none;
  transform: translateX(-50%) rotate(45deg);
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.tooltip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(100, 116, 139, 0.3);
}

.tooltip-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #f1f5f9;
  background: linear-gradient(135deg, #0ea5e9, #06b6d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.user-count {
  font-size: 12px;
  color: #0ea5e9;
  background: rgba(14, 165, 233, 0.15);
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.users-list {
  max-height: 240px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.3) transparent;
}

.users-list::-webkit-scrollbar {
  width: 4px;
}

.users-list::-webkit-scrollbar-track {
  background: transparent;
}

.users-list::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.3);
  border-radius: 2px;
}

.user-item-tooltip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(100, 116, 139, 0.2);
  transition: all 0.2s ease;
}

.user-item-tooltip:last-child {
  border-bottom: none;
}

.user-item-tooltip:hover {
  background: rgba(100, 116, 139, 0.1);
  border-radius: 6px;
  padding: 8px 6px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #0ea5e9, #06b6d4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: white;
}

.user-info-tooltip {
  flex: 1;
  min-width: 0;
}

.user-info-tooltip .user-name {
  font-size: 14px;
  font-weight: 500;
  color: #f1f5f9;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-info-tooltip .user-username {
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-tooltip {
  text-align: center;
}

.empty-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #94a3b8;
  padding: 20px 0;
}

.empty-message svg {
  width: 36px;
  height: 36px;
  opacity: 0.5;
  color: #0ea5e9;
}

.empty-message p {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .users-tooltip {
    min-width: 240px;
    max-width: 280px;
    left: 0;
    transform: none;
    margin-left: 0;
  }
  
  .users-tooltip::before {
    left: 24px;
    transform: rotate(45deg);
  }
}

@media (max-width: 480px) {
  .users-tooltip {
    min-width: 200px;
    max-width: 240px;
    padding: 12px;
  }
  
  .user-item-tooltip {
    gap: 8px;
  }
  
  .user-avatar {
    width: 28px;
    height: 28px;
  }
  
  .avatar-placeholder {
    font-size: 12px;
  }
  
  .user-info-tooltip .user-name {
    font-size: 13px;
  }
  
  .user-info-tooltip .user-username {
    font-size: 11px;
  }
}

.retry-btn {
  padding: 8px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.retry-btn:active {
  transform: translateY(1px);
}

/* 全局悬浮提示框样式 */
.users-tooltip-global {
  position: fixed;
  z-index: 999999;
  background: linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98));
  backdrop-filter: blur(16px);
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-radius: 16px;
  padding: 18px;
  min-width: 280px;
  max-width: 320px;
  max-height: 300px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3), 0 10px 20px -5px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(100, 116, 139, 0.2);
  animation: tooltipFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.users-tooltip-global::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid rgba(15, 23, 42, 0.98);
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
}

/* 当tooltip在下方显示时，箭头在上方 */
.users-tooltip-global.tooltip-below::before {
  top: -8px;
  border-top: none;
  border-bottom: 8px solid rgba(15, 23, 42, 0.98);
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

/* 响应式设计 - 全局tooltip */
@media (max-width: 768px) {
  .users-tooltip-global {
    min-width: 240px;
    max-width: 280px;
    padding: 14px;
  }
}

@media (max-width: 480px) {
  .users-tooltip-global {
    min-width: 200px;
    max-width: 240px;
    padding: 12px;
    font-size: 13px;
  }
  
  .users-tooltip-global .tooltip-header h4 {
    font-size: 13px;
  }
  
  .users-tooltip-global .user-count {
    font-size: 11px;
  }
}
</style>