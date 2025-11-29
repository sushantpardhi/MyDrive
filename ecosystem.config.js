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
    {
      name: "mydrive-frontend",
      script: "serve",
      args: "-s client/build -l 127.0.0.1:3000",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",
    },
  ],
};
