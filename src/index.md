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
    <strong>MATHesis</strong> is an exploratory digital tool for mapping how numbers and mathematical operations were symbolically expressed and organized in Chinese and Sanskrit contexts. Using a node-based model anchored to specific textual passages, it allows users to explore numerical and symbolic expressions across texts and traditions.
  </p>
</section>

<p style="text-align: center; margin-top: 2rem;">
  <a href="{{ '/search/' | url }}" class="cta-button">Start Exploring</a>
</p>


<!-- 原来的 search filter 等照常写 -->
