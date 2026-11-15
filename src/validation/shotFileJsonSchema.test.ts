import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import schema from '../../public/shot-file.schema.json'
import { parseShotFile } from '../state/shotFiles'
import { editableShotSchema, validateShot } from './shotSchema'

describe('standalone trajectory generation schema', () => {
  it('provides examples that import as valid calculation inputs', () => {
    for (const example of schema.examples) {
      const shots = parseShotFile(JSON.stringify(example))
      expect(shots.length).toBeGreaterThan(0)
      for (const shot of shots) expect(validateShot(shot)).toEqual({ valid: true, errors: {} })
    }
  })

  it('documents every field and enum in the editable model', () => {
    type Schema = {
      $ref?: string
      properties?: Record<string, Schema>
      items?: Schema
      enum?: string[]
      description?: string
    }
    const model = z.toJSONSchema(editableShotSchema, { io: 'input' }) as Schema
    const definitions = schema.definitions as Record<string, Schema>

    const walk = (actual: Schema, documented: Schema, path: string) => {
      if (documented.$ref) documented = definitions[documented.$ref.split('/').pop()!]
      expect(documented.description, path).toBeTruthy()
      if (actual.enum) expect(documented.enum, path).toEqual(actual.enum)
      if (actual.properties) {
        expect(Object.keys(documented.properties!).sort(), path).toEqual(Object.keys(actual.properties).sort())
        for (const [key, property] of Object.entries(actual.properties)) {
          walk(property, documented.properties![key], `${path}.${key}`)
        }
      }
      if (actual.items) walk(actual.items, documented.items!, `${path}[]`)
    }

    walk(model, definitions.shot, 'shots[]')
  })
})
