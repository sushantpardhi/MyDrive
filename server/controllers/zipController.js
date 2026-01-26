const redisQueue = require('../utils/redisQueue');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const File = require('../models/File');
const Folder = require('../models/Folder');

/**
 * Helper to recursively resolve files in a folder
 */
async function resolveFolder(userId, folderId, currentPath, resolved) {
  // Find files in this folder
  const files = await File.find({ parent: folderId, owner: userId, trash: false });
  for (const file of files) {
    if (fs.existsSync(file.path)) {
       resolved.push({ 
         source: path.resolve(file.path), 
         target: path.join(currentPath, file.name) 
       });
    }
  }

  // Find subfolders
  const subfolders = await Folder.find({ parent: folderId, owner: userId, trash: false });
  for (const sub of subfolders) {
    await resolveFolder(userId, sub._id, path.join(currentPath, sub.name), resolved);
  }
}

/**
 * Request a new zip job
 * @route POST /downloads/zip
 */
exports.requestZip = async (req, res) => {
  try {
    const { items } = req.body; // Expects [{ id: '...', type: 'file'|'folder' }]
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items list is required' });
    }

    const jobId = uuidv4();
    const userId = req.user ? req.user.id : null;

    if (!userId) {
       return res.status(401).json({ error: 'Unauthorized' });
    }

    // Resolve all files and folders into a flat list of { source, target }
    const resolvedItems = [];
    
    for (const item of items) {
      if (item.type === 'file') {
        const file = await File.findOne({ _id: item.id, owner: userId, trash: false });
        if (file && fs.existsSync(file.path)) {
          resolvedItems.push({ 
            source: path.resolve(file.path), 
            target: file.name 
          });
        }
      } else if (item.type === 'folder') {
        const folder = await Folder.findOne({ _id: item.id, owner: userId, trash: false });
        if (folder) {
          await resolveFolder(userId, folder._id, folder.name, resolvedItems);
        }
      }
    }

    if (resolvedItems.length === 0) {
      return res.status(400).json({ error: 'No valid files found to zip' });
    }

    const sent = await redisQueue.sendZipJob({
      jobId,
      items: resolvedItems, // Pass resolved physical paths
      userId
    });

    if (!sent) {
      return res.status(503).json({ error: 'Service unavailable. Could not queue job.' });
    }

    res.status(202).json({ 
      success: true, 
      jobId, 
      status: 'PENDING',
      message: 'Zip job queued successfully',
      itemCount: resolvedItems.length
    });

  } catch (error) {
    logger.error('Error requesting zip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get the status of a zip job
 * @route GET /downloads/zip/:jobId/status
 */
exports.getZipStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await redisQueue.getZipJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId,
      status: job.status,
      progress: job.progress,
      message: job.message
    });

  } catch (error) {
    logger.error('Error getting zip status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Download the completed zip file
 * @route GET /downloads/zip/:jobId
 */
exports.downloadZip = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await redisQueue.getZipJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === 'FAILED') {
      return res.status(500).json({ error: 'Zip generation failed', details: job.message });
    }

    if (job.status !== 'READY') {
      return res.status(409).json({ error: 'Zip not ready yet', status: job.status });
    }

    const filePath = job.filePath;

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(500).json({ error: 'Zip file not found on server' });
    }

    const fileName = `archive_${jobId.substring(0, 8)}.zip`;

    res.download(filePath, fileName, (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
        logger.error(`Download error for job ${jobId}:`, err);
      }
      
      // Cleanup: Delete file after download
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          logger.error(`Failed to delete temp zip file ${filePath}:`, unlinkErr);
        } else {
          logger.info(`Deleted temp zip file for job ${jobId}`);
        }
      });
    });

  } catch (error) {
    logger.error('Error downloading zip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
