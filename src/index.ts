import { Ticker } from "./ticker";
import { TickerStartOptions, TickerSymbols } from "./ticker-options";

function setTitle(title: string) {
  if (process.platform == "win32") {
    process.title = title;
  } else {
    process.stdout.write("\x1b]2;" + title + "\x1b\x5c");
  }
}

const options: TickerStartOptions = {
  configPath: "./config.json",
};

const ticker = new Ticker(options);

async function start() {
  if (process.argv.length > 2) {
    switch (process.argv[2]) {
      case "positions":
        return ticker.importPositions();

      default:
        throw new Error(`Invalid command: ${process.argv[2]}`);
    }
  } else {
    return ticker.start();
  }
}

setTitle("Stock Ticker");

start().then(
  () => {},
  (err) => console.error(err)
);
