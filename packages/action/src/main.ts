import * as fs from 'node:fs/promises'
import * as core from '@actions/core'
import { Tail } from 'tail'

const { $ } = await import('execa')

const ovpnConfig: string = core.getInput('ovpnConfig')
const username: string = core.getInput('username')
const password: string = core.getInput('password')
const configFile = '.config.ovpn'
const logFile = '.openvpn.log'
const pidFile = '.openvpn.pid'
const TIMEOUT = 15 * 1000

export async function run(): Promise<string> {
  await Promise.all([
    fs.writeFile(configFile, ovpnConfig, { mode: 0o600 }),
    fs.writeFile(logFile, '', { mode: 0o600 }),
  ])

  // username & password auth
  if (username && password) {
    await Promise.all([
      fs.writeFile('up.txt', [username, password].join('\n'), { mode: 0o600 }),
      fs.appendFile(configFile, 'auth-user-pass up.txt\n'),
    ])
  }

  core.info((await $`cat ${configFile}`).stdout)
  core.info((await $`cat ${logFile}`).stdout)
  core.info((await $`cat up.txt`).stdout)

  const tail = new Tail(logFile)

  try {
    core.info('Connecting to VPN...')
    const { stdout } =
      await $`sudo openvpn --config ${configFile} --daemon --log ${logFile} --writepid ${pidFile}`
    core.info(stdout)
  } catch (e) {
    tail.unwatch()
    throw e
  }

  return new Promise((resolve) => {
    const timerId = setTimeout(() => {
      tail.unwatch()
      throw new Error('VPN connection timed out.')
    }, TIMEOUT)

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
