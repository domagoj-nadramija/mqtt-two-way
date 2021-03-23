const net = require("net");
const fs = require("fs");

const device_id = "simulated-device-tcp-0001";

console.log(`STARTING TCP IOT DEVICE <${device_id}>`);

const config = JSON.parse(fs.readFileSync(__dirname + "/config.json"));

console.log(`WILL CONNECT TO ${config.server.host}:${config.server.port}`);

const client = new net.Socket();

client.connect(config.server.port, config.server.host, function () {
  console.log("CONNECTED TO SERVER");
  client.write(JSON.stringify({ device_id, message_type: "SIGNUP" }));
  // this simulates the device collecting and sending sensor data
  const dataSendInterval = setInterval(() => {
    const data = JSON.stringify({
      device_id,
      message_type: "DATA",
      temp: 23.6,
      lat: 48.015722,
      lng: -88.625528,
    });
    console.log(`SENDING DATA: ${data}`);
    client.write(data);
  }, 5000);

  client.on("data", (data) => {
    const command = JSON.parse(data.toString());
    console.log("RECEIVED COMMAND: " + data.toString());
    const command_result = execute(command.command);
    const commandResp = JSON.stringify({
      device_id,
      message_type: "COMMAND_RESP",
      command_result,
      ...command,
    });
    console.log(`SENDING COMMAND RESPONSE ${commandResp}`);
    client.write(commandResp);
  });

  client.on("close", () => {
    console.log("CONNECTION CLOSED");
    clearInterval(dataSendInterval);
  });
  client.on("error", (error) => {
    console.log(`ERROR WITH CONNECTION: ${error.code}`);
    clearInterval(dataSendInterval);
  });
  client.on("timeout", () => {
    console.log(`CONNECTION TIMED-OUT`);
    clearInterval(dataSendInterval);
  });
});

// dummy function pretending to execute a command
function execute(command) {
  switch (command) {
    case "PING":
      return "PONG";
    default:
      return "ERROR_UNKNOWN_COMMAND";
  }
}
