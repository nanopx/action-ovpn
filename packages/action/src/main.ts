import * as fs from 'node:fs/promises'
import * as core from '@actions/core'
import { Tail } from 'tail'

const { $ } = await import('execa')

const ovpnConfig: string = core.getInput('ovpnConfig')
const username: string = core.getInput('username')
const password: string = core.getInput('password')
const domains: string = core.getInput('domains')
const configFile = '.config.ovpn'
const logFile = '.openvpn.log'
const pidFile = '.openvpn.pid'
const TIMEOUT = 15 * 1000

export async function run(): Promise<string> {
  await Promise.all([
    fs.writeFile(configFile, ovpnConfig, { mode: 0o600 }),
    fs.writeFile(logFile, '', { mode: 0o600 }),
  ])

  if (domains) {
    const domainList = domains.split(/\r|\n/).map((domain) => domain.trim())
    core.info(`Allowed domains: ${domainList.join(', ')}`)

    const results = await Promise.all(domainList.map((domain) => $`dig -4 -t A +short ${domain}`))
    const ips = results.flatMap((result) => result.stdout.split(/\r|\n/))

    core.info(`Resolved IPs: ${ips.join(', ')}`)

    const routes = ips.map((ip) => `route ${ip} 255.255.255.255`)

    await fs.appendFile(configFile, `\nroute-nopull\n${routes.join('\n')}\n`)
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
