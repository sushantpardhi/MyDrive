module.exports = {
  apps: [
    {
      name: "mydrive-backend",
      cwd: "./server",
      script: "index.js",
      env: {
        NODE_ENV: "production",
        PORT: 8080,
      },
      instances: 1,
      exec_mode: "fork",
    },
    // {
    //   name: "mydrive-frontend",
    //   script: "serve",
    //   args: "serve --name frontend -- -s build -l 3000 --single-spa --listen :contentReference[oaicite:2]{index=2}",
    //   env: {
    //     NODE_ENV: "production",
    //   },
    //   instances: 1,
    //   exec_mode: "fork",
    // },
  ],
};
