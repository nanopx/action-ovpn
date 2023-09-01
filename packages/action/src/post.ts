import * as core from '@actions/core'

const { $ } = await import('execa')

export async function run(pid: string) {
  if (!pid) {
    core.warning('Could not find process')
    return
  }

  core.info('Cleaning up VPN connection...')

  try {
    await $`sudo kill ${pid} || true`
    core.info('Done.')
  } catch (e) {
    if (e instanceof Error) {
      core.warning(e.message)
    }
  }
}
