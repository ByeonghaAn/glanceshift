/**
 * GlanceShift App (Phase 1)
 *
 * 추가된 것:
 *   - WebGazer 시선 추적 자동 시작 (카메라 권한 요청 흐름 포함)
 *   - One Euro Filter로 시선 jitter 제거
 *   - 디버그 모드(⌘⇧D)에서 시선 도트 + HUD 표시
 *   - ⌘⇧C 로 9-point 캘리브레이션 진입 (자동으로 click-through 해제)
 *
 * 입력 소스 우선순위:
 *   WebGazer가 ready 면 시선 좌표 사용, 아니면 마우스 좌표(Phase 0 fallback).
 */

import { useEffect, useRef, useState } from 'react'
import { DebugHud } from './components/DebugHud'
import { GazeDot } from './components/GazeDot'
import { Calibration } from './components/Calibration'
import { createGazeTracker, type GazeSample, type TrackerStatus } from './perception/webgazer'

type Point = { x: number; y: number; t: number }

export function App(): JSX.Element {
  const [debugVisible, setDebugVisible] = useState(true)
  const [clickThrough, setClickThrough] = useState(true)
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })

  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>('unloaded')
  const [trackerError, setTrackerError] = useState<string | null>(null)
  const [gaze, setGaze] = useState<Point>({ x: -1, y: -1, t: 0 })
  const [mouse, setMouse] = useState<Point>({ x: -1, y: -1, t: 0 })
  /** WebGazer가 한 번이라도 (data ≠ null)인 예측을 내놨는지 — 즉 캘리브 후 작동 중 */
  const [hasGazeData, setHasGazeData] = useState(false)

  const [calibrating, setCalibrating] = useState(false)
  const trackerRef = useRef<ReturnType<typeof createGazeTracker> | null>(null)

  // 1) 시선 트래커 init — 카메라 권한 확인 후 begin
  useEffect(() => {
    let cancelled = false
    const tracker = createGazeTracker()
    trackerRef.current = tracker
    const offSample = tracker.onSample((s: GazeSample) => {
      if (cancelled) return
      setGaze({ x: s.fx, y: s.fy, t: s.t })
      setHasGazeData(true)
    })
    const offStatus = tracker.onStatus((s, err) => {
      if (cancelled) return
      setTrackerStatus(s)
      setTrackerError(err ?? null)
    })
    ;(async () => {
      try {
        const status = await window.glanceshift.getCameraPermission()
        if (status !== 'granted') {
          // macOS: 처음 요청 시 OS 권한 다이얼로그가 뜬다.
          await window.glanceshift.requestCameraPermission()
        }
        if (cancelled) return
        await tracker.start()
      } catch (e) {
        // 에러는 상태 콜백으로 이미 전파됨
      }
    })()
    return () => {
      cancelled = true
      offSample()
      offStatus()
      tracker.stop()
    }
  }, [])

  // 2) main process 단축키 동기화
  useEffect(() => {
    const offDebug = window.glanceshift.onToggleDebug(() => setDebugVisible((v) => !v))
    const offCt = window.glanceshift.onClickThroughChange((enabled) => setClickThrough(enabled))
    const offCalib = window.glanceshift.onToggleCalibration(() => setCalibrating((v) => !v))
    return () => {
      offDebug()
      offCt()
      offCalib()
    }
  }, [])

  // 3) viewport 갱신
  useEffect(() => {
    const onResize = (): void => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 4) Fallback 입력: 마우스 좌표 (트래커가 ready 가 아닐 때)
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      setMouse({ x: e.clientX, y: e.clientY, t: performance.now() })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // 5) 캘리브레이션 진입/종료 시 click-through 토글
  useEffect(() => {
    if (calibrating) {
      window.glanceshift.setClickThrough(false)
    } else {
      window.glanceshift.setClickThrough(true)
    }
  }, [calibrating])

  // 어떤 입력을 표시할지
  const usingGaze = trackerStatus === 'ready' && gaze.x >= 0
  const point = usingGaze ? gaze : mouse
  const inputSource = usingGaze
    ? 'WebGazer (filtered)'
    : trackerStatus === 'loading'
      ? 'mouse (gaze loading…)'
      : trackerStatus === 'error'
        ? `mouse (gaze error: ${trackerError ?? ''})`
        : trackerStatus === 'ready' && !hasGazeData
          ? 'mouse (needs calibration — ⌘⇧K)'
          : 'mouse (Phase 0 fallback)'

  return (
    <>
      <GazeDot x={point.x} y={point.y} visible={debugVisible} />

      {debugVisible && (
        <DebugHud
          point={point}
          viewport={viewport}
          clickThrough={clickThrough}
          inputSource={inputSource}
          trackerStatus={trackerStatus}
        />
      )}

      {calibrating && (
        <Calibration
          onPointClick={(x, y) => trackerRef.current?.recordPoint(x, y)}
          onDone={() => setCalibrating(false)}
        />
      )}
    </>
  )
}
