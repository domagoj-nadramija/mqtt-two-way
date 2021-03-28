const net = require("net");
const { getConfig, execute, getDataPayload } = require("../common");

const config = getConfig("tcp");

const deviceId = config.deviceId;

console.log(`STARTING TCP IOT DEVICE <${deviceId}>`);

console.log(`WILL CONNECT TO ${config.server.host}:${config.server.port}`);

const client = new net.Socket();

client.connect(config.server.port, config.server.host, function () {
  console.log("CONNECTED TO SERVER");
  client.write(JSON.stringify({ deviceId, messageType: "SIGNUP" }));
  // this simulates the device collecting and sending sensor data
  const dataSendInterval = setInterval(() => {
    const data = getDataPayload(deviceId);
    console.log(`SENDING DATA: ${data}`);
    client.write(data);
  }, 5000);

  client.on("data", (data) => {
    const command = JSON.parse(data.toString());
    console.log("RECEIVED COMMAND: " + data.toString());
    const commandResult = execute(command.command);
    const commandResp = JSON.stringify({
      deviceId,
      messageType: "commandResp",
      commandResult,
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
