const runner = require("./python");

// Create instance with python ouput debugging
const py = runner({ debug: true });

// Listen for start event
py.on('start', () => {
  
  // Run array of commmands whose gonna be executed in queue order
  py.run([
    `from script import helloworldclass`,
    `x = helloworldclass()`,
    `x.main()`
  ], (err, data) => {
    // Returns error flag or received data array (converted to string)
    // Data has getting from the last command
    console.log(err, data)
  })
});
