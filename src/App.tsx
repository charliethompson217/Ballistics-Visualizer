import { useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import './App.css'
import type { CalculationQuality, GraphBounds, GraphMetric, GraphView, Shot, ShotInputMode, ShotTrajectory } from './ballistics/types'
import { calculateTrajectory, calculationRangeForView } from './ballistics/engine'
import { GraphControls } from './components/graph/GraphControls'
import { TrajectoryGraph } from './components/graph/TrajectoryGraph'
import { TrajectoryTooltip } from './components/graph/TrajectoryTooltip'
import { ExportResultsDialog } from './components/graph/ExportResultsDialog'
import { ShotList } from './components/shots/ShotList'
import { BullseyeView } from './components/target/BullseyeView'
import { PanelDivider } from './components/PanelDivider'
import { loadCalculationQuality, loadRangeUnit, loadShots, loadShotInputMode, loadUnitSystem, saveCalculationQuality, saveRangeUnit, saveShots, saveShotInputMode, saveUnitSystem } from './state/persistence'
import { copySharedConditions, shareConditionsAcrossShots } from './state/sharedConditions'
import { downloadShotFile, parseShotFile } from './state/shotFiles'
import { createShot, defaultShots, reorderShot } from './state/shots'
import type { ImperialRangeUnit, UnitSystem } from './units/conversions'
import { validateShot } from './validation/shotSchema'

const DEFAULT_BOUNDS: GraphBounds = { minX: 0, maxX: 100, autoY: true, minY: -20, maxY: 10 }
const GRAPH_ORDER: GraphView[] = ['pathInches', 'windageInches', 'velocityFps', 'energyFtLb', 'bullseye']
const DEFAULT_GRAPH_HEIGHTS: Record<GraphView, number> = {
  pathInches: 520,
  windageInches: 320,
  velocityFps: 360,
  energyFtLb: 360,
  bullseye: 540,
}
const GRAPH_INFO: Record<GraphView, { title: string; detail: string }> = {
  pathInches: { title: 'Vertical path', detail: 'Side view · line of sight' },
  windageInches: { title: 'Horizontal path', detail: 'Top view · wind and spin drift' },
  velocityFps: { title: 'Velocity', detail: 'Remaining projectile speed' },
  energyFtLb: { title: 'Kinetic energy', detail: 'Requires bullet weight' },
  bullseye: { title: 'Bullseye impact', detail: 'Range-driven point of impact' },
}

function isGraphMetric(view: GraphView): view is GraphMetric {
  return view !== 'bullseye'
}

function App() {
  const [shots, setShots] = useState<Shot[]>(() => loadShots() ?? defaultShots)
  const [shotInputMode, setShotInputMode] = useState<ShotInputMode>(() => loadShotInputMode())
  const [expandedId, setExpandedId] = useState<string | null>(() => shots[0]?.id ?? null)
  const [viewOrder, setViewOrder] = useState<GraphView[]>(GRAPH_ORDER)
  const [visibleViews, setVisibleViews] = useState<GraphView[]>(['pathInches', 'windageInches', 'bullseye'])
  const [inspectionMetric, setInspectionMetric] = useState<GraphMetric>('pathInches')
  const [graphHeights, setGraphHeights] = useState<Record<GraphView, number>>(DEFAULT_GRAPH_HEIGHTS)
  const [units, setUnits] = useState<UnitSystem>(() => loadUnitSystem())
  const [rangeUnit, setRangeUnit] = useState<ImperialRangeUnit>(() => loadRangeUnit())
  const [calculationQuality, setCalculationQuality] = useState<CalculationQuality>(() => loadCalculationQuality())
  const [bounds, setBounds] = useState<GraphBounds>(DEFAULT_BOUNDS)
  const [configuredRange, setConfiguredRange] = useState({ minX: DEFAULT_BOUNDS.minX, maxX: DEFAULT_BOUNDS.maxX })
  const [inspectionRange, setInspectionRange] = useState(50)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [zoomLocked, setZoomLocked] = useState(false)
  const [exportResultsOpen, setExportResultsOpen] = useState(false)
  const [shotFileStatus, setShotFileStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => saveShots(shots), 180)
    return () => window.clearTimeout(handle)
  }, [shots])

  useEffect(() => saveUnitSystem(units), [units])
  useEffect(() => saveRangeUnit(rangeUnit), [rangeUnit])
  useEffect(() => saveCalculationQuality(calculationQuality), [calculationQuality])
  useEffect(() => saveShotInputMode(shotInputMode), [shotInputMode])

  const validations = useMemo(() => new Map(shots.map((shot) => [shot.id, validateShot(shot)])), [shots])
  const errors = useMemo(
    () => new Map([...validations].map(([id, result]) => [id, result.errors])),
    [validations],
  )

  const trajectories = useMemo<ShotTrajectory[]>(() => {
    return shots.filter((shot) => shot.visible).map((shot) => {
      const validation = validations.get(shot.id)
      if (!validation?.valid) return { shotId: shot.id, points: [], error: 'Fix invalid inputs' }

      try {
        const calculationRange = calculationRangeForView(configuredRange.maxX, shot.scope.zeroDistanceYards)
        const points = calculateTrajectory(shot, calculationRange, calculationQuality)
        if (shot.projectile.weightGrains === undefined) {
          return { shotId: shot.id, points: points.map((point) => ({ ...point, energyFtLb: undefined })) }
        }
        return { shotId: shot.id, points }
      } catch (error) {
        return {
          shotId: shot.id,
          points: [],
          error: error instanceof Error ? error.message.replace(/^Error:\s*/, '') : 'Calculation failed',
        }
      }
    })
  }, [calculationQuality, configuredRange.maxX, shots, validations])

  const updateShot = (updated: Shot) => {
    setShots((current) => current.map((shot) => {
      if (shot.id === updated.id) return updated
      return shotInputMode === 'sharedConditions' ? copySharedConditions(updated, shot) : shot
    }))
  }

  const changeShotInputMode = (mode: ShotInputMode) => {
    if (mode === 'sharedConditions') {
      setShots((current) => {
        const sourceId = current.some((shot) => shot.id === expandedId) ? expandedId : current[0]?.id
        return sourceId ? shareConditionsAcrossShots(current, sourceId) : current
      })
    }
    setShotInputMode(mode)
  }

  const addShot = () => {
    const created = createShot(shots.length)
    setShots((current) => {
      const source = current.find((shot) => shot.id === expandedId) ?? current[0]
      const next = shotInputMode === 'sharedConditions' && source
        ? copySharedConditions(source, created)
        : created
      return [...current, next]
    })
    setExpandedId(created.id)
  }

  const duplicateShot = (source: Shot) => {
    const created = createShot(shots.length, source)
    const next = shotInputMode === 'sharedConditions' ? copySharedConditions(source, created) : created
    setShots((current) => [...current, next])
    setExpandedId(next.id)
  }

  const deleteShot = (id: string) => {
    setShots((current) => current.filter((shot) => shot.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const importShots = async (file: File) => {
    try {
      const imported = parseShotFile(await file.text()).map((shot) => ({
        ...shot,
        id: crypto.randomUUID(),
      }))
      setShots((current) => {
        if (shotInputMode !== 'sharedConditions') return [...current, ...imported]
        const source = current.find((shot) => shot.id === expandedId) ?? current[0] ?? imported[0]
        const additions = source
          ? imported.map((shot) => shot.id === source.id ? shot : copySharedConditions(source, shot))
          : imported
        return [...current, ...additions]
      })
      setExpandedId(imported[0]?.id ?? null)
      setShotFileStatus({ type: 'success', message: `Added ${imported.length} ${imported.length === 1 ? 'trajectory' : 'trajectories'} from ${file.name}.` })
    } catch (error) {
      setShotFileStatus({ type: 'error', message: error instanceof Error ? error.message : 'Could not import this file.' })
    }
  }

  const exportShots = () => {
    downloadShotFile(shots)
    setShotFileStatus({ type: 'success', message: `Exported ${shots.length} ${shots.length === 1 ? 'trajectory' : 'trajectories'}.` })
  }

  const handleRangeChange = (next: { minX: number; maxX: number }) => {
    const minX = Math.max(0, Number.isFinite(next.minX) ? next.minX : 0)
    const maxX = Math.max(minX + 0.1, Number.isFinite(next.maxX) ? next.maxX : minX + 100)
    setBounds((current) => ({ ...current, minX, maxX }))
    setConfiguredRange({ minX, maxX })
    setInspectionRange((current) => Math.min(maxX, Math.max(minX, current)))
  }

  const handleViewChange = useCallback((min: number, max: number) => {
    const configuredWidth = configuredRange.maxX - configuredRange.minX
    const width = Math.min(configuredWidth, Math.max(0.1, max - min))
    const nextMin = Math.min(
      configuredRange.maxX - width,
      Math.max(configuredRange.minX, min),
    )
    const nextMax = nextMin + width
    setBounds((current) => ({ ...current, minX: nextMin, maxX: nextMax }))
    setInspectionRange((current) => Math.min(nextMax, Math.max(nextMin, current)))
  }, [configuredRange])

  const handleInspectRange = useCallback((range: number) => setInspectionRange(range), [])
  const handleGraphInspectRange = useCallback((range: number, metric: GraphMetric) => {
    setInspectionRange(range)
    setInspectionMetric(metric)
  }, [])
  const visibleMetrics = visibleViews.filter(isGraphMetric)
  const energyRequested = visibleViews.includes('energyFtLb')
  const activeInspectionMetric = visibleMetrics.includes(inspectionMetric) ? inspectionMetric : (visibleMetrics[0] ?? 'pathInches')
  const missingEnergyWeights = energyRequested
    ? shots.filter((shot) => shot.visible && shot.projectile.weightGrains === undefined)
    : []

  const startGraphResize = (event: ReactPointerEvent<HTMLButtonElement>, view: GraphView) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = graphHeights[view]
    const minimumHeight = 140

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setGraphHeights((current) => ({
        ...current,
        [view]: Math.max(minimumHeight, startHeight + moveEvent.clientY - startY),
      }))
    }
    const stopResize = () => {
      document.body.classList.remove('is-resizing-graphs')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResize)
    }

    document.body.classList.add('is-resizing-graphs')
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResize)
  }

  const setGraphLayout = (layout: 'compact' | 'full') => {
    const fullHeight = Math.max(420, window.innerHeight - 150)
    setGraphHeights((current) => {
      const next = { ...current }
      for (const view of visibleViews) next[view] = layout === 'full' ? fullHeight : view === 'bullseye' ? 260 : 180
      return next
    })
  }

  const toggleGraphHeight = (view: GraphView) => {
    const fullHeight = Math.max(420, window.innerHeight - 150)
    const compactHeight = view === 'bullseye' ? 260 : 180
    setGraphHeights((current) => ({
      ...current,
      [view]: current[view] >= fullHeight * 0.72 ? compactHeight : fullHeight,
    }))
  }

  return (
    <div className={`app-shell ${sidebarOpen ? '' : 'app-shell--sidebar-closed'}`}>
      <main className="workspace">
        <section className="visualizer-panel">
          <div className="graph-card">
            <GraphControls
              views={visibleViews}
              viewOrder={viewOrder}
              range={configuredRange}
              units={units}
              rangeUnit={rangeUnit}
              sidebarOpen={sidebarOpen}
              zoomLocked={zoomLocked}
              calculationQuality={calculationQuality}
              onViewsChange={(views) => setVisibleViews(viewOrder.filter((view) => views.includes(view)))}
              onViewOrderChange={(views) => {
                setViewOrder(views)
                setVisibleViews((current) => views.filter((view) => current.includes(view)))
              }}
              onGraphLayoutChange={setGraphLayout}
              onRangeChange={handleRangeChange}
              onReset={() => {
                setBounds((current) => ({ ...current, ...configuredRange, autoY: true }))
                setInspectionRange((current) => Math.min(configuredRange.maxX, Math.max(configuredRange.minX, current)))
              }}
              onToggleSidebar={() => setSidebarOpen((open) => !open)}
              onToggleZoomLock={() => setZoomLocked((locked) => !locked)}
              onUnitsChange={setUnits}
              onRangeUnitChange={setRangeUnit}
              onCalculationQualityChange={setCalculationQuality}
              onExportResults={() => setExportResultsOpen(true)}
            />
            <div className="graph-stack">
              {visibleViews.map((view, index) => (
                <div className="graph-stack__item" key={view}>
                  {view === 'bullseye' ? (
                    <BullseyeView
                      height={graphHeights.bullseye}
                      range={inspectionRange}
                      bounds={bounds}
                      shots={shots}
                      trajectories={trajectories}
                      units={units}
                      rangeUnit={rangeUnit}
                      onRangeChange={handleInspectRange}
                    />
                  ) : (
                    <>
                      <div className={`chart-section-label ${index > 0 ? 'chart-section-label--bordered' : ''}`}>
                        <span>{GRAPH_INFO[view].title}</span>
                        <small>{GRAPH_INFO[view].detail}</small>
                      </div>
                      <div className="chart-frame" style={{ height: graphHeights[view] }}>
                        {view === 'energyFtLb' && missingEnergyWeights.length > 0 && (
                          <div className="chart-message" role="status">
                            Enter bullet weight for {missingEnergyWeights.map((shot) => shot.name || 'Untitled trajectory').join(', ')} to plot kinetic energy.
                          </div>
                        )}
                        <TrajectoryGraph
                          shots={shots}
                          trajectories={trajectories}
                          metric={view}
                          bounds={bounds}
                          units={units}
                          rangeUnit={rangeUnit}
                          inspectionRange={inspectionRange}
                          zoomLocked={zoomLocked}
                          onInspectRange={handleGraphInspectRange}
                          onViewChange={handleViewChange}
                        />
                        <div className="chart-hint">{zoomLocked ? 'Zoom locked · Scroll to move page' : 'Drag to zoom · Scroll to scale · Shift-scroll to pan'}</div>
                      </div>
                    </>
                  )}
                  <button
                    className="graph-resize-handle"
                    type="button"
                    aria-label={`Resize ${GRAPH_INFO[view].title}`}
                    title="Drag to resize · Double-click for full or compact height"
                    onPointerDown={(event) => startGraphResize(event, view)}
                    onDoubleClick={() => toggleGraphHeight(view)}
                  ><span /></button>
                </div>
              ))}
            </div>

            {visibleMetrics.length > 0 && (
              <TrajectoryTooltip range={inspectionRange} shots={shots} trajectories={trajectories} metric={activeInspectionMetric} units={units} rangeUnit={rangeUnit} />
            )}
          </div>
        </section>

        {sidebarOpen && <PanelDivider />}

        {sidebarOpen && (
          <ShotList
            shots={shots}
            errors={errors}
            units={units}
            energyRequested={energyRequested}
            expandedId={expandedId}
            inputMode={shotInputMode}
            onExpand={(id) => setExpandedId((current) => current === id ? null : id)}
            onChange={updateShot}
            onReorder={(sourceId, targetId, position) => setShots((current) => reorderShot(current, sourceId, targetId, position))}
            onInputModeChange={changeShotInputMode}
            onAdd={addShot}
            onDuplicate={duplicateShot}
            onDelete={deleteShot}
            fileStatus={shotFileStatus}
            onImport={importShots}
            onExport={exportShots}
          />
        )}
      </main>
      {exportResultsOpen && (
        <ExportResultsDialog
          shots={shots}
          trajectories={trajectories}
          range={configuredRange}
          calculationQuality={calculationQuality}
          units={units}
          rangeUnit={rangeUnit}
          onClose={() => setExportResultsOpen(false)}
        />
      )}
    </div>
  )
}

export default App
