import { z } from 'zod'
import type { Shot } from '../ballistics/types'
import { editableShotSchema } from '../validation/shotSchema'

const FILE_FORMAT = 'ballistics-visualizer'
const FILE_VERSION = 1

const shotFileSchema = z.object({
  format: z.literal(FILE_FORMAT),
  version: z.literal(FILE_VERSION),
  shots: z.array(editableShotSchema).min(1, 'The file must contain at least one trajectory'),
}).superRefine(({ shots }, context) => {
  const ids = new Set<string>()
  shots.forEach((shot, index) => {
    if (ids.has(shot.id)) {
      context.addIssue({ code: 'custom', path: ['shots', index, 'id'], message: 'Trajectory IDs must be unique' })
    }
    ids.add(shot.id)
  })
})

export function serializeShotFile(shots: Shot[]): string {
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, shots }, null, 2)
}

export function parseShotFile(contents: string): Shot[] {
  let data: unknown
  try {
    data = JSON.parse(contents)
  } catch {
    throw new Error('This is not a valid JSON file.')
  }

  const result = shotFileSchema.safeParse(data)
  if (result.success) return result.data.shots

  const issue = result.error.issues[0]
  const location = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : ''
  throw new Error(`${issue.message}${location}.`)
}

export function downloadShotFile(shots: Shot[]) {
  const blob = new Blob([serializeShotFile(shots)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ballistics-trajectories-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}
