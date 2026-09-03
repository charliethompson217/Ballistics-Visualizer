import { useRef } from 'react'
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
  onInputModeChange: (mode: ShotInputMode) => void
  onAdd: () => void
  onDuplicate: (shot: Shot) => void
  onDelete: (id: string) => void
  fileStatus: { type: 'success' | 'error'; message: string } | null
  onImport: (file: File) => Promise<void>
  onExport: () => void
}

export function ShotList({ shots, errors, units, energyRequested, expandedId, inputMode, onExpand, onChange, onInputModeChange, onAdd, onDuplicate, onDelete, fileStatus, onImport, onExport }: ShotListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sourceName = shots.find((shot) => shot.id === expandedId)?.name ?? shots[0]?.name ?? 'the first trajectory'

  return (
    <aside className="shot-panel">
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

      <div className="shot-list">
        {shots.map((shot, index) => (
          <ShotCard
            key={shot.id}
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
          />
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
