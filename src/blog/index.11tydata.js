const buildBlogArchive = require("../_lib/blog/buildBlogArchive");

module.exports = {
    eleventyComputed: {
        blogArchive: (data) => buildBlogArchive(data.collections?.blog || [])
    }
};
