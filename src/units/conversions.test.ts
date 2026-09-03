import { describe, expect, it } from 'vitest'
import {
  fromDisplayUnit,
  fromAxisRange,
  toAxisRange,
  toDisplayUnit,
  unitLabel,
  type Quantity,
} from './conversions'

describe('display unit conversions', () => {
  it.each([
    ['range', 100, 91.44],
    ['path', 10, 25.4],
    ['length', 1, 25.4],
    ['velocity', 1000, 304.8],
    ['velocityTemperatureSensitivity', 1, 0.54864],
    ['windSpeed', 10, 4.4704],
    ['temperature', 59, 15],
    ['pressure', 29.92, 1013.207],
    ['altitude', 1000, 304.8],
    ['weight', 168, 10.886],
    ['energy', 1000, 1355.818],
  ] satisfies Array<[Quantity, number, number]>)('converts %s to metric', (quantity, input, expected) => {
    expect(toDisplayUnit(input, quantity, 'metric', false)).toBeCloseTo(expected, 3)
  })

  it.each([
    ['range', 537.25],
    ['path', -18.7],
    ['length', 0.308],
    ['velocity', 2700],
    ['velocityTemperatureSensitivity', 1.2],
    ['windSpeed', 12.5],
    ['temperature', -4],
    ['pressure', 28.63],
    ['altitude', 5280],
    ['weight', 168],
    ['energy', 2430],
  ] satisfies Array<[Quantity, number]>)('round-trips %s without mutating the domain value', (quantity, input) => {
    const metric = toDisplayUnit(input, quantity, 'metric', false)
    expect(fromDisplayUnit(metric, quantity, 'metric')).toBeCloseTo(input, 10)
  })

  it('keeps imperial values unchanged', () => {
    expect(toDisplayUnit(123.456, 'range', 'imperial')).toBe(123.456)
    expect(fromDisplayUnit(123.456, 'range', 'imperial')).toBe(123.456)
  })

  it('provides matching interface labels', () => {
    expect(unitLabel('velocity', 'imperial')).toBe('fps')
    expect(unitLabel('velocity', 'metric')).toBe('m/s')
    expect(unitLabel('pressure', 'metric')).toBe('hPa')
  })

  it('converts the graph range independently between yards and feet', () => {
    expect(toAxisRange(100, 'imperial', 'yards')).toBe(100)
    expect(toAxisRange(100, 'imperial', 'feet')).toBe(300)
    expect(fromAxisRange(300, 'imperial', 'feet')).toBe(100)
  })

  it('uses meters for the graph range in metric mode regardless of the saved imperial preference', () => {
    expect(toAxisRange(100, 'metric', 'feet')).toBe(91.44)
    expect(toAxisRange(100, 'metric', 'yards')).toBe(91.44)
  })
})
