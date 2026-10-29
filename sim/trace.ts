// Prints every decision the bot makes in one run, for debugging it.
import { playRun, setLog } from './bot'
setLog((l) => console.log(l))
console.log(playRun({ seed: process.argv[2] ?? 'SIM0' }))
