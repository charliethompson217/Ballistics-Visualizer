import { describe, expect, it } from 'vitest'
import { formatAxisTicks } from './formatting'

describe('axis tick formatting', () => {
  it('uses compact labels for broad ranges', () => {
    expect(formatAxisTicks([-100, 0, 100])).toEqual(['-100', '0', '100'])
  })

  it('adds enough decimal places to distinguish close ticks', () => {
    expect(formatAxisTicks([-0.14, -0.12, -0.1, -0.08])).toEqual([
      '-0.14',
      '-0.12',
      '-0.10',
      '-0.08',
    ])
  })

  it('supports very tight zoom levels without duplicate labels', () => {
    expect(formatAxisTicks([0, 0.0005, 0.001])).toEqual(['0.0000', '0.0005', '0.0010'])
  })

  it('does not add a spurious decimal from floating-point tick spacing', () => {
    expect(formatAxisTicks([0.1, 0.2, 0.3])).toEqual(['0.1', '0.2', '0.3'])
  })
})
