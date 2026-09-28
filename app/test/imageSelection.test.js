import test from 'node:test'
import assert from 'node:assert/strict'

import { compressSpreadCrop, imageBounds, pageCropLayers, selectionRect, sourceCropRect } from '../src/utils/imageSelection.js'

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

test('a drag across a spread crops both pages into their original positions', () => {
  const pages = [
    { image: { naturalWidth: 1200, naturalHeight: 1600 }, rect: { offsetX: 0, offsetY: 0, width: 600, height: 800 } },
    { image: { naturalWidth: 1200, naturalHeight: 1600 }, rect: { offsetX: 600, offsetY: 0, width: 600, height: 800 } },
  ]
  const selection = selectionRect({ x: 750, y: 100 }, { x: 450, y: 300 }, imageBounds(pages))
  assert.deepEqual(selection, { x: 450, y: 100, width: 300, height: 200 })
  assert.deepEqual(pageCropLayers(selection, pages).map(({ source, destination }) => ({ source, destination })), [
    { source: { x: 900, y: 200, width: 300, height: 400 }, destination: { x: 0, y: 0, width: 150, height: 200 } },
    { source: { x: 0, y: 200, width: 300, height: 400 }, destination: { x: 150, y: 0, width: 150, height: 200 } },
  ])
})

test('a selection within one page excludes the facing page', () => {
  const pages = [
    { image: { naturalWidth: 1200, naturalHeight: 1600 }, rect: { offsetX: 0, offsetY: 0, width: 600, height: 800 } },
    { image: { naturalWidth: 1200, naturalHeight: 1600 }, rect: { offsetX: 600, offsetY: 0, width: 600, height: 800 } },
  ]
  const selection = selectionRect({ x: 100, y: 100 }, { x: 300, y: 300 }, imageBounds(pages))
  assert.equal(pageCropLayers(selection, pages).length, 1)
})

test('the AI image contains both selected page regions', () => {
  const draws = []
  const canvas = {
    getContext: () => ({ fillRect() {}, drawImage: (...args) => draws.push(args) }),
    toDataURL: () => 'data:image/jpeg;base64,composite',
  }
  const originalDocument = globalThis.document
  globalThis.document = { createElement: () => canvas }
  try {
    const left = { naturalWidth: 1200, naturalHeight: 1600 }
    const right = { naturalWidth: 1200, naturalHeight: 1600 }
    const pages = [
      { image: left, rect: { offsetX: 0, offsetY: 0, width: 600, height: 800 } },
      { image: right, rect: { offsetX: 600, offsetY: 0, width: 600, height: 800 } },
    ]
    const selection = { x: 450, y: 100, width: 300, height: 200 }
    assert.equal(compressSpreadCrop(selection, pages), 'data:image/jpeg;base64,composite')
    assert.equal(canvas.width, 600)
    assert.equal(canvas.height, 400)
    assert.deepEqual(draws, [
      [left, 900, 200, 300, 400, 0, 0, 300, 400],
      [right, 0, 200, 300, 400, 300, 0, 300, 400],
    ])
  } finally {
    globalThis.document = originalDocument
  }
})
