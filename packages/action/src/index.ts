// import path from 'path'
// import * as github from '@actions/github'
import * as core from '@actions/core'

const ovpnConfig: string = core.getInput('ovpnConfig')

async function run(): Promise<void> {
  console.log('Config', ovpnConfig)
}

run()
