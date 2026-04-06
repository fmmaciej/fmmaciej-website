module.exports = function(eleventyConfig) {
    eleventyConfig.addPassthroughCopy({ "src/.htaccess": ".htaccess" });
    eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
    eleventyConfig.addPassthroughCopy({ "src/assets/music/gigs/_images": "assets/music/gigs/_images" });
    eleventyConfig.addPassthroughCopy({ "src/assets/music/mixes/_images": "assets/music/mixes/_images" });
    eleventyConfig.addPassthroughCopy({ "src/assets/music/photos/_images": "assets/music/photos/_images" });
    eleventyConfig.addPassthroughCopy({ "src/assets/terminal": "assets/terminal" });
    eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });

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

    function parseMixDate(value) {
        if (!value || typeof value !== "string") return Number.NEGATIVE_INFINITY;

        const normalized = value.trim();
        if (!normalized) return Number.NEGATIVE_INFINITY;

        if (normalized.includes(" - ")) {
            return normalized
                .split(/\s+-\s+/)
                .map(parseMixDate)
                .reduce((latest, current) => Math.max(latest, current), Number.NEGATIVE_INFINITY);
        }

        let match = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (match) {
            const [, day, month, year] = match;
            return Date.UTC(Number(year), Number(month) - 1, Number(day));
        }

        match = normalized.match(/^(\d{2})\.(\d{4})$/);
        if (match) {
            const [, month, year] = match;
            return Date.UTC(Number(year), Number(month) - 1, 1);
        }

        match = normalized.match(/^(\d{4})$/);
        if (match) {
            const [, year] = match;
            return Date.UTC(Number(year), 0, 1);
        }

        const fallback = Date.parse(normalized);
        return Number.isNaN(fallback) ? Number.NEGATIVE_INFINITY : fallback;
    }

    eleventyConfig.addNunjucksFilter("latestMixes", (items, limit = 5) => {
        if (!Array.isArray(items)) return [];

        return [...items]
            .sort((a, b) => parseMixDate(b?.date) - parseMixDate(a?.date))
            .slice(0, limit);
    });

    eleventyConfig.addNunjucksFilter("groupSlug", (value) => {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    });

    // Date filter
    eleventyConfig.addFilter("blogDate", (dateObj) =>
        new Intl.DateTimeFormat("pl-PL", { year:"numeric", month:"long", day:"2-digit" }).format(dateObj)
    );

    // Include md into njk
    const fs = require("fs");
    const path = require("path");
    const markdownIt = require("markdown-it");
    const mdLinkAttrs = require("markdown-it-link-attributes");

    const md = markdownIt({ html: true, linkify: true })
        .use(mdLinkAttrs, [
                {
                    matcher: (href) => /\.zip(?:[#?].*)?$/i.test(href),
                    attrs: { class: "is-zip", rel: "noopener" }
                },
                {
                    matcher: (href) => /\.pdf(?:[#?].*)?$/i.test(href),
                    attrs: { class: "is-pdf", target: "_blank", rel: "noopener" }
                },
                {
                    matcher: (href) => /^https?:\/\//i.test(href),
                    attrs: { target: "_blank", rel: "noopener" }
                }
            ]
        );
    eleventyConfig.setLibrary('md', md)

    eleventyConfig.addShortcode('importMd', file => {
        const fs = require('fs'), path = require('path')
        const fullPath = path.join('src', file)
        const content = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : ''
        return md.render(content)
    })

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
