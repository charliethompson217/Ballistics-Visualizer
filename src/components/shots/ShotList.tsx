import { useRef, useState, type DragEvent } from 'react'
import type { Shot, ShotInputMode } from '../../ballistics/types'
import type { ShotErrors } from '../../validation/shotSchema'
import type { UnitSystem } from '../../units/conversions'
import { Icon } from '../Icon'
import { ShotCard } from './ShotCard'

interface ShotListProps {
  shots: Shot[]
  errors: Map<string, ShotErrors>
  units: UnitSystem
  energyRequested: boolean
  expandedId: string | null
  inputMode: ShotInputMode
  onExpand: (id: string) => void
  onChange: (shot: Shot) => void
  onReorder: (sourceId: string, targetId: string, position: 'before' | 'after') => void
  onInputModeChange: (mode: ShotInputMode) => void
  onAdd: () => void
  onDuplicate: (shot: Shot) => void
  onDelete: (id: string) => void
  fileStatus: { type: 'success' | 'error'; message: string } | null
  onImport: (file: File) => Promise<void>
  onExport: () => void
}

export function ShotList({ shots, errors, units, energyRequested, expandedId, inputMode, onExpand, onChange, onReorder, onInputModeChange, onAdd, onDuplicate, onDelete, fileStatus, onImport, onExport }: ShotListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null)
  const [reorderStatus, setReorderStatus] = useState('')
  const sourceName = shots.find((shot) => shot.id === expandedId)?.name ?? shots[0]?.name ?? 'the first trajectory'

  const stopDragging = () => {
    setDraggedId(null)
    setDropTarget(null)
  }

  const dropPosition = (event: DragEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
  }

  const moveWithKeyboard = (index: number, direction: -1 | 1) => {
    const target = shots[index + direction]
    if (!target) return
    onReorder(shots[index].id, target.id, direction === -1 ? 'before' : 'after')
    setReorderStatus(`${shots[index].name || 'Untitled trajectory'} moved to position ${index + direction + 1} of ${shots.length}.`)
  }

  return (
    <aside className="shot-panel" id="trajectory-editor">
      <div className="panel-heading">
        <h2>Trajectories</h2>
        <span className="count-badge">{shots.length}</span>
      </div>

      <section className="input-mode-panel" aria-labelledby="input-mode-title">
        <div className="input-mode-panel__heading">
          <span id="input-mode-title">Trajectory inputs</span>
          <div className="mode-switch" aria-label="Trajectory input relationship">
            <button className={inputMode === 'independent' ? 'is-active' : ''} type="button" onClick={() => onInputModeChange('independent')}>Independent</button>
            <button className={inputMode === 'sharedConditions' ? 'is-active' : ''} type="button" onClick={() => onInputModeChange('sharedConditions')} title={`Copy shared conditions from ${sourceName}`}>Shared conditions</button>
          </div>
        </div>
        <p>
          {inputMode === 'sharedConditions'
            ? 'Scope, atmosphere, wind, angle, and rifle twist stay matched. Ammunition and powder inputs remain separate.'
            : `Each trajectory is fully separate. Choosing Shared conditions copies the non-ammunition setup from ${sourceName}.`}
        </p>
      </section>

      <p className="shot-list__hint">Drag the grip to reorder · Click a color to change it</p>
      <span className="visually-hidden" role="status">{reorderStatus}</span>
      <div className="shot-list" onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null)
      }}>
        {shots.map((shot, index) => (
          <div
            key={shot.id}
            className={`shot-list__item ${draggedId === shot.id ? 'is-dragging' : ''} ${dropTarget?.id === shot.id ? `shot-list__item--drop-${dropTarget.position}` : ''}`}
            onDragOver={(event) => {
              if (!draggedId) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setDropTarget(draggedId === shot.id ? null : { id: shot.id, position: dropPosition(event) })
            }}
            onDrop={(event) => {
              if (!draggedId) return
              event.preventDefault()
              onReorder(draggedId, shot.id, dropPosition(event))
              stopDragging()
            }}
          >
            <ShotCard
              shot={shot}
              index={index}
              errors={errors.get(shot.id) ?? {}}
              units={units}
              energyRequested={energyRequested}
              expanded={expandedId === shot.id}
              sharedConditions={inputMode === 'sharedConditions'}
              onExpand={() => onExpand(shot.id)}
              onChange={onChange}
              onDuplicate={() => onDuplicate(shot)}
              onDelete={() => onDelete(shot.id)}
              onDragStart={() => setDraggedId(shot.id)}
              onDragEnd={stopDragging}
              onMove={(direction) => moveWithKeyboard(index, direction)}
            />
          </div>
        ))}
      </div>

      <button className="add-shot-button" type="button" onClick={onAdd}>
        <Icon name="plus" />
        Add trajectory
      </button>

      <div className="shot-file-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Import trajectory JSON file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void onImport(file)
            event.currentTarget.value = ''
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          <Icon name="upload" size={15} />
          Import JSON
        </button>
        <button type="button" onClick={onExport} disabled={shots.length === 0}>
          <Icon name="download" size={15} />
          Export JSON
        </button>
      </div>
      {fileStatus && <p className={`shot-file-status shot-file-status--${fileStatus.type}`} role="status">{fileStatus.message}</p>}
    </aside>
  )
}
