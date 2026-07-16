const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const File = require("./models/File");

mongoose.connect("mongodb://localhost:27017/mydrive");

async function run() {
  const trashedFiles = await File.find({ trash: true });
  console.log("Trashed files count:", trashedFiles.length);
  for (const file of trashedFiles) {
    console.log("Found trashed file:", file.name);
    console.log("File path:", file.path);
    console.log("Exists on disk:", fs.existsSync(file.path));
  }
  
  const allFiles = await File.find({});
  console.log("Total files count:", allFiles.length);
  const activeFiles = allFiles.filter(f => !f.trash);
  
  // check what's actually on disk vs DB
  const userDir = "/Users/sushantpardhi/Desktop/Study/MyDrive/DriveData/69a32c76af89cbd8b88d7c3e";
  if (fs.existsSync(userDir)) {
    const filesOnDisk = fs.readdirSync(userDir).filter(f => f !== 'processed');
    console.log("Files on disk:", filesOnDisk.length);
    for (const fileOnDisk of filesOnDisk) {
      if (fileOnDisk === 'processed' || fileOnDisk === 'temp') continue;
      const dbFile = allFiles.find(f => f.path.endsWith(fileOnDisk));
      if (!dbFile) {
        console.log("ORPHAN ON DISK:", fileOnDisk);
      } else {
        console.log("MAPPED ON DISK:", fileOnDisk, "Trash:", dbFile.trash);
      }
    }
  }

  process.exit(0);
}
run();
