import type { GlanceShiftAPI } from './index'

declare global {
  interface Window {
    glanceshift: GlanceShiftAPI
  }
}

export {}
