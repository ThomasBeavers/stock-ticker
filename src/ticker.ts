import { FSWatcher, promises as fsPromises, watch } from "fs";
import moment from "moment";
import yahooFinance from "yahoo-finance2";
import parse from "node-html-parser";

import {
  Position,
  //   Quote,
  //   QuoteResponse,
  TickerOptions,
  TickerStartOptions,
  TickerSymbols,
  //   isQuoteResponse,
  //   isStockResponse,
} from "./ticker-options";
import { QuoteResponseArray } from "yahoo-finance2/dist/esm/src/modules/quote";

const growl = require("growl");

interface TableRow {
  symbol: string | number;
  price: string | number;
  change: string | number;
  changePercent: string | number;
  volume: string | number;
  cost: string | number;
  totalChange: string | number;
  totalChangePercent: string | number;
  currentValue: string | number;
  marketIndicator: string | number;
}

interface ColumnDefinition {
  name: string;
  color?: string;
  compact?: boolean;
  decimals?: number;
  length: number;
  postfix?: string;
  prefix?: string;
}

enum TickerErrorSource {
  UpdateFromConfig,
}

interface TickerError {
  source: TickerErrorSource;
  msg: any[];
}

export class Ticker {
  //   private static apiEndpoint =
  // 	  "https://query1.finance.yahoo.com/v7/finance/quote?lang=en-US&region=US&corsDomain=finance.yahoo.com";

  private static colors = {
    // Reset: "\x1b[0m",
    Default: "\x1b[39m",
    BrightOn: "\x1b[1m",
    BrightOff: "\x1b[22m",
    Red: "\x1b[31m",
    Green: "\x1b[32m",
    BackGrey: "\x1b[48;5;235m",
    BackDefault: "\x1b[49m",
  };

  private static defaults: TickerStartOptions = {
    configPath: "",
    frequency: 10,
    limitHours: false,
  };

  private static fields = [
    "symbol",
    "marketState",
    "regularMarketPrice",
    "regularMarketChange",
    "regularMarketChangePercent",
    "regularMarketVolume",
    "preMarketPrice",
    "preMarketChange",
    "preMarketChangePercent",
    "postMarketPrice",
    "postMarketChange",
    "postMarketChangePercent",
  ];

  private readonly alertStatus: {
    [symbol: string]: { [price: number]: number };
  } = {};

  private afterHoursLogged: boolean = false;
  private previousTable: TableRow[] | null = null;
  private running = false;
  private updateFromConfigTimer: NodeJS.Timeout | null = null;
  private watcher?: FSWatcher;
  private weekendLogged: boolean = false;
  private error: TickerError | null = null;

  public readonly options: TickerOptions;

  public signal: any;

  constructor(private readonly startOptions: TickerStartOptions) {
    this.startOptions = { ...Ticker.defaults, ...startOptions };
    this.options = { ...this.startOptions, ...{ stocks: {} as TickerSymbols } };
  }

  public async start(): Promise<void> {
    await this.watchConfig();

    if (
      typeof this.options.frequency === "number" &&
      this.options.frequency > 0
    ) {
      setInterval(async () => {
        await this.doUpdate();
      }, this.options.frequency * 1000);
    }
  }

  public async importPositions(): Promise<void> {
    // for each file in data/positions parse the html and update the config in config.json using the file name as the symbol
    const files = await fsPromises.readdir("./data/positions");
    const positions: TickerSymbols = {};

    for (const file of files) {
      const content = await fsPromises.readFile(
        `./data/positions/${file}`,
        "utf8"
      );

      const symbol = file.split(".")[0];

      const table = parse(content);

      const positions = table
        .querySelectorAll("tr")
        .map((row) => {
          const cells = row.querySelectorAll("td");

          if (!cells.length) return null;

          return {
            amount: parseFloat(cells[5].textContent || "0"),
            price: parseFloat((cells[6].textContent || "0").replace("$", "")),
          };
        })
        .filter((row) => row !== null) as Position[];

      this.updateConfig(symbol, positions);
    }
  }

  private async doUpdate(): Promise<void> {
    try {
      this.previousTable = await this.update(this.previousTable);
    } catch (e) {
      console.error(e);
    }
  }

  private format(
    val: number,
    columnDef: ColumnDefinition,
    lengthCheck: boolean = false,
    previous: number | null = null
  ): string {
    let formatted = "";
    let prevFormatted = null;

    let prevColor = "";

    if (previous) {
      if (previous < val) prevColor = Ticker.colors.Green;
      else if (previous > val) prevColor = Ticker.colors.Red;
    }

    if (columnDef.compact) {
      formatted = Intl.NumberFormat("en", {
        notation: "compact",
        minimumFractionDigits: columnDef.decimals ? columnDef.decimals : 2,
      } as any).format(val);
    } else {
      formatted = this.formatFull(val, columnDef);
      if (previous) prevFormatted = this.formatFull(previous, columnDef);
    }

    formatted = (columnDef.prefix + formatted + columnDef.postfix).padStart(
      lengthCheck ? 0 : columnDef.length
    );

    if (lengthCheck) return formatted;

    if (prevFormatted) {
      prevFormatted = (
        columnDef.prefix +
        prevFormatted +
        columnDef.postfix
      ).padStart(lengthCheck ? 0 : columnDef.length);

      if (prevFormatted.length !== formatted.length) {
        formatted = prevColor + formatted;
      } else {
        let index = -1;
        for (var i = formatted.length - 1; i > 0; i--) {
          if (formatted[i] !== prevFormatted[i]) {
            index = i;
          }
        }

        if (index >= 0)
          formatted =
            formatted.substring(0, index) +
            prevColor +
            formatted.substring(index);
      }
    }

    let color = "";

    if (columnDef.color) color = columnDef.color;
    else if (val < 0) color = Ticker.colors.Red;
    else if (val > 0) color = Ticker.colors.Green;

    return (
      color +
      formatted +
      (color.includes(Ticker.colors.BrightOn) ? Ticker.colors.BrightOff : "") +
      (color.length > 0 ? Ticker.colors.Default : "")
    );
  }

  private formatFull(val: number, columnDef: ColumnDefinition) {
    const fractionDigits = columnDef.decimals ? columnDef.decimals : 2;
    return (val || 0).toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  }

  private async pullStocks(
    stocks: TickerSymbols
  ): Promise<{ error?: unknown; result: QuoteResponseArray }> {
    try {
      return { result: await yahooFinance.quote(Object.keys(stocks)) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";

      return { error: msg, result: [] };
    }
  }

  private async update(
    previousTable: TableRow[] | null
  ): Promise<TableRow[] | null> {
    if (this.running) return null;

    if (this.options.limitHours) {
      const now = new Date();
      const hour = now.getHours();
      if (hour < 4 || hour >= 20) {
        // Only active from 4am to 8pm EST
        if (!this.afterHoursLogged) {
          console.log("Outside of market hours");
          this.afterHoursLogged = true;
        }
        return null;
      }
      this.afterHoursLogged = false;

      const day = now.getDay();
      if (day === 0 || day === 6) {
        // Only active Mon-Fri
        if (!this.weekendLogged) {
          console.log("Market closed on weekends.");
          this.weekendLogged = true;
        }
        return null;
      }
      this.weekendLogged = false;
    }

    try {
      this.running = true;

      const results = await this.pullStocks(this.options.stocks);

      if (results.error) {
        console.error(results.error);

        return previousTable;
      }

      const columns: Record<keyof TableRow, ColumnDefinition> = {
        symbol: { name: "Symbol", length: 0, color: Ticker.colors.BrightOn },
        price: { name: "Price", length: 0, color: Ticker.colors.BrightOn },
        change: { name: "Change", length: 0, prefix: "$" },
        changePercent: { name: "Change %", length: 0, postfix: "%" },
        volume: {
          name: "Volume",
          length: 0,
          color: Ticker.colors.BrightOn,
          compact: true,
        },
        cost: {
          name: "Avg Cost",
          length: 0,
          color: Ticker.colors.BrightOn,
          prefix: "$",
        },
        totalChange: { name: "Total", length: 0, prefix: "$" },
        totalChangePercent: { name: "Total %", length: 0, postfix: "%" },
        currentValue: {
          name: "Current Value",
          length: 0,
          color: Ticker.colors.BrightOn,
          prefix: "$",
        },
        marketIndicator: { name: " ", length: 0 },
      };

      (Object.keys(columns) as Array<keyof TableRow>).forEach((column) => {
        columns[column].length = columns[column].name.length;

        if (!columns[column].prefix) {
          columns[column].prefix = "";
        }

        if (!columns[column].postfix) {
          columns[column].postfix = "";
        }
      });

      const table = results.result.map((quote, index) => {
        let marketIndicator = "*";

        let price = quote.regularMarketPrice;
        let change = quote.regularMarketChange;
        let changePercent = quote.regularMarketChangePercent;
        let volume = quote.regularMarketVolume;

        switch (quote.marketState) {
          case "PRE":
            marketIndicator = "<";
            price = quote.preMarketPrice;
            change = quote.preMarketChange;
            changePercent = quote.preMarketChangePercent;
            break;

          case "POST":
            marketIndicator = ">";
            price = quote.postMarketPrice;
            change = quote.postMarketChange;
            changePercent = quote.postMarketChangePercent;
            break;

          default:
            break;
        }

        price = price || 0;
        change = change || 0;
        changePercent = changePercent || 0;
        volume = volume || 0;

        const symbolConfig = this.options.stocks[quote.symbol];
        if (symbolConfig.alerts) {
          if (!this.alertStatus[quote.symbol]) {
            this.alertStatus[quote.symbol] = {};
          }

          symbolConfig.alerts.forEach((alertPrice) => {
            let alertCheck = price - alertPrice;

            if (alertCheck > 0) alertCheck = 1;
            else if (alertCheck < 0) alertCheck = -1;

            if (
              this.alertStatus[quote.symbol][alertPrice] != null &&
              this.alertStatus[quote.symbol][alertPrice] !== alertCheck
            ) {
              if (alertCheck > 0)
                growl(`${quote.symbol} has gone above ${alertPrice}: ${price}`);
              else if (alertCheck < 0)
                growl(`${quote.symbol} has gone below ${alertPrice}: ${price}`);
              else growl(`${quote.symbol} has reached ${alertPrice}: ${price}`);
            }

            this.alertStatus[quote.symbol][alertPrice] = alertCheck;
          });
        }

        let hasPositions = false;
        let cost = 0;
        let currentValue = 0;

        if (symbolConfig.positions && symbolConfig.positions.length > 0) {
          hasPositions = true;
          symbolConfig.positions.forEach((holding) => {
            cost += holding.amount * holding.price;
            currentValue += holding.amount * price;
          });
        }

        const totalChange = currentValue - cost;

        const row: TableRow = {
          symbol: quote.symbol,
          price,
          change,
          changePercent,
          volume: this.format(volume, columns.volume, true),
          totalChange: hasPositions ? totalChange : "-",
          cost: hasPositions ? this.format(cost, columns.cost, true) : "-",
          totalChangePercent: hasPositions ? (totalChange / cost) * 100 : "-",
          currentValue: hasPositions
            ? this.format(currentValue, columns.currentValue, true)
            : "-",
          marketIndicator,
        };

        (Object.keys(row) as Array<keyof TableRow>).forEach((column) => {
          let value = row[column];

          if (
            value == null &&
            previousTable != null &&
            previousTable.length > index
          ) {
            value = previousTable[index][column];
            row[column] = value;
          }

          const length =
            typeof value === "string"
              ? value.length
              : this.format(value, columns[column], true).length;

          columns[column].length = Math.max(columns[column].length, length);
        });

        return row;
      });

      console.clear();

      console.log(
        Ticker.colors.BrightOn +
          Ticker.colors.BackGrey +
          (Object.keys(columns) as Array<keyof TableRow>)
            .map((column) =>
              columns[column].name.padStart(columns[column].length)
            )
            .join("  ") +
          Ticker.colors.BackDefault +
          Ticker.colors.BrightOff
      );

      table.forEach((row, index) => {
        console.log(
          (index % 2 === 1 ? Ticker.colors.BackGrey : "") +
            (Object.keys(columns) as Array<keyof TableRow>)
              .map((column) => {
                const color = columns[column].color;
                let value = row[column];

                if (typeof value === "string") {
                  value = value.padStart(columns[column].length);

                  if (color)
                    return (
                      color +
                      value +
                      (color.includes(Ticker.colors.BrightOn)
                        ? Ticker.colors.BrightOff
                        : "") +
                      Ticker.colors.Default
                    );

                  return value;
                }

                if (column === "price") {
                  if (previousTable != null && previousTable.length > index) {
                    const previousPrice = previousTable[index].price;
                    if (typeof previousPrice === "number")
                      return this.format(
                        value,
                        columns[column],
                        false,
                        previousPrice
                      );
                  }
                }

                return this.format(value, columns[column]);
              })
              .join("  ") +
            (index % 2 === 1 ? Ticker.colors.BackDefault : "")
        );
      });

      console.log("\n");
      console.log(moment().format("L LTS"));
      this.displayError();

      return table;
    } finally {
      this.running = false;
    }
  }

  private clearError(source: TickerErrorSource) {
    if (this.error && this.error.source === source) {
      this.error = null;
    }
  }

  private displayError(
    source: TickerErrorSource | null = null,
    msg: any[] | null = null
  ) {
    if (source !== null) {
      this.error = {
        source,
        msg: msg || [],
      };
    }

    if (this.error) {
      console.error(
        ...[TickerErrorSource[this.error.source], ...this.error.msg]
      );
    }
  }

  private async updateConfig(symbol: string, positions: Position[]) {
    await this.updateFromConfig();

    this.options.stocks[symbol] = {
      ...this.options.stocks[symbol],
      positions,
    };

    await fsPromises.writeFile(
      this.startOptions.configPath,
      JSON.stringify(this.options.stocks, null, 2)
    );
  }

  private async onChangedConfig(): Promise<void> {
    await this.updateFromConfig();

    await this.doUpdate();
  }

  private async updateFromConfig() {
    this.clearError(TickerErrorSource.UpdateFromConfig);

    var configJson = await fsPromises.readFile(
      this.startOptions.configPath,
      "utf8"
    );

    try {
      const newConfig = JSON.parse(configJson) as TickerSymbols;

      this.options.stocks = newConfig;
    } catch (e) {
      this.displayError(TickerErrorSource.UpdateFromConfig, [
        "Invalid config file:",
        e,
      ]);
    }
  }

  private async watchConfig(): Promise<void> {
    if (this.watcher) return;

    this.watcher = watch(
      this.startOptions.configPath,
      (eventType, filename) => {
        if (this.updateFromConfigTimer)
          clearTimeout(this.updateFromConfigTimer);

        this.updateFromConfigTimer = setTimeout(() => {
          this.onChangedConfig();
        }, 100);
      }
    );

    await this.onChangedConfig();
  }
}
