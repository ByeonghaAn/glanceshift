/**
 * predev / prebuild / postinstall:
 *   node_modules/webgazer/dist/ 의 다음 자산을 src/renderer/public/ 으로 복사한다.
 *     - webgazer.js                       (메인 번들)
 *     - mediapipe/face_mesh/...            (MediaPipe Face Mesh 솔루션 파일들)
 *
 * 왜 필요한가:
 *   WebGazer 3.5.x 는 face-landmarks-detection v1 의 mediapipe runtime을 쓴다.
 *   이 모델은 `solutionPath: './mediapipe/face_mesh'` 에서 다음을 fetch 한다:
 *     · face_mesh_solution_simd_wasm_bin.js  (loader)
 *     · face_mesh_solution_simd_wasm_bin.wasm
 *     · face_mesh.binarypb
 *     · face_mesh_solution_packed_assets.data
 *   이 파일이 없으면 fetch가 404를 반환하고, 로더가 HTML을 JS로 평가하려다
 *   "t is not a function" 같은 minified TypeError 로 터진다.
 */

import { existsSync, mkdirSync, copyFileSync, statSync, readdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const srcRoot = resolve(root, 'node_modules/webgazer/dist')
const destRoot = resolve(root, 'src/renderer/public')

if (!existsSync(srcRoot)) {
  console.error(`[copy-webgazer] not found: ${srcRoot}`)
  console.error(`  run \`npm install\` first to fetch the webgazer package.`)
  process.exit(1)
}

/** 단일 파일 복사 — size/mtime 동일하면 skip. */
function copyIfChanged(src, dest) {
  mkdirSync(dirname(dest), { recursive: true })
  const needs =
    !existsSync(dest) ||
    statSync(src).size !== statSync(dest).size ||
    statSync(src).mtimeMs > statSync(dest).mtimeMs
  if (needs) {
    copyFileSync(src, dest)
    return true
  }
  return false
}

/** 디렉토리 재귀 복사. */
function copyDir(srcDir, destDir) {
  let copied = 0
  if (!existsSync(srcDir)) return 0
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const s = join(srcDir, entry.name)
    const d = join(destDir, entry.name)
    if (entry.isDirectory()) {
      copied += copyDir(s, d)
    } else if (entry.isFile()) {
      if (copyIfChanged(s, d)) copied++
    }
  }
  return copied
}

const webgazerSrc = resolve(srcRoot, 'webgazer.js')
const webgazerDest = resolve(destRoot, 'webgazer.js')
const wgChanged = copyIfChanged(webgazerSrc, webgazerDest)

const mpSrc = resolve(srcRoot, 'mediapipe/face_mesh')
const mpDest = resolve(destRoot, 'mediapipe/face_mesh')
const mpChangedCount = copyDir(mpSrc, mpDest)

if (wgChanged) console.log(`[copy-webgazer] ${webgazerSrc} → ${webgazerDest}`)
console.log(
  mpChangedCount > 0
    ? `[copy-webgazer] mediapipe/face_mesh: ${mpChangedCount} file(s) copied → ${mpDest}`
    : `[copy-webgazer] mediapipe/face_mesh: up to date`
)
