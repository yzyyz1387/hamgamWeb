import { snackbar } from 'mdui'

export function showToast(message, options = {}) {
  snackbar({
    message,
    closeable: true,
    placement: 'bottom-end',
    ...options,
  })
}

export function showError(message) {
  snackbar({
    message,
    closeable: true,
    placement: 'bottom-end',
    action: '知道了',
    autoCloseDelay: 6000,
  })
}
