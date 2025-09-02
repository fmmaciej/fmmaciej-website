module.exports = function(eleventyConfig) {
    eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
    eleventyConfig.addPassthroughCopy({ "src/assets/music/gigs/_display": "assets/music/gigs/_display" });
    eleventyConfig.addPassthroughCopy({ "src/assets/music/gigs/_thumbs": "assets/music/gigs/_thumbs" });
    eleventyConfig.addPassthroughCopy({ "src/assets/music/mixes": "assets/music/mixes" });
    eleventyConfig.addPassthroughCopy({ "src/assets/terminal": "assets/terminal" });

    // BLOG
    eleventyConfig.addCollection("blog", (collection) => {
        return collection.getFilteredByGlob("src/posts/*.md")
        .filter(p => !p.data.draft)                  // ukryj szkice
        .sort((a,b) => b.date - a.date);            // najnowsze pierwsze
    });

    // === YT thumbnail filter ===
    function extractYouTubeId(url) {
        try {
            const u = new URL(url);
            const host = u.hostname.replace(/^www\./, "");

            if (host === "youtu.be") {
                return u.pathname.slice(1);
            }

            if (host === "youtube.com" || host.endsWith(".youtube.com")) {

            if (u.searchParams.get("v")) return u.searchParams.get("v");        // watch?v=ID
                const parts = u.pathname.split("/").filter(Boolean);                // /shorts/ID, /embed/ID
                if ((parts[0] === "shorts" || parts[0] === "embed") && parts[1]) return parts[1];
            }
        } catch (e) { 
            /* ignore */ 
        }

        return null;
    }

    eleventyConfig.addNunjucksFilter("ytThumb", (url) => {
        const id = extractYouTubeId(url);
        return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
    });

    // Date filter
    eleventyConfig.addFilter("blogDate", (dateObj) =>
        new Intl.DateTimeFormat("pl-PL", { year:"numeric", month:"long", day:"2-digit" }).format(dateObj)
    );

    return {
        dir: { 
            input: "src", 
            includes: "_includes", 
            output: "www" 
        },
        markdownTemplateEngine: "njk",
        htmlTemplateEngine: "njk"
    };
};
