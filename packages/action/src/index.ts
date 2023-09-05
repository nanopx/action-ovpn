import * as core from '@actions/core'
import { run as main } from './main'
import { run as post } from './post'

const isPost = core.getState('isPost')
const disconnect = core.getState('disconnect')
const isCleanedUp = core.getState('isCleanedUp')
const pid = core.getInput('pid') ?? core.getState('pid')

async function cleanup() {
  try {
    await post(pid)
    core.saveState('isCleanedUp', 'true')
  } catch (e) {
    if (e instanceof Error) {
      core.setFailed(e.message)
    }
  }
}

async function run() {
  if (disconnect && !isCleanedUp) {
    core.info('Disconnecting VPN using `disconnect` option.')

    await cleanup()
    return
  }

  if (!isPost) {
    core.saveState('isPost', 'true')

    try {
      const pid = await main()
      core.saveState('pid', pid)
      core.setOutput('pid', pid)
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
