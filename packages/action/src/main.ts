import * as fs from 'node:fs/promises'
import * as core from '@actions/core'
import { Tail } from 'tail'

const { $ } = await import('execa')

const ovpnConfig: string = core.getInput('ovpnConfig')
const username: string = core.getInput('username')
const password: string = core.getInput('password')
const ignoreDomains: string = core.getInput('ignoreDomains')
const configFile = '.config.ovpn'
const logFile = '.openvpn.log'
const pidFile = '.openvpn.pid'
const TIMEOUT = 15 * 1000

export async function run(): Promise<string> {
  await Promise.all([
    fs.writeFile(configFile, ovpnConfig, { mode: 0o600 }),
    fs.writeFile(logFile, '', { mode: 0o600 }),
  ])

  if (ignoreDomains) {
    const domains = ignoreDomains.split(/\r|\n/).map((domain) => domain.trim())
    core.info(`Ignoring domains: ${domains.join(', ')}`)

    const results = await Promise.all(domains.map((domain) => $`dig -4 -t A +short ${domain}`))

    const ips = results.map((result) => result.stdout)

    core.info(ips.join('\n'))
  }

  // username & password auth
  if (username && password) {
    await Promise.all([
      fs.writeFile('up.txt', [username, password].join('\n'), { mode: 0o600 }),
      fs.appendFile(configFile, '\nauth-user-pass up.txt\n'),
    ])
  }

  const tail = new Tail(logFile)

  core.info('Connecting to VPN...')
  const { stdout, exitCode } = await $({
    detached: true,
    reject: false,
  })`sudo openvpn --config ${configFile} --daemon --log ${logFile} --writepid ${pidFile}`
  core.info(stdout)

  if (exitCode !== 0) {
    core.info(await fs.readFile(logFile, 'utf-8'))
    tail.unwatch()
    throw new Error('VPN connection failed.')
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
