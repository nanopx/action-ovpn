import * as fs from 'node:fs/promises'
import * as core from '@actions/core'
import { Tail } from 'tail'

const { $ } = await import('execa')

const ovpnConfig: string = core.getInput('ovpnConfig')
const configFile = '.config.ovpn'
const logFile = '.openvpn.log'
const pidFile = '.openvpn.pid'
const TIMEOUT = 15 * 1000

export async function run(): Promise<string> {
  await Promise.all([
    fs.writeFile(configFile, ovpnConfig, 'utf-8'),
    fs.writeFile(logFile, '', 'utf-8'),
  ])

  const tail = new Tail(logFile)

  core.info('Connecting to VPN...')

  try {
    const { stdout } =
      await $`sudo openvpn --config ${configFile} --daemon --log ${logFile} --writepid ${pidFile}`
    core.info(stdout)
  } catch (e) {
    if (e instanceof Error) {
      core.error(e.message)
    } else {
      core.error('Unknown error')
    }

    tail.unwatch()

    throw e
  }

  const timerId = setTimeout(() => {
    core.setFailed('VPN connection timed out.')
    tail.unwatch()
  }, TIMEOUT)

  return new Promise((resolve) => {
    tail.on('line', async (data) => {
      core.info(data)

      if (data.includes('Initialization Sequence Completed')) {
        tail.unwatch()
        clearTimeout(timerId)

        const pid = (await fs.readFile(pidFile, 'utf-8')).trim()
        core.info(`VPN connection established. PID: ${pid}`)

        resolve(pid)
      }
    })
  })
}
