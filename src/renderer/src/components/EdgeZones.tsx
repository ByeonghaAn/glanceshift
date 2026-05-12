/**
 * EdgeZones — 디버그 모드에서 4개 가장자리 band 를 시각화한다.
 *
 * 평소엔 보이지 않다가 (cool 매체 원칙) ⌘⇧D 를 켜면 다음을 표시:
 *   - 가장자리 영역 (8% 폭)
 *   - 현재 dwelling 중인 변은 진행률에 비례해 강조
 *   - entered 상태에 들어간 변은 진한 색으로 강조
 *
 * 실제 사용자에게 보일 GazeBar UI 는 Phase 4 에서 구현.
 */

import type { EdgeSnapshot } from '../perception/edge-detector'

type Props = {
  /** 진입 band 폭 비율 (e.g., 0.08) */
  enterFrac: number
  /** 화면 viewport */
  viewport: { w: number; h: number }
  /** 현재 detector snapshot */
  snapshot: EdgeSnapshot
  visible: boolean
}

export function EdgeZones({ enterFrac, viewport, snapshot, visible }: Props): JSX.Element | null {
  if (!visible) return null

  const xBand = viewport.w * enterFrac
  const yBand = viewport.h * enterFrac

  /** edge 별 활성 상태 — 0=비활성, 0..1=dwelling 진행률, >1=entered */
  function activity(edge: 'left' | 'right' | 'top' | 'bottom'): number {
    if (snapshot.edge !== edge) return 0
    if (snapshot.state === 'entered') return 2
    return snapshot.dwellProgress
  }

  function zoneStyle(act: number): React.CSSProperties {
    if (act === 0) {
      return {
        background: 'rgba(90, 169, 255, 0.05)',
        borderColor: 'rgba(90, 169, 255, 0.18)'
      }
    }
    if (act >= 2) {
      return {
        background: 'rgba(90, 169, 255, 0.22)',
        borderColor: 'rgba(90, 169, 255, 0.9)'
      }
    }
    // dwelling — 진행률에 따라 보간
    const alpha = 0.05 + act * 0.15
    const bAlpha = 0.18 + act * 0.5
    return {
      background: `rgba(90, 169, 255, ${alpha})`,
      borderColor: `rgba(90, 169, 255, ${bAlpha})`
    }
  }

  return (
    <>
      <div
        className="edge-zone-debug"
        style={{
          ...zoneStyle(activity('left')),
          left: 0,
          top: 0,
          width: xBand,
          height: viewport.h
        }}
      />
      <div
        className="edge-zone-debug"
        style={{
          ...zoneStyle(activity('right')),
          right: 0,
          top: 0,
          width: xBand,
          height: viewport.h
        }}
      />
      <div
        className="edge-zone-debug"
        style={{
          ...zoneStyle(activity('top')),
          left: 0,
          top: 0,
          width: viewport.w,
          height: yBand
        }}
      />
      <div
        className="edge-zone-debug"
        style={{
          ...zoneStyle(activity('bottom')),
          left: 0,
          bottom: 0,
          width: viewport.w,
          height: yBand
        }}
      />
    </>
  )
}
