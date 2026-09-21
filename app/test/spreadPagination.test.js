import test from 'node:test'
import assert from 'node:assert/strict'

import {
  nextPageIndex,
  normalizeSpreadStart,
  previousPageIndex,
  spreadState,
} from '../src/utils/spreadPagination.js'

test('landscape pairs PDF pages 1-2 from the first spread', () => {
  assert.deepEqual(spreadState(0, 260, true), {
    singlePage: false,
    lastVisiblePage: 1,
    canGoForward: true,
  })
  assert.equal(nextPageIndex(0, 260, true), 2)
  assert.deepEqual(spreadState(2, 260, true), {
    singlePage: false,
    lastVisiblePage: 3,
    canGoForward: true,
  })
})

test('landscape navigation preserves right-left spread pairs', () => {
  assert.equal(nextPageIndex(0, 260, true), 2)
  assert.equal(nextPageIndex(8, 260, true), 10)
  assert.equal(previousPageIndex(10, true), 8)
  assert.equal(previousPageIndex(2, true), 0)
})

test('page jumps select the spread containing the requested page', () => {
  assert.equal(normalizeSpreadStart(0), 0)
  assert.equal(normalizeSpreadStart(1), 0)
  assert.equal(normalizeSpreadStart(2), 2)
  assert.equal(normalizeSpreadStart(9), 8)
  assert.equal(normalizeSpreadStart(10), 10)
})

test('odd and even page counts end without an invalid facing page', () => {
  assert.deepEqual(spreadState(258, 260, true), {
    singlePage: false,
    lastVisiblePage: 259,
    canGoForward: false,
  })
  assert.deepEqual(spreadState(272, 273, true), {
    singlePage: true,
    lastVisiblePage: 272,
    canGoForward: false,
  })
})

test('portrait mode still advances one page at a time', () => {
  assert.equal(nextPageIndex(9, 259, false), 10)
  assert.equal(previousPageIndex(10, false), 9)
  assert.equal(spreadState(9, 259, false).singlePage, true)
})
