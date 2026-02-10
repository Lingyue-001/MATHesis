---
layout: base
title: Home
---

{% if page.url == "/" %}
  <script>
    document.addEventListener("DOMContentLoaded", () => {
      const toggle = document.getElementById("homeMenuToggle");
      const panel = document.getElementById("homeSideNav");
      const backdrop = document.getElementById("homeNavBackdrop");
      if (!toggle || !panel || !backdrop) return;

      const close = () => {
        panel.classList.remove("open");
        backdrop.classList.remove("open");
        backdrop.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "☰";
      };
      const open = () => {
        panel.classList.add("open");
        backdrop.hidden = false;
        requestAnimationFrame(() => backdrop.classList.add("open"));
        toggle.setAttribute("aria-expanded", "true");
        toggle.textContent = "×";
      };

      toggle.addEventListener("click", () => panel.classList.contains("open") ? close() : open());
      backdrop.addEventListener("click", close);
      panel.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });
    });
  </script>
  <button id="homeMenuToggle" class="home-menu-toggle" type="button" aria-label="Open navigation"
    aria-controls="homeSideNav" aria-expanded="false">☰</button>
  <div id="homeNavBackdrop" class="home-nav-backdrop" hidden></div>
  <nav id="homeSideNav" class="home-side-nav" aria-label="Primary">
    <a href="{{ '/' | url }}">Home</a>
    <a href="{{ '/search/' | url }}">Search</a>
    <a href="{{ '/transcriptions/' | url }}">Transcriptions</a>
    <a href="{{ '/visualization/' | url }}">Visualization</a>
    <a href="{{ '/map/' | url }}">Map</a>
    <a href="{{ '/about/' | url }}">About</a>
  </nav>
  <!-- Banner Hero -->
  <div class="hero">
    <h1>MATHesis</h1>
    <p>A Tool for Mapping Ancient Mathematical Expressions</p>
  </div>
{% endif %}

<section id="intro" class="intro-text">
  <p>
    <strong>MATHesis</strong> is a digital tool designed to explore how numbers and mathematical operations were symbolically expressed in ancient Indian and Chinese cultures. Drawing on sources such as Sanskrit word-numerals and Chinese divination systems, this tool allows you to search, compare, and visualize historical terms, meanings, and symbolic associations. It helps uncover hidden structures of knowledge and poetic logic behind premodern mathematical thought.
  </p>
</section>

<p style="text-align: center; margin-top: 2rem;">
  <a href="{{ '/search/' | url }}" class="cta-button">Start Exploring</a>
</p>


<!-- 原来的 search filter 等照常写 -->
