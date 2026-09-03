import type { GraphMetric, Shot, ShotTrajectory } from '../../ballistics/types'
import { interpolatePoint } from '../../ballistics/engine'
import { formatNumber, signed } from '../../units/formatting'
import { axisRangeLabel, toAxisRange, toDisplayUnit, unitLabel, type ImperialRangeUnit, type Quantity, type UnitSystem } from '../../units/conversions'

const METRIC_INFO: Record<GraphMetric, { label: string; quantity: Quantity; digits: number }> = {
  pathInches: { label: 'Vertical path', quantity: 'path', digits: 2 },
  velocityFps: { label: 'Velocity', quantity: 'velocity', digits: 0 },
  windageInches: { label: 'Horizontal path', quantity: 'path', digits: 2 },
  energyFtLb: { label: 'Kinetic energy', quantity: 'energy', digits: 0 },
}

interface TrajectoryTooltipProps {
  range: number
  shots: Shot[]
  trajectories: ShotTrajectory[]
  metric: GraphMetric
  units: UnitSystem
  rangeUnit: ImperialRangeUnit
}

export function TrajectoryTooltip({ range, shots, trajectories, metric, units, rangeUnit }: TrajectoryTooltipProps) {
  const info = METRIC_INFO[metric]
  const displayRange = toAxisRange(range, units, rangeUnit)
  const rangeLabel = axisRangeLabel(units, rangeUnit)

  return (
    <div className="comparison-panel">
      <div className="comparison-panel__range">
        <span>Inspection range · {info.label}</span>
        <strong>{formatNumber(displayRange, displayRange < 20 ? 1 : 0)} <small>{rangeLabel}</small></strong>
      </div>
      <div className="comparison-list">
        {shots.filter((shot) => shot.visible).map((shot) => {
          const trajectory = trajectories.find((item) => item.shotId === shot.id)
          const point = trajectory ? interpolatePoint(trajectory.points, range) : null
          const rawValue = point?.[metric]
          const value = typeof rawValue === 'number' ? toDisplayUnit(rawValue, info.quantity, units, false) : undefined
          const velocity = point ? toDisplayUnit(point.velocityFps, 'velocity', units, false) : undefined
          const vertical = point ? toDisplayUnit(point.pathInches, 'path', units, false) : undefined
          const horizontal = point ? toDisplayUnit(point.windageInches ?? 0, 'path', units, false) : undefined
          const secondaryValues = point ? [
            metric !== 'pathInches' ? `Vertical ${signed(vertical, 2)} ${unitLabel('path', units)}` : null,
            metric !== 'windageInches' ? `Horizontal ${signed(horizontal, 2)} ${unitLabel('path', units)}` : null,
            metric !== 'velocityFps' ? `Velocity ${formatNumber(velocity, 0)} ${unitLabel('velocity', units)}` : null,
          ].filter((item): item is string => item !== null) : []
          return (
            <div className="comparison-row" key={shot.id}>
              <span className="comparison-row__dot" style={{ background: shot.color }} />
              <span className="comparison-row__name">{shot.name}</span>
              <strong>{metric === 'pathInches' || metric === 'windageInches' ? signed(value, info.digits) : formatNumber(value, info.digits)} <small>{unitLabel(info.quantity, units)}</small></strong>
              <span className="comparison-row__secondary">{point ? secondaryValues.join(' · ') : trajectory?.error ?? 'No data'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
