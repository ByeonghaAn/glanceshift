/**
 * Calibration — 9-point 캘리브레이션 화면.
 *
 * 흐름:
 *   1. 사용자가 화면의 점을 응시하면서 5번 클릭
 *   2. WebGazer.recordScreenPosition(x, y, 'click') 으로 트레이닝 데이터 추가
 *   3. 9개 점 (3x3 그리드) 모두 완료되면 콜백
 *
 * UX 노트:
 *   - 캘리브레이션 동안에는 click-through 가 꺼져야 마우스를 받을 수 있음
 *   - 5번 클릭은 WebGazer 공식 권장 (점당 정확도 향상)
 *
 * 보고서 §5.2 — WebGazer ~4° 정확도는 보정에 비례.
 */

import { useEffect, useMemo, useState } from 'react'

const CLICKS_PER_POINT = 5

type Props = {
  /** 캘리브레이션 점 클릭이 발생했을 때 호출 — WebGazer에 전달용 */
  onPointClick: (x: number, y: number) => void
  /** 완료/취소 콜백 */
  onDone: (completed: boolean) => void
  /** 기존 캘리브레이션 데이터 초기화 (WebGazer.clearData) */
  onClearCalibration?: () => Promise<void>
}

type Point = { id: string; x: number; y: number }

function makeGridPoints(width: number, height: number, margin = 0.1): Point[] {
  const cols = [margin, 0.5, 1 - margin]
  const rows = [margin, 0.5, 1 - margin]
  const out: Point[] = []
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      out.push({ id: `${r}-${c}`, x: cols[c] * width, y: rows[r] * height })
    }
  }
  return out
}

export function Calibration({ onPointClick, onDone, onClearCalibration }: Props): JSX.Element {
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [clearing, setClearing] = useState(false)

  const handleClear = async (): Promise<void> => {
    if (!onClearCalibration) return
    setClearing(true)
    try {
      await onClearCalibration()
      setCounts({})
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    const onResize = (): void => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ESC로 취소
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onDone(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  const points = useMemo(() => makeGridPoints(viewport.w, viewport.h), [viewport])
  const totalClicks = points.length * CLICKS_PER_POINT
  const doneClicks = Object.values(counts).reduce((a, b) => a + Math.min(b, CLICKS_PER_POINT), 0)
  const progress = doneClicks / totalClicks

  const handleClick = (p: Point): void => {
    const c = (counts[p.id] ?? 0) + 1
    setCounts({ ...counts, [p.id]: c })
    onPointClick(p.x, p.y)
    // 모두 5번씩 채웠으면 완료
    const next = { ...counts, [p.id]: c }
    const finished = points.every((q) => (next[q.id] ?? 0) >= CLICKS_PER_POINT)
    if (finished) {
      // 다음 프레임에 완료 (마지막 클릭 이벤트가 WebGazer에 전달될 시간)
      setTimeout(() => onDone(true), 50)
    }
  }

  return (
    <div className="calib-root">
      <div className="calib-header">
        <h3>시선 캘리브레이션</h3>
        <p>각 점을 정확히 응시하면서 <strong>5번 클릭</strong>해 주세요. ESC로 취소.</p>
        <div className="calib-progress">
          <div className="calib-progress-bar" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="calib-progress-text">{doneClicks} / {totalClicks}</div>
        {onClearCalibration && (
          <button
            type="button"
            className="calib-reset"
            onClick={handleClear}
            disabled={clearing}
            title="이전 세션의 학습 데이터를 모두 지우고 새로 시작합니다"
          >
            {clearing ? '지우는 중…' : '기존 데이터 지우기'}
          </button>
        )}
      </div>
      {points.map((p) => {
        const c = counts[p.id] ?? 0
        const filled = c >= CLICKS_PER_POINT
        return (
          <button
            key={p.id}
            className={`calib-dot${filled ? ' filled' : ''}`}
            style={{ left: p.x, top: p.y }}
            onClick={() => handleClick(p)}
            aria-label={`calibration point ${p.id}`}
          >
            <span className="calib-dot-count">{Math.min(c, CLICKS_PER_POINT)}</span>
          </button>
        )
      })}
    </div>
  )
}
