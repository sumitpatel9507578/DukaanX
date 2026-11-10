const multer = require('multer');
const { getCloudinary } = require('../config/cloudinary');

const parseImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(Object.assign(new Error('Only JPEG, PNG, and WebP images are supported'), { status: 400 }));
      return;
    }
    callback(null, true);
  },
});

function uploadImage(fieldName = 'image') {
  return [
    parseImage.single(fieldName),
    async (req, res, next) => {
      if (!req.file) return next();
      const cloudinary = getCloudinary();
      if (!cloudinary) return next(Object.assign(new Error('Cloudinary image upload is not configured'), { status: 503 }));
      try {
        const uploaded = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'dukaanx', resource_type: 'image' },
            (error, result) => error ? reject(error) : resolve(result),
          );
          stream.end(req.file.buffer);
        });
        req.body[fieldName] = uploaded.secure_url;
        return next();
      } catch (error) {
        return next(error);
      }
    },
  ];
}

module.exports = { uploadImage };
