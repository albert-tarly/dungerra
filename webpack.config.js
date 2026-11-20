const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");
const { env } = require("process");

// "web" (GitHub Pages, talks to the hosted server) or "desktop" (served by the
// game server itself: desktop app and LAN hosts). See src/config.ts.
const target = env.DUNGERRA_TARGET === "desktop" ? "desktop" : "web";
const isDesktop = target === "desktop";
const isProduction = env.NODE_ENV === "production";

// GitHub Pages answers unknown paths with 404.html, so deep links such as
// /dungerra/<sessionId> still load the app and the router takes over. The game
// server falls back to index.html itself, so desktop builds don't need it.
const pageFiles = isDesktop ? ["index.html"] : ["index.html", "404.html"];

module.exports = {
  entry: "./src/index.tsx",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            allowTsInNodeModules: true,
          },
        },
        exclude: /node_modules\/(?!dungerra-api)/,
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: "asset/resource",
        generator: {
          filename: "assets/[hash][ext][query]",
        },
      },
      {
        test: /\.ogg$/i,
        type: "asset/resource",
        generator: {
          filename: "assets/[hash][ext][query]",
        },
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "[name].[contenthash].js",
    // Separate folders, so a desktop build never ends up on GitHub Pages
    path: path.resolve(__dirname, isDesktop ? "dist-desktop" : "dist"),
    clean: true,
    // Must match ROUTER_BASENAME in src/config.ts
    publicPath: isProduction && !isDesktop ? "/dungerra/" : "/",
  },
  plugins: [
    // Always defined: the browser has no `process`, so an undefined
    // process.env.DUNGERRA_TARGET would throw at runtime
    new webpack.DefinePlugin({
      "process.env.DUNGERRA_TARGET": JSON.stringify(target),
    }),
    ...pageFiles.map(
      (filename) =>
        new HtmlWebpackPlugin({
          template: "./src/index.html",
          filename,
          inject: "body",
          hash: true,
        }),
    ),
    new CopyWebpackPlugin({
      patterns: [{ from: "src/favicon.png", to: "favicon.png" }],
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, "dist"),
    },
    compress: true,
    port: 9000,
    hot: true,
    historyApiFallback: true,
  },
};
