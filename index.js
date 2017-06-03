const { spawn } = require('child_process');
const events = require('events');
const path = require('path');

class Runner extends events {

  constructor({ bin, cwd, debug }) {
    super();
  
    // Which python to run
    this.bin = bin || process.env.PYTHON_BIN || "python";
    // Working directory for windows shell
    this.cwd = cwd || process.env.PYTHON_CWD || __dirname;
    // Shows a full io of shell
    this.debug = debug;

    this.queue = [];

    // Flag of a suspence
    this.freestr = '>>>';

    // State params
    this.started = false;

    this.execution = this.connect();

    if (this.execution) {
      this.observe(this.execution);
      this.emit('spawn');
    }
  }

  connect() {
    var execution = null;

    if (process.env.NODE_ENV !== 'production') {
      console.log('python-runner: PYTHON_BIN=' + this.bin)
      console.log('python-runner: PYTHON_CWD=' + this.cwd);
    }

    try {
      execution = spawn(this.bin, ['-u', '-i'], { cwd: this.cwd });
      execution.on('error', (err) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('python-runner: start failed by reason ', err.message);
        }
        this.emit('fail', err);
      })
    } catch (err) { this.emit('fail', err); }

    return execution
  }

  observe(execution) {

    // Next queue order item execution
    this.exec = () => {

      // If queue is empty
      if (this.queue.length < 1) {
        return false
      }

      // Pair is combination of command and own callback
      this.pair = this.queue.shift();
      const cmd = this.pair.cmd + "\n";

      if (this.debug) {
        process.stdout.write(cmd)
      }

      execution.stdin.write(Buffer.from(cmd));
    }

    const next = (buf) => {
      if (this.debug) {
        process.stdout.write(buf.toString());
      }
  
      // Remove newline chars
      var data = (buf ? buf.toString().replace(/(?:\\[rn]|[\r\n]+)+/g, " ") : "");

      // If python waits for new command then send in
      if (data.indexOf(this.freestr) === 0) {
        if (this.cb) {
          this.cb();
          this.cb = undefined
        }
        
        this.exec()
        
      } else {

        // If hello message showed
        if (data.indexOf('Python') >= 0 && this.started === false) {
          this.started = true;
          return this.emit('start');
        }

        if (this.pair && typeof this.pair.cb === 'function') {
          if (/error/ig.test(data)) {
            this.pair.cb(true, null)
          } else {
            console.log('setting cb')
            // Save callback for last output
            var cb = this.pair.cb
            this.cb = () => cb(null, data);
          }
        }

        this.emit('data', data);
      }
    };

    // Listen for any stream of data
    execution.stdout.on('data', next);

    // Python shell uses error ouput as a default, wtf?
    execution.stderr.on('data', next);
  }

  run(cmd, cb) {
    var immediate = this.queue.length === 0

    if (typeof cmd === 'string') {
      this.queue.push({ cmd, cb });
    } else if (Array.isArray(cmd)) {
      this.__insertArray(cmd, cb)
    }

    // If queue was empty
    if (immediate) {
      this.exec()
    }
  }

  __insertArray(array, cb) {
    var lastWithCallback = array.pop();

    array.map((c, i) => {
      this.queue.push({ cmd: c });
    })

    // Append last item with callback
    this.queue.push({ cmd: lastWithCallback, cb });
  }
}

module.exports = (options) => {
  return new Runner(options)
}
