<template>
  <section class="page">
    <mdui-card class="section-card">
      <div class="section-card__header">
        <div>
          <div class="eyebrow">图片哈希处理</div>
          <h1>批量生成 phash 和 MD5</h1>
          <p class="muted">为现有图片生成哈希值，用于重复图片检测。</p>
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
            ></AppTextField>
          </div>
          <mdui-button
            variant="filled"
            :loading="processing"
            :disabled="processing"
            @click="processBatch"
          >
            开始处理
          </mdui-button>
        </div>

        <div v-if="status" class="hash-processor__status">
          <div class="status-item">
            <span class="status-label">已处理:</span>
            <span class="status-value">{{ status.processed }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">失败:</span>
            <span class="status-value" :class="{ 'status-value--error': status.failed > 0 }">{{ status.failed }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">剩余:</span>
            <span class="status-value">{{ status.remaining }}</span>
          </div>
        </div>

        <div v-if="status?.message" class="hash-processor__message">
          {{ status.message }}
        </div>

        <div v-if="status" class="hash-processor__progress">
          <div class="progress-bar">
            <div 
              class="progress-bar__fill" 
              :style="{ width: progressWidth + '%' }"
            ></div>
          </div>
          <span class="progress-text">{{ progressText }}</span>
        </div>
      </div>
    </mdui-card>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppSelect from '@/components/form/AppSelect.vue'
import AppTextField from '@/components/form/AppTextField.vue'
import { showToast } from '@/lib/toast'
import { getErrorMessage } from '@/lib/errors'
import { requireSupabase } from '@/lib/supabase'

const tableOptions = [
  { label: 'images 表（已发布图片）', value: 'images' },
  { label: 'submissions 表（投稿）', value: 'submissions' },
]

const targetTable = ref('images')
const batchSize = ref(10)
const processing = ref(false)
const status = ref(null)

const progressWidth = computed(() => {
  if (!status.value) return 0
  const total = status.value.processed + status.value.failed + status.value.remaining
  if (total === 0) return 0
  return Math.min(100, ((status.value.processed + status.value.failed) / total) * 100)
})

const progressText = computed(() => {
  if (!status.value) return ''
  const { processed, failed, remaining } = status.value
  return `已处理 ${processed}，失败 ${failed}，剩余 ${remaining}`
})

async function processBatch() {
  processing.value = true
  status.value = null
  
  try {
    const supabase = requireSupabase()
    
    const { data, error } = await supabase.functions.invoke('process-image-hashes', {
      body: {
        table: targetTable.value,
        batchSize: parseInt(batchSize.value),
        offset: 0,
      },
    })
    
    if (error) throw error
    
    status.value = data
    
    if (data.remaining > 0) {
      showToast(`已处理 ${data.processed} 条，剩余 ${data.remaining} 条`)
    } else {
      showToast('所有图片处理完成！')
    }
  } catch (error) {
    showToast(getErrorMessage(error))
    status.value = { message: getErrorMessage(error), processed: 0, failed: 0, remaining: 0 }
  } finally {
    processing.value = false
  }
}
</script>

<style scoped>
.hash-processor {
  margin-top: 20px;
}

.hash-processor__controls {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.hash-processor__status {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 20px;
  padding: 16px;
  background: rgba(17, 24, 39, 0.03);
  border-radius: 12px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-label {
  font-size: 12px;
  color: #8a9aaa;
}

.status-value {
  font-size: 24px;
  font-weight: 600;
}

.status-value--error {
  color: #dc2626;
}

.hash-processor__message {
  margin-top: 12px;
  padding: 12px;
  background: rgba(103, 80, 164, 0.08);
  border-radius: 8px;
  font-size: 13px;
  color: #6750a4;
}

.hash-processor__progress {
  margin-top: 20px;
}

.progress-bar {
  height: 8px;
  background: rgba(17, 24, 39, 0.08);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  background: linear-gradient(90deg, #6750a4, #9c7bd9);
  transition: width 0.3s ease;
}

.progress-text {
  margin-top: 8px;
  font-size: 12px;
  color: #8a9aaa;
}
</style>
