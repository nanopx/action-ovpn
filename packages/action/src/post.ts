import * as fs from 'node:fs/promises'
import * as core from '@actions/core'

const { $ } = await import('execa')

const logFile = '.openvpn.log'

export async function run(pid: string) {
  if (!pid) {
    core.warning('Could not find process')
    return
  }

  core.info(`Cleaning up VPN connection with pid: ${pid}`)

  try {
    core.info(await fs.readFile(logFile, 'utf-8'))

    await $`sudo kill ${pid}`
    core.info('Done.')
  } catch (e) {
    if (e instanceof Error) {
      core.warning(e.message)
    }
  }
}
