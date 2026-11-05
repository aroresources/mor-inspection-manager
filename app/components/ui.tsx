'use client'
import React, { useEffect } from 'react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates, arrayMove,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'

// ---------------------------------------------------------------------------
// MOR design system — shared primitives.
// Indigo/navy accent on a slate-neutral chrome. Import from '../../components/ui'.
// Tailwind v4 (JIT): every class string below is a literal so it compiles.
// ---------------------------------------------------------------------------

export type Tone = 'indigo' | 'slate' | 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'gray'

const BAR: Record<Tone, string> = {
  indigo: 'bg-indigo-500', slate: 'bg-slate-400', red: 'bg-red-500', amber: 'bg-amber-500',
  green: 'bg-emerald-500', blue: 'bg-blue-500', purple: 'bg-purple-500', gray: 'bg-slate-300',
}
const BADGE: Record<Tone, string> = {
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/10',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/10',
  red: 'bg-red-50 text-red-700 ring-red-600/10',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/10',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/10',
  gray: 'bg-slate-100 text-slate-500 ring-slate-500/10',
}

// Trello-style card: hairline border, soft shadow, optional colored status strip.
export function Card(
  { accent, onClick, className = '', children }:
  { accent?: Tone; onClick?: () => void; className?: string; children: React.ReactNode }
) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition hover:shadow-md hover:border-slate-300 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {accent && <div className={`h-1.5 ${BAR[accent]}`} />}
      {children}
    </div>
  )
}
export function CardBody({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`p-4 ${className}`}>{children}</div>
}

export function StatusBadge({ tone = 'gray', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ring-1 ring-inset ${BADGE[tone]}`}>{children}</span>
}

export function MetaChip({ icon, children, className = '' }: { icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 bg-slate-50 text-slate-600 text-xs px-2.5 py-1 rounded-md ${className}`}>
      {icon && <span className="text-slate-400">{icon}</span>}{children}
    </span>
  )
}

export function Avatar({ name, className = '' }: { name: string; className?: string }) {
  const initials = (name || '').split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
  return <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold ${className}`} title={name}>{initials}</span>
}

type BtnVariant = 'primary' | 'neutral' | 'danger' | 'ghost' | 'success'
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-indigo-600 text-white border border-transparent hover:bg-indigo-700 shadow-sm',
  success: 'bg-emerald-600 text-white border border-transparent hover:bg-emerald-700 shadow-sm',
  neutral: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
  ghost: 'bg-transparent text-slate-500 border border-transparent hover:text-slate-700 hover:bg-slate-100',
}
export function Button(
  { variant = 'neutral', size = 'md', className = '', children, ...rest }:
  { variant?: BtnVariant; size?: 'sm' | 'md'; className?: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'
  return (
    <button className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${pad} ${BTN[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}

// Plain white panel for form sections / content blocks.
export function SectionCard(
  { title, subtitle, actions, className = '', bodyClassName = '', children }:
  { title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string; bodyClassName?: string; children: React.ReactNode }
) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}

// Right-side slide-in panel. Click-to-open card editors live here.
export function Drawer(
  { open, onClose, title, subtitle, accent, footer, children }:
  { open: boolean; onClose: () => void; title?: React.ReactNode; subtitle?: React.ReactNode; accent?: Tone; footer?: React.ReactNode; children: React.ReactNode }
) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40 animate-[fadein_.15s_ease-out]" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col animate-[slidein_.2s_ease-out]">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-200">
          {accent && <span className={`mt-1 w-2.5 h-2.5 rounded-full ${BAR[accent]}`} />}
          <div className="flex-1 min-w-0">
            {title && <h3 className="text-base font-semibold text-slate-800 truncate">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 shrink-0"><Icon name="x" size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drag-to-reorder. SortableList sets up the context; each row renders via a
// render-prop that hands back the drag-handle props to attach to a grip.
// Pointer (desktop) + touch (long-press ~180ms, so taps/scroll still work).
// ---------------------------------------------------------------------------
export function SortableList(
  { ids, onReorder, className = '', children }:
  { ids: string[]; onReorder: (ids: string[]) => void; className?: string; children: React.ReactNode }
) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return
        const oldIndex = ids.indexOf(String(active.id))
        const newIndex = ids.indexOf(String(over.id))
        if (oldIndex < 0 || newIndex < 0) return
        onReorder(arrayMove(ids, oldIndex, newIndex))
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  )
}

type HandleProps = { attributes: any; listeners: any; isDragging: boolean; disabled: boolean }
export function SortableRow(
  { id, disabled = false, children }:
  { id: string; disabled?: boolean; children: (h: HandleProps) => React.ReactNode }
) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative',
  }
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-90' : ''}>
      {children({ attributes, listeners, isDragging, disabled })}
    </div>
  )
}

// A grip button to spread the sortable handle props onto.
export function DragHandle({ attributes, listeners, disabled, className = '' }: HandleProps & { className?: string }) {
  return (
    <button
      type="button"
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
      onClick={(e) => e.stopPropagation()}
      title={disabled ? 'Clear the filter to drag-reorder' : 'Drag to reorder'}
      aria-label="Drag to reorder"
      className={`shrink-0 touch-none ${disabled ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing'} ${className}`}
    >
      <Icon name="grip" size={18} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Minimal inline-SVG icon set (stroke = currentColor), dependency-free.
// ---------------------------------------------------------------------------
const PATHS: Record<string, React.ReactNode> = {
  calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></>,
  'calendar-due': <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4M12 13v4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  paperclip: <path d="M21 11.5l-8.5 8.5a5 5 0 01-7-7l8.5-8.5a3.3 3.3 0 014.7 4.7l-8.6 8.5a1.6 1.6 0 01-2.3-2.3l7.9-7.8" />,
  message: <path d="M21 12a8 8 0 01-11.5 7.2L4 21l1.8-5.5A8 8 0 1121 12z" />,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M9 7V4h6v3" /></>,
  edit: <path d="M4 20h4L19 9a2 2 0 00-3-3L5 17v3zM14 7l3 3" />,
  download: <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />,
  upload: <path d="M12 20V9m0 0L8 13m4-4l4 4M5 5h14" />,
  file: <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5" /></>,
  alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.1l-8-14a2 2 0 00-3.4 0z" /></>,
  chevron: <path d="M6 9l6 6 6-6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  flag: <path d="M5 21V4m0 0h11l-2 4 2 4H5" />,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0114 0" /></>,
  grip: <><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></>,
  arrowRight: <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />,
}
export function Icon({ name, className = '', size = 16 }: { name: string; className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={`inline-block shrink-0 ${className}`} aria-hidden="true">
      {PATHS[name] || null}
    </svg>
  )
}
