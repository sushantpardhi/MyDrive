const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const File = require("./models/File");

mongoose.connect("mongodb://localhost:27017/mydrive");

async function run() {
  const allFiles = await File.find({});
  console.log("Total files count:", allFiles.length);
  for (const f of allFiles) {
    console.log(`DB File id=${f._id} name="${f.name}" path="${f.path}"`);
  }
  process.exit(0);
}
run();
