const net = require("net");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const config = JSON.parse(fs.readFileSync(__dirname + "/config.json"));

console.log(`STARTING TCP IOT SERVER ON PORT ${config.server.port}`);

const server = net.createServer((socket) => {
  const connPort = socket.remotePort;
  console.log(`NEW CONNECTION FROM ${connPort}`);

  // this simulates the user or an automated system sending commands to the device
  const commandSendInterval = setInterval(() => {
    const command = JSON.stringify({ uuid: uuidv4(), command: "PING" });
    console.log(`SENDING COMMAND TO ${connPort}: ${command}`);
    socket.write(command);
  }, 10000);

  socket.on("data", (data) => {
    console.log(`RECEIVED DATA FROM ${connPort}: ${data.toString()}`);

    storeData(data);
  });
  socket.on("close", () => {
    console.log(`CLOSING CONNECTION TO ${connPort}`);
    clearInterval(commandSendInterval);
  });
  socket.on("error", (error) => {
    console.log(`ERROR WITH CONNECTION TO ${connPort}:`, error.code);
    clearInterval(commandSendInterval);
  });
  socket.on("timeout", () => {
    console.log(`CONNECTION TO ${connPort} TIMED-OUT`);
    clearInterval(commandSendInterval);
  });
});

server.listen(config.server.port, "127.0.0.1");

// dummy function pretending to store data
function storeData(data) {
  console.log("Storing data...");
}
