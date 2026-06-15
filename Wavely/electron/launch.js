const { spawn } = require('child_process')
const electron = require('electron')
const path = require('path')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electron, [path.join(__dirname, '..')], {
  stdio: 'inherit',
  env,
})
child.on('close', code => process.exit(code || 0))
