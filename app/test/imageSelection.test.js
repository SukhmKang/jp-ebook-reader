import test from 'node:test'
import assert from 'node:assert/strict'

import { selectionRect, sourceCropRect } from '../src/utils/imageSelection.js'

const imageRect = { offsetX: 100, offsetY: 50, width: 600, height: 800 }

test('selection is normalized and clipped to the displayed page', () => {
  assert.deepEqual(selectionRect({ x: 650, y: 700 }, { x: 50, y: 20 }, imageRect), {
    x: 100,
    y: 50,
    width: 550,
    height: 650,
  })
})

test('tiny drags are ignored', () => {
  assert.equal(selectionRect({ x: 200, y: 200 }, { x: 205, y: 210 }, imageRect), null)
})

test('display coordinates map to the rendered PDF image', () => {
  assert.deepEqual(
    sourceCropRect({ x: 250, y: 250, width: 300, height: 400 }, imageRect, 1200, 1600),
    { x: 300, y: 400, width: 600, height: 800 },
  )
})
