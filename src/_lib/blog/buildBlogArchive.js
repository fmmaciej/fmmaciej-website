function buildBlogArchive(posts = []) {
    const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });
    const years = new Map();

    posts.forEach((post) => {
        const date = post.date;
        const year = String(date.getFullYear());
        const monthNumber = date.getMonth() + 1;
        const monthKey = `${year}-${String(monthNumber).padStart(2, "0")}`;

        if (!years.has(year)) {
            years.set(year, {
                name: year,
                slug: `y-${year}`,
                year: Number(year),
                count: 0,
                months: []
            });
        }

        const yearGroup = years.get(year);
        let monthGroup = yearGroup.months.find((month) => month.key === monthKey);
        if (!monthGroup) {
            monthGroup = {
                key: monthKey,
                name: monthFormatter.format(date),
                slug: `m-${monthKey}`,
                month: monthNumber,
                count: 0,
                items: []
            };
            yearGroup.months.push(monthGroup);
        }

        monthGroup.items.push({
            title: post.data.title,
            url: post.url,
            date,
            description: post.data.description || "",
            tags: post.data.tags || []
        });
        monthGroup.count += 1;
        yearGroup.count += 1;
    });

    return Array.from(years.values())
        .sort((a, b) => b.year - a.year)
        .map((yearGroup) => ({
            ...yearGroup,
            months: yearGroup.months.sort((a, b) => b.month - a.month)
        }));
}

module.exports = buildBlogArchive;
