/**
 * Edge Gaze Detector — 시선이 화면 가장자리에 dwell 한 순간을 판정.
 *
 * 보고서 매핑:
 *   - §3.3 Mappings : "시선 위치 — 화면 상하좌우 가장자리 중 사용자가 쳐다보는 곳"
 *   - §4.1 Salvucci, Taatgen & Borst (2009) : 수백 ms 인터럽션은 절차적 자원에 흡수
 *   - §4.4 Jacob (1990) Midas Touch : dwell 없이 즉시 트리거하면 의도/우연 구분 불가
 *
 * 알고리즘 (3-state):
 *   idle
 *     └─ point 가 edge band(enterFrac) 안에 들어오면 dwelling 시작
 *   dwelling
 *     ├─ band 밖으로 나가면 idle 복귀
 *     └─ dwellMs 경과하면 entered + 'enter' 이벤트 발사
 *   entered
 *     └─ exitFrac 영역(더 안쪽까지) 밖으로 나가면 'exit' 이벤트 + idle
 *
 * Hysteresis:
 *   enterFrac (예: 0.08) 보다 exitFrac (예: 0.12) 가 더 안쪽으로 들어와 있음.
 *   → 진입 후 잠시 시선이 살짝 흔들려도 다시 idle 로 떨어지지 않음 (Cool 매체 원칙).
 */

export type Edge = 'left' | 'right' | 'top' | 'bottom'
export type EdgeState = 'idle' | 'dwelling' | 'entered'

export interface EdgeDetectorConfig {
  /** 진입 band 폭 (각 변에서) — 화면 폭(또는 높이)에 대한 비율 */
  enterFrac: number
  /** 이탈 band 폭 — 진입보다 살짝 안쪽까지 들어와야 하므로 더 크다 */
  exitFrac: number
  /** 진입 dwell 시간 ms */
  dwellMs: number
}

export const DEFAULT_EDGE_CONFIG: EdgeDetectorConfig = {
  enterFrac: 0.08,
  exitFrac: 0.12,
  dwellMs: 150
}

export type EdgeEvent =
  | { type: 'enter'; edge: Edge; t: number }
  | { type: 'exit'; edge: Edge; t: number }

export type EdgeSnapshot = {
  state: EdgeState
  /** dwelling 또는 entered 일 때 어느 변인지 */
  edge: Edge | null
  /** dwelling 중 0..1 진행률 (HUD 표시용) */
  dwellProgress: number
  /** entered 진입 이후 경과 ms */
  enteredAt: number | null
}

type Point = { x: number; y: number }
type Viewport = { w: number; h: number }

/** 좌표가 어느 edge band 에 속하는지 — 안 속하면 null. */
function classifyEdge(p: Point, vp: Viewport, frac: number): Edge | null {
  if (p.x < 0 || p.y < 0) return null
  const lx = vp.w * frac
  const rx = vp.w * (1 - frac)
  const ty = vp.h * frac
  const by = vp.h * (1 - frac)

  // 코너에 들어와 있으면 더 가까운 변을 선택 (수직 거리 vs 수평 거리)
  const dLeft = p.x
  const dRight = vp.w - p.x
  const dTop = p.y
  const dBottom = vp.h - p.y

  const onLeft = p.x < lx
  const onRight = p.x > rx
  const onTop = p.y < ty
  const onBottom = p.y > by

  if (!(onLeft || onRight || onTop || onBottom)) return null

  // 가장 가까운 변 선택 (코너에서의 모호함 해결)
  const candidates: Array<[Edge, number]> = []
  if (onLeft) candidates.push(['left', dLeft])
  if (onRight) candidates.push(['right', dRight])
  if (onTop) candidates.push(['top', dTop])
  if (onBottom) candidates.push(['bottom', dBottom])

  candidates.sort((a, b) => a[1] - b[1])
  return candidates[0][0]
}

export class EdgeDetector {
  private state: EdgeState = 'idle'
  private currentEdge: Edge | null = null
  private dwellStart: number | null = null
  private enteredAt: number | null = null

  constructor(public config: EdgeDetectorConfig = DEFAULT_EDGE_CONFIG) {}

  /** 매 프레임 (또는 시선 샘플마다) 호출. 이벤트가 발생하면 반환. */
  update(point: Point, viewport: Viewport, now: number): EdgeEvent | null {
    const enterEdge = classifyEdge(point, viewport, this.config.enterFrac)
    const exitEdge = classifyEdge(point, viewport, this.config.exitFrac)

    switch (this.state) {
      case 'idle': {
        if (enterEdge) {
          this.state = 'dwelling'
          this.currentEdge = enterEdge
          this.dwellStart = now
        }
        return null
      }

      case 'dwelling': {
        // band 밖으로 나갔거나, 다른 변으로 옮겨갔으면 reset
        if (!enterEdge || enterEdge !== this.currentEdge) {
          if (enterEdge && enterEdge !== this.currentEdge) {
            // 다른 변으로 즉시 옮겨감 — 새 dwell 시작
            this.currentEdge = enterEdge
            this.dwellStart = now
            return null
          }
          this.state = 'idle'
          this.currentEdge = null
          this.dwellStart = null
          return null
        }
        // dwell 시간 충족?
        if (this.dwellStart != null && now - this.dwellStart >= this.config.dwellMs) {
          const edge = this.currentEdge!
          this.state = 'entered'
          this.enteredAt = now
          this.dwellStart = null
          return { type: 'enter', edge, t: now }
        }
        return null
      }

      case 'entered': {
        // hysteresis: 진입보다 더 안쪽(exitFrac)까지 벗어나야 이탈로 인정
        if (!exitEdge || exitEdge !== this.currentEdge) {
          const edge = this.currentEdge!
          this.state = 'idle'
          this.currentEdge = null
          this.enteredAt = null
          return { type: 'exit', edge, t: now }
        }
        return null
      }
    }
  }

  /** HUD 표시용 현재 상태 스냅샷. 매번 새 객체. */
  snapshot(now: number): EdgeSnapshot {
    let progress = 0
    if (this.state === 'dwelling' && this.dwellStart != null) {
      progress = Math.min(1, (now - this.dwellStart) / this.config.dwellMs)
    } else if (this.state === 'entered') {
      progress = 1
    }
    return {
      state: this.state,
      edge: this.currentEdge,
      dwellProgress: progress,
      enteredAt: this.enteredAt
    }
  }

  reset(): void {
    this.state = 'idle'
    this.currentEdge = null
    this.dwellStart = null
    this.enteredAt = null
  }
}
