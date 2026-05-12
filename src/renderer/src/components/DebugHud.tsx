/**
 * DebugHud — 시선/머리 입력의 실시간 상태를 좌상단에 보여주는 디버그 패널.
 *
 * 보고서 §3.2 Feel(Cool 매체) 원칙에 따라, 평소엔 숨겨두고
 * Cmd/Ctrl+Shift+D 단축키로만 띄운다.
 */

type Props = {
  point: { x: number; y: number; t: number }
  viewport: { w: number; h: number }
  clickThrough: boolean
  inputSource: string
  trackerStatus?: string
}

export function DebugHud({ point, viewport, clickThrough, inputSource, trackerStatus }: Props): JSX.Element {
  // 영역 분류 미리보기 (Phase 3 edge-detector 의 placeholder)
  const edgeFrac = 0.08
  const xFrac = point.x / viewport.w
  const yFrac = point.y / viewport.h
  let zone = 'CENTER'
  if (point.x >= 0 && point.y >= 0) {
    if (xFrac < edgeFrac) zone = 'LEFT'
    else if (xFrac > 1 - edgeFrac) zone = 'RIGHT'
    else if (yFrac < edgeFrac) zone = 'TOP'
    else if (yFrac > 1 - edgeFrac) zone = 'BOTTOM'
  }

  return (
    <div className="debug-hud">
      <h4>GlanceShift · debug</h4>
      <div className="row">
        <span className="label">input</span>
        <span className="value">{inputSource}</span>
      </div>
      <div className="row">
        <span className="label">viewport</span>
        <span className="value">{viewport.w} × {viewport.h}</span>
      </div>
      <div className="row">
        <span className="label">point</span>
        <span className="value">
          {point.x < 0 ? '—' : `${point.x.toFixed(0)}, ${point.y.toFixed(0)}`}
        </span>
      </div>
      <div className="row">
        <span className="label">zone</span>
        <span className="value" style={{ color: zone === 'CENTER' ? undefined : '#5aa9ff' }}>
          {zone}
        </span>
      </div>
      <div className="row">
        <span className="label">click-through</span>
        <span className="value">{clickThrough ? 'on' : 'off'}</span>
      </div>
      {trackerStatus && (
        <div className="row">
          <span className="label">tracker</span>
          <span
            className="value"
            style={{
              color:
                trackerStatus === 'ready'
                  ? '#7be38a'
                  : trackerStatus === 'error'
                    ? '#ff7777'
                    : 'rgba(255,255,255,0.5)'
            }}
          >
            {trackerStatus}
          </span>
        </div>
      )}
      <div className="row">
        <span className="label">FSM state</span>
        <span className="value" style={{ color: 'rgba(255,255,255,0.4)' }}>idle (Phase 6)</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
        ⌘⇧D HUD · ⌘⇧M click-through · ⌘⇧K calibrate · ⌘⇧Q quit
      </div>
    </div>
  )
}
