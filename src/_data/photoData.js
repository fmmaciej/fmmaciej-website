const catalog = require("./music/photos.json");
const buildPhotoData = require("../_lib/music/buildPhotoData.js");

module.exports = buildPhotoData(catalog);
