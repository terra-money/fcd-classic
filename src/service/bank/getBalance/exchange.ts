import { div, isFinite } from 'lib/math'

export default (key: string, w: W): number => (isFinite(w[key]) && w.price ? +div(w[key], w.price) : NaN)
