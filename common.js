if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

function getConfig(protocol) {
  if (protocol == "mqtt")
    return {
      broker: process.env.BROKER,
      dataTopic: process.env.DATA_TOPIC,
      commandRequestTopic: process.env.CMD_REQ_TOPIC,
      commandResponseTopic: process.env.CMD_RESP_TOPIC,
      registerTopic: process.env.REGISTER_TOPIC,
      deviceId: process.env.DEVICE_ID,
      serverId: process.env.SERVER_ID,
    };
  if (protocol == "tcp")
    return {
      server: {
        host: process.env.SERVER_HOST,
        port: process.env.SERVER_PORT,
      },
      deviceId: process.env.DEVICE_ID,
    };
}

// dummy function pretending to store data
function storeData(data) {
  console.log("Storing data...");
}

// dummy function pretending to execute a command
function execute(command) {
  switch (command) {
    case "PING":
      return "PONG";
    default:
      return "ERROR_UNKNOWN_COMMAND";
  }
}

function getDataPayload(deviceId) {
  return JSON.stringify({
    deviceId,
    messageType: "DATA",
    temp: 23.6,
    lat: 48.015722,
    lng: -88.625528,
  });
}

module.exports = { getConfig, storeData, execute, getDataPayload };
