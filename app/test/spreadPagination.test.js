import test from 'node:test'
import assert from 'node:assert/strict'

import {
  nextPageIndex,
  normalizeSpreadStart,
  previousPageIndex,
  spreadState,
} from '../src/utils/spreadPagination.js'

test('landscape keeps the cover by itself and pairs PDF pages 2-3', () => {
  assert.deepEqual(spreadState(0, 259, true), {
    singlePage: true,
    lastVisiblePage: 0,
    canGoForward: true,
  })
  assert.equal(nextPageIndex(0, 259, true), 1)
  assert.deepEqual(spreadState(1, 259, true), {
    singlePage: false,
    lastVisiblePage: 2,
    canGoForward: true,
  })
})

test('landscape navigation preserves right-left spread pairs', () => {
  assert.equal(nextPageIndex(1, 259, true), 3)
  assert.equal(nextPageIndex(9, 259, true), 11)
  assert.equal(previousPageIndex(11, true), 9)
  assert.equal(previousPageIndex(1, true), 0)
})

test('page jumps select the spread containing the requested page', () => {
  assert.equal(normalizeSpreadStart(0), 0)
  assert.equal(normalizeSpreadStart(1), 1)
  assert.equal(normalizeSpreadStart(2), 1)
  assert.equal(normalizeSpreadStart(9), 9)
  assert.equal(normalizeSpreadStart(10), 9)
})

test('odd and even page counts end without an invalid facing page', () => {
  assert.deepEqual(spreadState(257, 259, true), {
    singlePage: false,
    lastVisiblePage: 258,
    canGoForward: false,
  })
  assert.deepEqual(spreadState(271, 272, true), {
    singlePage: true,
    lastVisiblePage: 271,
    canGoForward: false,
  })
})

test('portrait mode still advances one page at a time', () => {
  assert.equal(nextPageIndex(9, 259, false), 10)
  assert.equal(previousPageIndex(10, false), 9)
  assert.equal(spreadState(9, 259, false).singlePage, true)
})
