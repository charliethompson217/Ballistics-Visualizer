import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fromDisplayUnit, toDisplayUnit, type Quantity, type UnitSystem } from '../../units/conversions'

interface NumberFieldProps {
  label: string
  unit?: string
  value: number | undefined
  error?: string
  message?: string
  step?: string
  min?: number
  max?: number
  optional?: boolean
  required?: boolean
  quantity?: Quantity
  units: UnitSystem
  endControl?: ReactNode
  labelAction?: ReactNode
  onChange: (value: number | undefined) => void
}

function valueToText(value: number | undefined, quantity: Quantity | undefined, units: UnitSystem) {
  if (value === undefined) return ''
  const displayValue = quantity === undefined ? value : toDisplayUnit(value, quantity, units)
  return String(displayValue)
}

export function NumberField({
  label,
  unit,
  value,
  error,
  message,
  min,
  max,
  optional,
  required,
  quantity,
  units,
  endControl,
  labelAction,
  onChange,
}: NumberFieldProps) {
  const displayValue = value === undefined || quantity === undefined ? value : toDisplayUnit(value, quantity, units)
  const [text, setText] = useState(() => valueToText(value, quantity, units))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(valueToText(value, quantity, units))
  }, [displayValue, quantity, units, value])

  const commit = (raw: string) => {
    if (raw.trim() === '') {
      onChange(undefined)
      return
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    onChange(quantity === undefined ? parsed : fromDisplayUnit(parsed, quantity, units))
  }

  return (
    <label className={`field ${error ? 'field--error' : ''}`}>
      <span className="field__label">
        <span>{label}</span>
        {labelAction ?? (required ? <em className="field__requirement">required</em> : optional ? <em>optional</em> : null)}
      </span>
      <span className={`field__control ${endControl ? 'field__control--split' : ''}`}>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          aria-invalid={Boolean(error)}
          data-min={min}
          data-max={max}
          onFocus={() => { focused.current = true }}
          onChange={(event) => {
            const next = event.target.value
            if (!/^[+-]?(?:\d+\.?\d*|\.\d*)?$/.test(next)) return
            setText(next)
            commit(next)
          }}
          onBlur={() => {
            focused.current = false
            if (text.trim() === '' || !Number.isFinite(Number(text))) {
              setText('')
              onChange(undefined)
            }
          }}
        />
        {endControl ?? (unit ? <span>{unit}</span> : null)}
      </span>
      {error && <span className="field__error">{error}</span>}
      {!error && message && <span className="field__message">{message}</span>}
    </label>
  )
}
