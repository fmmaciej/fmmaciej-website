module.exports = {
    eleventyComputed: {
        permalink: (data) => (data.draft ? false : data.permalink),
        pageStyles: (data) => {
            const styles = Array.isArray(data.pageStyles) ? data.pageStyles.slice() : [];
            const blogStyles = "/assets/css/sections/blog.css";

            if (!styles.includes(blogStyles)) {
                styles.push(blogStyles);
            }

            return styles;
        }
    }
};
