export function formatNumber(value: number | undefined, digits = 1, fallback = '—') {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function signed(value: number | undefined, digits = 1) {
  if (value === undefined || !Number.isFinite(value)) return '—'
  const formatted = Math.abs(value).toFixed(digits)
  if (Math.abs(value) < 10 ** -digits) return Number(0).toFixed(digits)
  return `${value > 0 ? '+' : '−'}${formatted}`
}

export function formatAxisTicks(values: number[]) {
  const finiteValues = values.filter(Number.isFinite)
  const uniqueValues = [...new Set(finiteValues)].sort((a, b) => a - b)
  const gaps = uniqueValues.slice(1)
    .map((value, index) => value - uniqueValues[index])
    .filter((gap) => gap > 0)
  const minimumGap = gaps.length > 0 ? Math.min(...gaps) : undefined
  let digits = minimumGap === undefined
    ? Math.max(...finiteValues.map(Math.abs), 0) >= 100 ? 0 : 1
    : Math.max(0, Math.ceil(-Math.log10(minimumGap) - 1e-10))

  const format = (value: number) => Number(value.toFixed(digits)).toFixed(digits)
  while (
    digits < 8 &&
    new Set(uniqueValues.map(format)).size < uniqueValues.length
  ) {
    digits += 1
  }

  return values.map((value) => Number.isFinite(value) ? format(value) : '')
}
