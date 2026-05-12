/**
 * GazeDot — 디버그용 시선 도트.
 * 보고서 §3.2 Feel(cool 매체)에 따라 평소엔 보이지 않게,
 * 디버그 HUD가 켜져 있을 때만 표시한다.
 */

type Props = { x: number; y: number; visible: boolean }

export function GazeDot({ x, y, visible }: Props): JSX.Element | null {
  if (!visible || x < 0 || y < 0) return null
  return <div className="gaze-dot" style={{ left: x, top: y }} />
}
