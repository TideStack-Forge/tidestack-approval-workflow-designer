import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('ouroboros-sdk', () => ({
  renderAmisSchema: vi.fn(),
}))

import { renderAmisSchema } from 'ouroboros-sdk'
import toast from '../../../src/utils/toast.js'

const createElement = () => {
  return {
    style: {},
    appendChild: vi.fn(),
    setAttribute: vi.fn(),
  }
}

describe('toast utility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.document = {
      body: {
        appendChild: vi.fn(),
      },
      createElement: vi.fn(() => createElement()),
    }
  })

  it('dispatches toast actions when the rendered scope exposes doAction', async () => {
    const doAction = vi.fn()
    renderAmisSchema.mockResolvedValue({
      doAction,
    })

    await expect(
      toast({
        msg: '删除成功',
      })
    ).resolves.toBe(true)
    expect(doAction).toHaveBeenCalledWith({
      actionType: 'toast',
      args: {
        msg: '删除成功',
      },
    })
  })

  it('returns false instead of throwing when the rendered scope cannot toast', async () => {
    renderAmisSchema.mockResolvedValue({})

    await expect(
      toast({
        msg: '删除失败',
      })
    ).resolves.toBe(false)
  })

  it('returns false when renderAmisSchema itself fails', async () => {
    renderAmisSchema.mockRejectedValue(new Error('boom'))

    await expect(
      toast({
        msg: '删除失败',
      })
    ).resolves.toBe(false)
  })
})
