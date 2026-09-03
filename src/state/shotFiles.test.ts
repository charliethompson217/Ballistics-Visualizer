import { describe, expect, it } from 'vitest'
import { defaultShots } from './shots'
import { parseShotFile, serializeShotFile } from './shotFiles'

describe('trajectory JSON files', () => {
  it('round-trips the current shot model', () => {
    expect(parseShotFile(serializeShotFile(defaultShots))).toEqual(defaultShots)
  })

  it('rejects malformed JSON with a useful message', () => {
    expect(() => parseShotFile('{ nope')).toThrow('not a valid JSON')
  })

  it('rejects files that do not use the supported format', () => {
    expect(() => parseShotFile(JSON.stringify({ shots: defaultShots }))).toThrow('format')
  })

  it('adds safe defaults when importing files from before advanced conditions existed', () => {
    const legacy = JSON.parse(serializeShotFile(defaultShots)) as {
      shots: Array<{
        scope: Record<string, unknown>
        environment: Record<string, unknown>
        windAndAngle: Record<string, unknown>
      }>
    }
    const shot = legacy.shots[0]
    delete shot.scope.zeroConditions
    delete shot.environment.mode
    delete shot.environment.pressureType
    delete shot.environment.powderTemperature
    delete shot.windAndAngle.windReference
    delete shot.windAndAngle.verticalWindDirection
    delete shot.windAndAngle.coriolisEnabled
    delete shot.windAndAngle.cantDirection

    const [migrated] = parseShotFile(JSON.stringify(legacy))
    expect(migrated.scope.zeroConditions.mode).toBe('current')
    expect(migrated.environment.mode).toBe('weather')
    expect(migrated.environment.powderTemperature.mode).toBe('none')
    expect(migrated.windAndAngle.windReference).toBe('relative')
    expect(migrated.windAndAngle.coriolisEnabled).toBe(false)
  })
})
