import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { CalculationQuality, GraphView } from '../../ballistics/types'
import {
  axisRangeLabel,
  fromAxisRange,
  metersToYards,
  toAxisRange,
  type ImperialRangeUnit,
  type UnitSystem,
} from '../../units/conversions'
import { Icon } from '../Icon'

interface RangePreset {
  label: string
  min: number
  max: number
}

const YARD_RANGE_PRESETS: RangePreset[] = [
  { label: '0–25 yd', min: 0, max: 25 },
  { label: '0–50 yd', min: 0, max: 50 },
  { label: '0–100 yd', min: 0, max: 100 },
  { label: '0–500 yd', min: 0, max: 500 },
  { label: '0–1,000 yd', min: 0, max: 1000 },
]

const FEET_RANGE_PRESETS: RangePreset[] = [25, 50, 100, 500, 1000].map((max) => ({
  label: `0–${max.toLocaleString()} ft`,
  min: 0,
  max: fromAxisRange(max, 'imperial', 'feet'),
}))

const METRIC_RANGE_PRESETS: RangePreset[] = [10, 25, 100, 500, 1000].map((max) => ({
  label: `0–${max.toLocaleString()} m`,
  min: 0,
  max: metersToYards(max),
}))

const GRAPH_VIEWS: Array<{ value: GraphView; label: string }> = [
  { value: 'pathInches', label: 'Vertical path' },
  { value: 'windageInches', label: 'Horizontal path' },
  { value: 'velocityFps', label: 'Velocity' },
  { value: 'energyFtLb', label: 'Kinetic energy' },
  { value: 'bullseye', label: 'Bullseye impact' },
]

interface GraphControlsProps {
  views: GraphView[]
  viewOrder: GraphView[]
  range: { minX: number; maxX: number }
  units: UnitSystem
  rangeUnit: ImperialRangeUnit
  sidebarOpen: boolean
  zoomLocked: boolean
  calculationQuality: CalculationQuality
  onViewsChange: (views: GraphView[]) => void
  onViewOrderChange: (views: GraphView[]) => void
  onGraphLayoutChange: (layout: 'compact' | 'full') => void
  onRangeChange: (range: { minX: number; maxX: number }) => void
  onReset: () => void
  onToggleSidebar: () => void
  onToggleZoomLock: () => void
  onUnitsChange: (units: UnitSystem) => void
  onRangeUnitChange: (unit: ImperialRangeUnit) => void
  onCalculationQualityChange: (quality: CalculationQuality) => void
}

export function GraphControls({ views, viewOrder, range, units, rangeUnit, sidebarOpen, zoomLocked, calculationQuality, onViewsChange, onViewOrderChange, onGraphLayoutChange, onRangeChange, onReset, onToggleSidebar, onToggleZoomLock, onUnitsChange, onRangeUnitChange, onCalculationQualityChange }: GraphControlsProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [draggedView, setDraggedView] = useState<GraphView | null>(null)
  const rangePresets = units === 'metric'
    ? METRIC_RANGE_PRESETS
    : rangeUnit === 'feet' ? FEET_RANGE_PRESETS : YARD_RANGE_PRESETS
  const matchingPreset = rangePresets.find((preset) =>
    Math.abs(preset.min - range.minX) < 0.001 && Math.abs(preset.max - range.maxX) < 0.001,
  )

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (detailsRef.current?.open && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && detailsRef.current?.open) {
        detailsRef.current.open = false
        detailsRef.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const dropAt = (event: DragEvent<HTMLDivElement>, targetView: GraphView) => {
    event.preventDefault()
    if (!draggedView || draggedView === targetView) return
    const next = viewOrder.filter((view) => view !== draggedView)
    const targetIndex = next.indexOf(targetView)
    const insertAfter = event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.clientHeight / 2
    next.splice(targetIndex + (insertAfter ? 1 : 0), 0, draggedView)
    onViewOrderChange(next)
    setDraggedView(null)
  }

  return (
    <div className="graph-controls">
      <div className="select-control select-control--metric graph-picker">
        <span>Graphs</span>
        <details ref={detailsRef}>
          <summary>{views.length === 1 ? GRAPH_VIEWS.find((option) => option.value === views[0])?.label : `${views.length} views`}</summary>
          <div className="graph-picker__menu">
            <div className="graph-picker__heading">
              <span>Visible views</span>
              <button type="button" onClick={() => onViewsChange(viewOrder)}>Show all</button>
            </div>
            {viewOrder.map((view) => {
              const option = GRAPH_VIEWS.find((item) => item.value === view)!
              const checked = views.includes(option.value)
              return (
                <div
                  className={`graph-picker__row ${draggedView === option.value ? 'is-dragging' : ''}`}
                  key={option.value}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => dropAt(event, option.value)}
                >
                  <span
                    className="graph-picker__drag"
                    draggable
                    title={`Drag to reorder ${option.label}`}
                    aria-label={`Drag to reorder ${option.label}`}
                    onDragStart={(event) => {
                      setDraggedView(option.value)
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', option.value)
                    }}
                    onDragEnd={() => setDraggedView(null)}
                  ><i /><i /><i /></span>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={checked && views.length === 1}
                      onChange={() => onViewsChange(
                        checked ? views.filter((view) => view !== option.value) : [...views, option.value],
                      )}
                    />
                    <span>{option.label}</span>
                  </label>
                </div>
              )
            })}
            <div className="graph-picker__layouts">
              <button type="button" onClick={() => onGraphLayoutChange('compact')}>Compact all</button>
              <button type="button" onClick={() => onGraphLayoutChange('full')}>Full height</button>
            </div>
          </div>
        </details>
      </div>

      <label className="select-control select-control--range">
        <span>Range</span>
        <select
          value={matchingPreset?.label ?? 'Custom'}
          onChange={(event) => {
            const preset = rangePresets.find((item) => item.label === event.target.value)
            if (preset) onRangeChange({ minX: preset.min, maxX: preset.max })
          }}
        >
          {rangePresets.map((preset) => <option key={preset.label}>{preset.label}</option>)}
          <option>Custom</option>
        </select>
      </label>

      <label className="select-control select-control--axis">
        <span>X axis</span>
        {units === 'imperial' ? (
          <select value={rangeUnit} onChange={(event) => onRangeUnitChange(event.target.value as ImperialRangeUnit)}>
            <option value="yards">Yards</option>
            <option value="feet">Feet</option>
          </select>
        ) : (
          <select value="meters" disabled><option value="meters">Meters</option></select>
        )}
      </label>

      <div className="range-inputs" aria-label="Custom graph range">
        <label><span>From</span><input type="number" min="0" step="any" value={toAxisRange(range.minX, units, rangeUnit)} onChange={(event) => onRangeChange({ ...range, minX: fromAxisRange(Number(event.target.value), units, rangeUnit) })} /></label>
        <span className="range-divider">—</span>
        <label><span>To</span><input type="number" min="0.1" step="any" value={toAxisRange(range.maxX, units, rangeUnit)} onChange={(event) => onRangeChange({ ...range, maxX: fromAxisRange(Number(event.target.value), units, rangeUnit) })} /></label>
        <span className="range-unit">{axisRangeLabel(units, rangeUnit)}</span>
      </div>

      <div className="graph-actions">
        <label className="unit-control unit-control--quality" title="Higher detail calculates more trajectory samples and may respond more slowly.">
          <span>Detail</span>
          <select value={calculationQuality} onChange={(event) => onCalculationQualityChange(event.target.value as CalculationQuality)}>
            <option value="fast">Fast</option>
            <option value="detailed">Detailed</option>
            <option value="maximum">Maximum</option>
          </select>
        </label>
        <label className="unit-control">
          <span>Units</span>
          <select value={units} onChange={(event) => onUnitsChange(event.target.value as UnitSystem)}>
            <option value="imperial">US</option>
            <option value="metric">Metric</option>
          </select>
        </label>
        <button
          type="button"
          className={`control-button ${zoomLocked ? 'is-active' : ''}`}
          aria-pressed={zoomLocked}
          onClick={onToggleZoomLock}
        >
          <Icon name="lock" size={15} />
          {zoomLocked ? 'Unlock zoom' : 'Lock zoom'}
        </button>
        <button type="button" className="control-button" onClick={onReset}><Icon name="reset" size={16} />Reset</button>
        <button type="button" className="control-button" onClick={onToggleSidebar}><Icon name="collapse" size={16} />{sidebarOpen ? 'Hide editor' : 'Show editor'}</button>
      </div>
    </div>
  )
}
