'use client'
import { createContext, useCallback, useContext, useState } from 'react'

type ToastType = 'success' | 'error' | 'warning'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
  confirm: (options: ConfirmOptions | string) => Promise<boolean>
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

let nextId = 1

const toastStyles: Record<ToastType, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-yellow-400 text-yellow-900',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null)

  const removeToast = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++
    setToasts((ts) => [...ts, { id, message, type }])
    setTimeout(() => removeToast(id), 4000)
  }, [removeToast])

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts = typeof options === 'string' ? { message: options } : options
    return new Promise<boolean>((resolve) => {
      setConfirmState({ options: opts, resolve })
    })
  }, [])

  const resolveConfirm = (result: boolean) => {
    if (confirmState) confirmState.resolve(result)
    setConfirmState(null)
  }

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg shadow-lg px-4 py-3 text-sm ${toastStyles[t.type]}`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss"
              className="font-bold leading-none opacity-80 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation modal */}
      {confirmState && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className={`text-lg font-bold mb-2 ${confirmState.options.danger ? 'text-red-700' : 'text-gray-800'}`}>
              {confirmState.options.title || 'Please confirm'}
            </h3>
            <p className="text-sm text-gray-700 mb-4">{confirmState.options.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => resolveConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50"
              >
                {confirmState.options.cancelLabel || 'Cancel'}
              </button>
              <button
                onClick={() => resolveConfirm(true)}
                className={`px-4 py-2 rounded text-sm text-white ${confirmState.options.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {confirmState.options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
