<template>
  <div class="workbench-config-dialog-layout">
    <div class="workbench-config-dialog-layout__body">
      <slot />
    </div>

    <div class="workbench-config-dialog-layout__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.workbench-config-dialog-layout {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px 20px 20px;
}

.workbench-config-dialog-layout__body {
  min-width: 0;
}

.workbench-config-dialog-layout__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--b3-border-color);
}
</style>
