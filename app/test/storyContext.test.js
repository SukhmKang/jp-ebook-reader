import test from 'node:test'
import assert from 'node:assert/strict'

import { buildStoryContext } from '../src/utils/storyContext.js'

function page(text) {
  return { blocks: [{ paragraphs: [{ text }] }] }
}

test('builds chronological context through the current page', () => {
  const context = buildStoryContext([page('one'), page('two'), page('three')], 1)
  assert.equal(context, '[Page 1]\none\n\n[Page 2]\ntwo')
})

test('uses only the configured recent page window', () => {
  const context = buildStoryContext([page('one'), page('two'), page('three')], 2, 1)
  assert.equal(context, '[Page 2]\ntwo\n\n[Page 3]\nthree')
})

test('keeps the newest context when capped', () => {
  const context = buildStoryContext([page('old text'), page('new text')], 1, 12, 16)
  assert.equal(context, '[Page 2]\nnew tex')
})
