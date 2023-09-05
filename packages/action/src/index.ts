import * as core from '@actions/core'
import { run as main } from './main'
import { run as post } from './post'

const isPost = core.getState('isPost')
const disconnect = core.getState('disconnect')
const isCleanedUp = core.getState('isCleanedUp')

async function cleanup() {
  try {
    const pid = core.getState('pid')
    await post(pid)
    core.saveState('isCleanedUp', 'true')
  } catch (e) {
    if (e instanceof Error) {
      core.setFailed(e.message)
    }
  }
}

async function run() {
  if (disconnect) {
    await cleanup()
    return
  }

  if (!isPost) {
    core.saveState('isPost', 'true')

    try {
      const pid = await main()
      core.saveState('pid', pid)
    } catch (e) {
      if (e instanceof Error) {
        core.setFailed(e.message)
      }
    }
  } else {
    if (isCleanedUp) {
      core.info('VPN already disconnected.')
      return
    }

    await cleanup()
  }
}

run()
