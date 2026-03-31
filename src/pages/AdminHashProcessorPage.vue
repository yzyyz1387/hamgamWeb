<template>
  <section class="page hash-page">
    <mdui-card class="section-card">
      <div class="section-card__header section-card__header--wrap">
        <div>
          <div class="eyebrow">图片哈希处理</div>
          <h1>批量生成 pHash / MD5</h1>
          <p class="muted">前端只负责触发和展示进度，真正的哈希计算与数据库写入由 Supabase Edge Function 完成。</p>
        </div>
        <div class="hash-header-actions">
          <mdui-button variant="text" @click="clearLogs" :disabled="processing">清空日志</mdui-button>
          <mdui-button variant="text" @click="stopAfterCurrentBatch = !stopAfterCurrentBatch" :disabled="!processing">
            {{ stopAfterCurrentBatch ? '继续批处理' : '当前批次后停止' }}
          </mdui-button>
        </div>
      </div>

      <div class="hash-processor">
        <div class="hash-processor__controls">
          <div class="form-control">
            <AppSelect
              id="target-table"
              v-model="targetTable"
              label="目标表"
              :options="tableOptions"
            ></AppSelect>
          </div>
          <div class="form-control">
            <AppTextField
              v-model="batchSize"
              label="批次大小"
              type="number"
              :min="1"
              :max="100"
              number
            ></AppTextField>
          </div>
          <label class="hash-option-chip">
            <input v-model="forceReprocess" type="checkbox" />
            <span>强制重算已有哈希</span>
          </label>
          <mdui-button
            variant="filled"
            :loading="processing"
            :disabled="processing"
            @click="processAll"
          >
            开始处理
          </mdui-button>
        </div>

        <div v-if="pluginNotice" class="hash-processor__notice">
          {{ pluginNotice }}
        </div>

        <div class="hash-metrics-grid">
          <div class="hash-metric-card">
            <span>本次已处理</span>
            <strong>{{ metrics.processed }}</strong>
          </div>
          <div class="hash-metric-card">
            <span>失败</span>
            <strong :class="{ 'hash-metric-card__value--danger': metrics.failed > 0 }">{{ metrics.failed }}</strong>
          </div>
          <div class="hash-metric-card">
            <span>预计剩余</span>
            <strong>{{ metrics.remaining }}</strong>
          </div>
          <div class="hash-metric-card">
            <span>状态</span>
            <strong>{{ processing ? '运行中' : '空闲' }}</strong>
          </div>
        </div>

        <div v-if="statusMessage" class="hash-processor__message">
          {{ statusMessage }}
        </div>

        <div class="hash-console">
          <div class="hash-console__toolbar">
            <span class="hash-console__title">处理日志</span>
            <span class="hash-console__subtitle">最新记录显示在上方</span>
          </div>
          <div class="hash-console__body">
            <div v-if="!logs.length" class="hash-console__empty">还没有处理记录。</div>
            <div
              v-for="log in logs"
              :key="log.id"
              class="hash-console__line"
              :class="`hash-console__line--${log.level}`"
            >
              <span class="hash-console__time">{{ log.time }}</span>
              <span class="hash-console__tag">{{ log.tag }}</span>
              <span class="hash-console__text">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </mdui-card>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppSelect from '@/components/form/AppSelect.vue'
import AppTextField from '@/components/form/AppTextField.vue'
import { showToast } from '@/lib/toast'
import { getErrorMessage } from '@/lib/errors'
import { requireSupabase } from '@/lib/supabase'
import { getPluginConfig } from '@/plugins/runtime'

const pluginConfig = computed(() => getPluginConfig('hash-processor'))
const tableOptions = computed(() => {
  const options = [{ label: 'images 表（已发布图片）', value: 'images' }]
  if (pluginConfig.value.allowSubmissionsTable !== false) {
    options.push({ label: 'submissions 表（投稿）', value: 'submissions' })
  }
  return options
})

const targetTable = ref(pluginConfig.value.defaultTargetTable || 'images')
const batchSize = ref(Number(pluginConfig.value.defaultBatchSize || 10))
const forceReprocess = ref(false)
const processing = ref(false)
const stopAfterCurrentBatch = ref(false)
const statusMessage = ref('')
const logs = ref([])
const metrics = ref({ processed: 0, failed: 0, remaining: 0 })

const pluginNotice = computed(() => {
  if (pluginConfig.value.allowSubmissionsTable === false) {
    return '当前插件配置已禁用 submissions 表处理，只允许处理 images 表。'
  }
  return '请在 Supabase Edge Functions 中部署 process-image-hashes，并为该函数配置 SUPABASE_SERVICE_ROLE_KEY。前端不应暴露 service role key。'
})

function nowLabel() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function pushLog(tag, message, level = 'info') {
  logs.value.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: nowLabel(),
    tag,
    message,
    level,
  })
}

function clearLogs() {
  logs.value = []
}

function normalizeBatchSize() {
  const raw = Number(batchSize.value)
  if (Number.isNaN(raw)) return 10
  return Math.max(1, Math.min(100, raw))
}

async function invokeHashFunction({ table, batchSize, forceReprocess }) {
  const supabase = requireSupabase()
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  if (!accessToken) {
    throw new Error('当前会话无效，请重新登录后再试。')
  }

  const { data, error } = await supabase.functions.invoke('process-image-hashes', {
    body: { table, batchSize, forceReprocess },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (error) throw error
  return data
}

async function processAll() {
  processing.value = true
  stopAfterCurrentBatch.value = false
  statusMessage.value = ''
  metrics.value = { processed: 0, failed: 0, remaining: 0 }

  try {
    const nextTable = tableOptions.value.some((option) => option.value === targetTable.value)
      ? targetTable.value
      : tableOptions.value[0]?.value || 'images'
    const nextBatchSize = normalizeBatchSize()
    targetTable.value = nextTable
    batchSize.value = nextBatchSize

    pushLog('START', `开始处理 ${nextTable}，批次大小 ${nextBatchSize}${forceReprocess.value ? '（强制重算）' : ''}`)

    let rounds = 0
    while (true) {
      rounds += 1
      pushLog('BATCH', `第 ${rounds} 轮开始…`)
      const data = await invokeHashFunction({
        table: nextTable,
        batchSize: nextBatchSize,
        forceReprocess: forceReprocess.value,
      })

      metrics.value = {
        processed: metrics.value.processed + Number(data?.processed || 0),
        failed: metrics.value.failed + Number(data?.failed || 0),
        remaining: Number(data?.remaining || 0),
      }
      statusMessage.value = data?.message || ''

      pushLog('DONE', `本轮成功 ${data?.processed || 0} 条，失败 ${data?.failed || 0} 条，剩余 ${data?.remaining || 0} 条`, data?.failed ? 'warn' : 'success')

      const failures = Array.isArray(data?.failures) ? data.failures : []
      for (const failure of failures.slice(0, 8)) {
        pushLog('FAIL', `ID ${failure.id}: ${failure.error}`, 'error')
      }

      if (stopAfterCurrentBatch.value) {
        pushLog('STOP', '已按要求在当前批次后停止。', 'warn')
        break
      }

      if (!data?.remaining || data.remaining <= 0 || (!data?.processed && !data?.failed)) {
        break
      }
    }

    showToast(metrics.value.failed > 0 ? '哈希处理完成，但有部分失败记录。' : '哈希处理完成。')
  } catch (error) {
    const message = getErrorMessage(error)
    if (/non-2xx|404|FunctionsHttpError/i.test(message)) {
      pushLog('ERROR', 'process-image-hashes 尚未部署，或 Edge Function 内部报错。', 'error')
      statusMessage.value = 'Edge Function 调用失败。请先部署 process-image-hashes，并在 Supabase Functions Secrets 中配置 SUPABASE_SERVICE_ROLE_KEY。'
    } else {
      pushLog('ERROR', message, 'error')
      statusMessage.value = message
    }
    showToast(message)
  } finally {
    processing.value = false
    stopAfterCurrentBatch.value = false
  }
}
</script>

<style scoped>
.hash-page { max-width: 1120px; }
.hash-processor { margin-top: 20px; display: grid; gap: 18px; }
.hash-processor__controls {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.hash-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.hash-option-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding: 0 14px;
  border-radius: 14px;
  background: rgba(17, 24, 39, 0.04);
  color: #334155;
}
.hash-option-chip input { accent-color: #6750a4; }
.hash-processor__notice,
.hash-processor__message {
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 13px;
  color: #4c1d95;
  background: rgba(103, 80, 164, 0.08);
}
.hash-metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.hash-metric-card {
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(17, 24, 39, 0.04);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hash-metric-card span { color: #64748b; font-size: 12px; }
.hash-metric-card strong { font-size: 24px; }
.hash-metric-card__value--danger { color: #dc2626; }
.hash-console {
  border-radius: 20px;
  overflow: hidden;
  background: #0b1120;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.12);
}
.hash-console__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(15, 23, 42, 0.9);
  color: #cbd5e1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.hash-console__title { font-weight: 700; }
.hash-console__subtitle { font-size: 12px; color: #94a3b8; }
.hash-console__body {
  max-height: 420px;
  overflow: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hash-console__empty {
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.hash-console__line {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  color: #e2e8f0;
}
.hash-console__time { color: #94a3b8; }
.hash-console__tag {
  min-width: 54px;
  color: #93c5fd;
}
.hash-console__line--success .hash-console__tag { color: #86efac; }
.hash-console__line--warn .hash-console__tag { color: #fde68a; }
.hash-console__line--error .hash-console__tag { color: #fca5a5; }
.hash-console__text { flex: 1; min-width: 0; word-break: break-word; }

@media (max-width: 768px) {
  .hash-metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hash-console__toolbar { flex-direction: column; align-items: flex-start; }
}
</style>
