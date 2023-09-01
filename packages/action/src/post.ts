import * as core from '@actions/core'
import { $ } from 'execa'

export async function run(pid: string) {
  if (!pid) {
    core.warning('Could not find process')
    return
  }

  try {
    $`sudo kill ${pid} || true`
  } catch (e) {
    if (e instanceof Error) {
      core.warning(e.message)
    }
  }
}
