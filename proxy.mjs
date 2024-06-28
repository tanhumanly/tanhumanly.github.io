import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import morgan from 'morgan';
import chalk from 'chalk';

const TARGET_HOST = process.env.TARGET_HOST || "https://local.api.internal.humanly.io:4004";

const logHeaders = (headers, prefix = '') => {
  Object.entries(headers)
  .filter(([key, _value]) => 
    ['authorization', 'content-type'].includes(key.toLowerCase())
  )
  .forEach(([key, value]) => {
    console.log(`${prefix}${chalk.green(key)}: ${chalk.cyan(value)}`);
  });
};

const simpleRequestLogger = (proxyServer, options) => {
  proxyServer.on('proxyReq', (proxyReq, req, res) => {
    console.log('-'.repeat(160));
    console.log(chalk.white(req.method), ' ', chalk.white(req.url), ' -> ', chalk.white(`${proxyReq.protocol}://${proxyReq.host}${proxyReq.path}`));
    console.log(chalk.magenta('Request Header: '));
    logHeaders(req.headers, '    ');
  });

  proxyServer.on('proxyRes', (proxyRes, req, res) => {
    console.log(chalk.white(req.method), ' ', chalk.white(req.url), ' <- ', chalk.white(`${proxyRes.req.protocol}://${proxyRes.req.host}${proxyRes.req.path}`));
    console.log(chalk.magenta('Response Header: '));
    logHeaders(proxyRes.headers, '    ');
  });
}

// Proxy middleware options
const proxyOptions = {
  target: TARGET_HOST, 
  changeOrigin: true,
  secure: false, // Accept self-signed certificates
  plugins: [simpleRequestLogger],
};

const app = express();

app.use(morgan('dev'));

// Create the proxy
const proxy = createProxyMiddleware(proxyOptions);

// Use the proxy for all routes
app.use('/', proxy);

const logResponseBody = (req, res, next) => {
  const originalSend = res.send;
  const chunks = [];
  res.send = (chunk) => {
    chunks.push(chunk);
    return originalSend.apply(res, arguments);
  };

  res.on('finish', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    console.log(chalk.magenta('Response Body:'));
    console.log(body);
  });

  next();
};

app.use(logResponseBody);

// Start the Express server
const PORT = process.env.PORT || 7001;
app.listen(PORT, () => {
  console.log(chalk.blue(`Proxying http://localhost:${PORT} -> ${TARGET_HOST}`));
});
