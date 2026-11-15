import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

const MIN_GRAPH_WIDTH = 400
const MIN_EDITOR_WIDTH = 360
const DIVIDER_WIDTH = 12

export function PanelDivider() {
  const dividerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; editorWidth: number } | null>(null)
  const [editorPercent, setEditorPercent] = useState(0)
  const [limits, setLimits] = useState({ min: 0, max: 100 })
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const divider = dividerRef.current
    const workspace = divider?.parentElement
    const editor = divider?.nextElementSibling
    if (!workspace || !editor) return

    const observer = new ResizeObserver(() => {
      const width = workspace.clientWidth
      if (width <= 900) return
      setEditorPercent(Math.round(editor.getBoundingClientRect().width / width * 100))
      setLimits({
        min: Math.round(MIN_EDITOR_WIDTH / width * 100),
        max: Math.round((width - MIN_GRAPH_WIDTH - DIVIDER_WIDTH) / width * 100),
      })
    })
    observer.observe(workspace)
    observer.observe(editor)
    return () => {
      observer.disconnect()
      workspace.classList.remove('workspace--resizing')
    }
  }, [])

  const resizeEditor = (width: number) => {
    const workspace = dividerRef.current?.parentElement
    if (!workspace) return
    const nextWidth = Math.max(MIN_EDITOR_WIDTH, Math.min(workspace.clientWidth - MIN_GRAPH_WIDTH - DIVIDER_WIDTH, width))
    workspace.style.setProperty('--editor-width', `${nextWidth / workspace.clientWidth * 100}%`)
  }

  const stopResize = () => {
    dragRef.current = null
    setDragging(false)
    dividerRef.current?.parentElement?.classList.remove('workspace--resizing')
  }

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return
    const editor = event.currentTarget.nextElementSibling
    if (!editor) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, editorWidth: editor.getBoundingClientRect().width }
    setDragging(true)
    event.currentTarget.parentElement?.classList.add('workspace--resizing')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const editor = event.currentTarget.nextElementSibling
    if (!editor) return
    const step = event.shiftKey ? 50 : 10
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      resizeEditor(editor.getBoundingClientRect().width + (event.key === 'ArrowLeft' ? step : -step))
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      resizeEditor(event.key === 'Home' ? MIN_EDITOR_WIDTH : Infinity)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.parentElement?.style.removeProperty('--editor-width')
    }
  }

  return (
    <div
      ref={dividerRef}
      className={`panel-divider${dragging ? ' panel-divider--dragging' : ''}`}
      role="separator"
      tabIndex={0}
      aria-label="Resize trajectory editor"
      aria-orientation="vertical"
      aria-controls="trajectory-editor"
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      aria-valuenow={editorPercent}
      aria-valuetext={`Trajectory editor ${editorPercent}%`}
      title="Drag to resize panels · Double-click to reset · Arrow keys to adjust"
      onPointerDown={startResize}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (drag?.pointerId === event.pointerId) resizeEditor(drag.editorWidth + drag.startX - event.clientX)
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId !== event.pointerId) return
        stopResize()
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={stopResize}
      onLostPointerCapture={stopResize}
      onDoubleClick={(event) => event.currentTarget.parentElement?.style.removeProperty('--editor-width')}
      onKeyDown={handleKeyDown}
    >
      <span />
    </div>
  )
}
