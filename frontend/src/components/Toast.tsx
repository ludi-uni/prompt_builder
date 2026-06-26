import './Toast.css'

interface ToastProps {
  message: string | null
  type?: 'error' | 'success' | 'info'
  onDismiss: () => void
}

export function Toast({ message, type = 'info', onDismiss }: ToastProps) {
  if (!message) return null

  return (
    <div className={`toast toast-${type}`} role="alert">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
