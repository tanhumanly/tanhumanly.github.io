import express from "express";
import axios from "axios";
import morgan from "morgan";
import bodyParser from "body-parser";
import cors from "cors";
import chalk from "chalk";

const app = express();

const TARGET_SERVER =
  process.env.TARGET_SERVER || "https://local.api.internal.humanly.io:4004";
const FAKE_ORIGIN = process.env.FAKE_ORIGIN || null; // Set this environment variable if you want to fake the origin

// Setup morgan logger
app.use(morgan("dev"));

// Setup CORS to allow all origins
app.use(cors());

// Middleware to parse JSON and URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const logHeaders = (headers, prefix = "") => {
  Object.entries(headers)
    .filter(([key, _value]) =>
      ["authorization", "content-type"].includes(key.toLowerCase())
    )
    .forEach(([key, value]) => {
      console.log(`${prefix}${chalk.green(key)}: ${chalk.cyan(value)}`);
    });
};

// Function to forward requests
const forwardRequest = async (req, res) => {
  try {
    const targetServer = req.headers["x-target-server"] || TARGET_SERVER;
    const fakeOrigin = req.headers["x-fake-origin"] || FAKE_ORIGIN;

    const url = `${targetServer}${req.originalUrl}`;
    const headers = { ...req.headers };
    delete headers["host"]; // Remove the host header to avoid conflict with the target server

    console.log(
      chalk.white(req.method),
      " ",
      chalk.white(req.path),
      " -> ",
      chalk.white(url)
    );

    console.log(chalk.magenta("Response Header: "));
    logHeaders(headers, "    ");

    // Optionally fake the origin
    if (fakeOrigin) {
      headers["origin"] = fakeOrigin;
    }

    const response = await axios({
      method: req.method,
      url,
      headers,
      data: req.body,
      params: req.query,
    });

    console.log(
      chalk.white(req.method),
      " ",
      chalk.white(req.path),
      " <- ",
      chalk.white(url)
    );

    console.log(JSON.stringify(response.data, null, 2));

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Proxy Error:", error);
    if (error.response) {
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).send("Proxy error");
    }
  }
};

// Use the forwardRequest function for all routes
app.use("*", forwardRequest);

// Start the Express server
const PORT = process.env.PORT || 7001;
app.listen(PORT, () => {
  console.log(
    chalk.blue(`Proxying http://localhost:${PORT} -> ${TARGET_SERVER}`)
  );
});
