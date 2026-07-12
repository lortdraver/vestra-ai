import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'

const port = process.env.PORT ?? '3000'
const env = { ...process.env, PORT: port, HOSTNAME: '0.0.0.0' }
const standaloneServer = path.join(
  process.cwd(),
  '.next',
  'standalone',
  'server.js',
)
const isWindows = process.platform === 'win32'
const nextBin = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  isWindows ? 'next.cmd' : 'next',
)

const command = existsSync(standaloneServer) ? process.execPath : nextBin
const args = existsSync(standaloneServer)
  ? [standaloneServer]
  : ['start', '-H', '0.0.0.0', '-p', port]

const child = spawn(command, args, {
  env,
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
