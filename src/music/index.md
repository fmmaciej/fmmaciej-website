---
title: FM — /music
layout: layout.njk
terminalFile: /assets/terminal/music.txt
---

<h3>
    <a href="/music/">/music</a>
</h2>

<style>
    .music-list {
        list-style: none;
        padding: 0;
        margin: 20px 0;
        font-family: ui-monospace, monospace;
    }

    .music-list li {
        display: flex;
        gap: 16px;
    }

    .music-list a {
        color: var(--link);
        text-decoration: none;
    }

    .music-list a:hover {
        text-decoration: underline;
    }

    .music-list .comment {
        color: var(--muted);
        flex: 1;
    }

    .booking {
        margin-top: 24px;
        font-size: 15px;
    }

    .booking-link {
        color: var(--link);
        font-weight: 500;
        text-decoration: none;
        border-bottom: 1px dotted var(--muted);
        transition: color 0.2s, border-color 0.2s;
    }

    .booking-link:hover {
        color: var(--link-hover);
        border-bottom-color: var(--link-hover);
    }
</style>

Two things that really drew me to vinyl were the expense and the inconvenience.  
All mixes and gigs are archived here.  

<p class="booking">
  → Booking / inquiries: <a href="mailto:fm@fmmaciej.com" class="booking-link">fm@fmmaciej.com</a>
</p>

<ul class="music-list">
  <li><a href="/music/bio/">/bio</a>    <span class="comment"># a few words about me as a DJ</span></li>
  <li><a href="/music/rider/">/rider</a> <span class="comment"># basic technical requirements</span></li>
  <li><a href="/music/mixes/">/mixes</a> <span class="comment"># my sets to listen online</span></li>
  <li><a href="/music/gigs/">/gigs</a>   <span class="comment"># archive of parties and posters</span></li>
</ul>