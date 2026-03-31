<script setup>
const props = defineProps({
  profile: {
    type: Object,
    default: () => ({}),
  },
})
</script>

<template>
  <section class="profile-panel">
    <div class="panel-head">
      <p class="eyebrow">扩展资料</p>
      <h3>__PLUGIN_NAME__</h3>
    </div>
    <div class="info-row">
      <span>昵称</span>
      <strong>{{ props.profile.nickname || '未设置' }}</strong>
    </div>
    <div class="info-row">
      <span>UID</span>
      <strong>{{ props.profile.uid || '未生成' }}</strong>
    </div>
    <p class="hint">把这张卡替换成你的业务资料面板即可。</p>
  </section>
</template>

<style scoped>
.profile-panel {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 22px;
  background: var(--mdui-color-surface-container-low, #fff);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}
.panel-head h3,
.panel-head p {
  margin: 0;
}
.eyebrow {
  margin-bottom: 6px !important;
  font-size: 12px;
  color: var(--mdui-color-primary, #6750a4);
  font-weight: 700;
}
.info-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--mdui-color-surface-container, #f5f5f7);
}
.hint {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}
</style>
