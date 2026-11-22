/*
 * assets/js/main.js
 * Script de la page veille.html — "La MFA et ses contournements".
 * JavaScript natif, sans dépendance. Ce fichier ne fait rien sur les
 * autres pages du portfolio : il n'est chargé que par veille.html et
 * tous ses sélecteurs sont scopés à l'intérieur de #mfa-wrap.
 */
(function () {
  "use strict";

  // Rien à faire si on n'est pas sur la page de veille.
  var root = document.getElementById("mfa-wrap");
  if (!root) return;

  /* ============================================================
     1. THÈME CLAIR / SOMBRE (persisté dans localStorage)
     ============================================================ */
  (function initTheme() {
    var STORAGE_KEY = "mfa-theme";
    var toggleBtn = document.getElementById("mfa-theme-toggle");
    var saved = null;

    // localStorage peut être indisponible (navigation privée stricte,
    // politique d'entreprise...) : on protège chaque accès.
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      saved = null;
    }

    function applyTheme(theme) {
      root.setAttribute("data-mfa-theme", theme);
      if (toggleBtn) {
        toggleBtn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
        toggleBtn.querySelector(".mfa-theme-label").textContent =
          theme === "light" ? "Thème sombre" : "Thème clair";
      }
    }

    applyTheme(saved === "light" ? "light" : "dark");

    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        var current = root.getAttribute("data-mfa-theme") === "light" ? "light" : "dark";
        var next = current === "light" ? "dark" : "light";
        applyTheme(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch (e) {
          /* on ignore : le choix ne sera simplement pas mémorisé */
        }
      });
    }
  })();

  /* ============================================================
     2. BOUTON IMPRIMER / PDF
     ============================================================ */
  (function initPrint() {
    var printBtn = document.getElementById("mfa-print-btn");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        window.print();
      });
    }
  })();

  /* ============================================================
     3. ANIMATION D'APPARITION AU SCROLL (fade-in léger)
     ============================================================ */
  (function initFadeIn() {
    var items = root.querySelectorAll(".mfa-fade");
    if (!("IntersectionObserver" in window) || !items.length) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    items.forEach(function (el) { observer.observe(el); });
  })();

  /* ============================================================
     4. SOMMAIRE STICKY : décalage + surlignage de la section active
     ============================================================ */
  (function initToc() {
    var toc = root.querySelector(".mfa-toc");
    var header = document.querySelector("header");
    if (toc && header) {
      // Le header du portfolio est lui-même sticky en haut de page :
      // on cale le sommaire juste sous lui, quelle que soit sa hauteur réelle.
      var setOffset = function () {
        toc.style.top = header.offsetHeight + "px";
      };
      setOffset();
      window.addEventListener("resize", setOffset);
    }

    var links = Array.prototype.slice.call(root.querySelectorAll(".mfa-toc a"));
    var sections = links
      .map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); })
      .filter(Boolean);

    if (!sections.length || !("IntersectionObserver" in window)) return;

    var linkFor = {};
    links.forEach(function (a) { linkFor[a.getAttribute("href").slice(1)] = a; });

    var current = null;
    var setActive = function (id) {
      if (current === id) return;
      current = id;
      links.forEach(function (a) { a.classList.remove("is-active"); });
      if (linkFor[id]) linkFor[id].classList.add("is-active");
    };

    var observer = new IntersectionObserver(
      function (entries) {
        // On choisit la section la plus proche du haut de la zone visible.
        var visible = entries.filter(function (e) { return e.isIntersecting; });
        if (visible.length) {
          visible.sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    sections.forEach(function (s) { observer.observe(s); });
  })();

  /* ============================================================
     5. COMPTEURS ANIMÉS (bandeau de chiffres clés)
     ============================================================ */
  (function initCounters() {
    var nums = root.querySelectorAll(".mfa-stat-num");
    if (!nums.length) return;

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function format(el, value) {
      var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var prefix = el.getAttribute("data-prefix") || "";
      var suffix = el.getAttribute("data-suffix") || "";
      var text = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
      el.textContent = prefix + text.replace(".", ",") + suffix;
    }

    function animate(el) {
      var target = parseFloat(el.getAttribute("data-target") || "0");
      if (reduceMotion) {
        format(el, target);
        return;
      }
      var duration = 1200;
      var start = null;
      function step(timestamp) {
        if (start === null) start = timestamp;
        var progress = Math.min((timestamp - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        format(el, target * eased);
        if (progress < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) {
      nums.forEach(animate);
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animate(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    nums.forEach(function (el) { observer.observe(el); });
  })();

  /* ============================================================
     6. CHARGEMENT DES DONNÉES DE VEILLE (frise + sources)
        fetch('data/veille.json') -> si indisponible (ex: ouverture
        en file:// où fetch est bloqué sur les fichiers locaux),
        on retombe sur window.VEILLE_DATA chargé par data/veille-data.js.
     ============================================================ */
  function loadVeilleData() {
    return fetch("data/veille.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .catch(function () {
        if (window.VEILLE_DATA) return window.VEILLE_DATA;
        throw new Error("Aucune donnée de veille disponible (ni fetch, ni fallback).");
      });
  }

  var TECHNIQUE_LABELS = {
    "mfa-fatigue": "MFA fatigue",
    "sim-swapping": "SIM swapping",
    cookies: "Vol de cookies",
    helpdesk: "Attaque du help desk",
    protection: "Protection"
  };

  function formatLastUpdated(iso) {
    try {
      var d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    } catch (e) {
      return iso;
    }
  }

  function renderTimeline(data) {
    var list = document.getElementById("mfa-timeline");
    if (!list) return;
    list.innerHTML = "";

    data.articles.forEach(function (article) {
      var li = document.createElement("li");
      li.setAttribute("data-technique", article.technique);

      var card = document.createElement("div");
      card.className = "mfa-tl-card";

      var head = document.createElement("div");
      head.className = "mfa-tl-head";

      var date = document.createElement("span");
      date.className = "mfa-tl-date";
      date.textContent = article.date;
      head.appendChild(date);

      var tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = article.techniqueLabel || TECHNIQUE_LABELS[article.technique] || article.technique;
      head.appendChild(tag);

      card.appendChild(head);

      var title = document.createElement("h3");
      title.className = "mfa-tl-title";
      title.textContent = article.title;
      card.appendChild(title);

      var summary = document.createElement("p");
      summary.className = "mfa-tl-summary";
      summary.textContent = article.summary;
      card.appendChild(summary);

      if (article.links && article.links.length) {
        var linksWrap = document.createElement("div");
        linksWrap.className = "mfa-tl-links";
        article.links.forEach(function (link) {
          var a = document.createElement("a");
          a.href = link.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = link.label + " ↗";
          linksWrap.appendChild(a);
        });
        card.appendChild(linksWrap);
      }

      li.appendChild(card);
      list.appendChild(li);
    });
  }

  function initTimelineFilters() {
    var buttons = Array.prototype.slice.call(root.querySelectorAll(".mfa-filter-btn"));
    if (!buttons.length) return;
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var filter = btn.getAttribute("data-filter");
        buttons.forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        var items = root.querySelectorAll("#mfa-timeline li");
        items.forEach(function (li) {
          var match = filter === "all" || li.getAttribute("data-technique") === filter;
          if (match) li.removeAttribute("hidden");
          else li.setAttribute("hidden", "");
        });
      });
    });
  }

  function formatShortDate(iso) {
    var m = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    var p = String(iso).split("-");
    if (p.length !== 3) return iso;
    return parseInt(p[2], 10) + " " + m[parseInt(p[1], 10) - 1] + " " + p[0];
  }

  function renderSources(data) {
    var list = document.getElementById("mfa-sources-list");
    if (!list) return;
    list.innerHTML = "";

    var seen = {};
    var all = [];

    (data.institutionalSources || []).forEach(function (src) {
      if (!seen[src.url]) { seen[src.url] = true; all.push(src); }
    });
    data.articles.forEach(function (article) {
      (article.links || []).forEach(function (link) {
        if (!seen[link.url]) {
          seen[link.url] = true;
          all.push({ label: link.label + " — " + article.title, url: link.url, published: link.published, dateKind: link.dateKind });
        }
      });
    });

    all.forEach(function (src) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = src.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = src.label;
      li.appendChild(a);
      var parts = [];
      if (src.published) parts.push((src.dateKind || "publié") + " le " + formatShortDate(src.published));
      if (data.consulted) parts.push("consulté le " + formatShortDate(data.consulted));
      if (parts.length) {
        var span = document.createElement("span");
        span.className = "mfa-src-date";
        span.textContent = " — " + parts.join(" · ");
        li.appendChild(span);
      }
      list.appendChild(li);
    });
  }

  function initVeilleData() {
    var lastUpdatedEl = document.getElementById("mfa-last-updated");
    loadVeilleData()
      .then(function (data) {
        if (lastUpdatedEl && data.lastUpdated) {
          lastUpdatedEl.setAttribute("datetime", data.lastUpdated);
          lastUpdatedEl.textContent = formatLastUpdated(data.lastUpdated);
        }
        renderTimeline(data);
        initTimelineFilters();
        renderSources(data);
      })
      .catch(function (err) {
        var list = document.getElementById("mfa-timeline");
        if (list) {
          list.innerHTML =
            '<li><div class="mfa-tl-card"><p class="mfa-tl-summary">Impossible de charger les données de veille pour le moment. Consultez la section Sources ci-dessous.</p></div></li>';
        }
        // eslint-disable-next-line no-console
        console.error("[veille] chargement des données impossible :", err);
      });
  }

  initVeilleData();
})();
