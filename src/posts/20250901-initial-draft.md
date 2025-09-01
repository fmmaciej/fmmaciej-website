---
title: Hello Eleventy
description: Pierwszy wpis testowy.
date: 2025-08-29
tags: [devlog, eleventy]
layout: post.njk
permalink: "blog/{{ page.fileSlug }}/"   # /blog/hello-eleventy/
draft: true
---

Tu treść wpisu w **Markdown**. Możesz wstawiać kod:

```bash
lftp -u user,pass ftp.clusterXXX.hosting.ovh.net -e "mirror -R ./www www; quit"