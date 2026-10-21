/* ============================================================
   М'ЯТА & ЕСПРЕСО — спільні скрипти
   Тут: теми, меню, модальне вікно, каталог, FAQ, форма, анімації.
   Підключається на всіх сторінках.
   ============================================================ */

(function () {
  "use strict";

  const doc = document;
  const root = doc.documentElement;
  const $ = (selector, context = doc) => context.querySelector(selector);
  const $$ = (selector, context = doc) => Array.from(context.querySelectorAll(selector));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasDB = typeof recipesDB !== "undefined" && Array.isArray(recipesDB);
  const THEME_KEY = "mx-theme";

  const CATEGORY_NAMES = {
    soup: "Перші страви",
    main: "Основні страви",
    salad: "Салати",
    breakfast: "Сніданки",
    dessert: "Десерти",
    bakery: "Випічка",
    drink: "Напої",
  };

  /* ----------------------------------------------------------
     Дрібні помічники
     ---------------------------------------------------------- */
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[char];
    });
  }

  function normalize(value) {
    return String(value ?? "")
      .toLocaleLowerCase("uk")
      .replace(/[’ʼ`]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function plural(n, one, few, many) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }

  function recipesLabel(n) {
    return `${n} ${plural(n, "рецепт", "рецепти", "рецептів")}`;
  }

  // Простий «людський» пошук: курка знайде «куряче філе», яйця — «яєчні жовтки».
  const SEARCH_SYNONYMS = {
    курка: ["кур", "куряч"],
    курку: ["кур", "куряч"],
    яйця: ["яйц", "яєч"],
    яйце: ["яйц", "яєч"],
    мясо: ["м'яс", "мяс"],
    "м'ясо": ["м'яс", "мяс"],
  };

  function matchesSearch(text, query) {
    const haystack = normalize(text);
    const needle = normalize(query);
    if (!needle) return true;
    if (haystack.includes(needle)) return true;

    const words = needle.split(" ").filter(Boolean);
    if (!words.length) return true;

    const haystackWords = haystack.split(/[^a-zа-яіїєґ0-9']+/u).filter(Boolean);

    return words.every((word) => {
      const stems = new Set([word]);
      const synonyms = SEARCH_SYNONYMS[word] || [];
      synonyms.forEach((stem) => stems.add(stem));
      if (word.length >= 4) stems.add(word.slice(0, -1));
      if (word.length >= 5) stems.add(word.slice(0, -2));
      return Array.from(stems).some(
        (stem) => stem.length >= 3 && haystackWords.some((hayWord) => hayWord.startsWith(stem))
      );
    });
  }

  function recipeHaystack(recipe) {
    return normalize(
      [
        recipe.title,
        recipe.description,
        categoryName(recipe),
        recipe.chefTip || "",
        ...(Array.isArray(recipe.ingredients) ? recipe.ingredients : []),
      ].join(" ")
    );
  }

  function minutesFromTime(time) {
    const match = String(time ?? "").match(/\d+/);
    return match ? Number(match[0]) : 999;
  }

  function thumbFor(imagePath) {
    return String(imagePath ?? "")
      .replace(/^images\//, "images/thumbs/")
      .replace(/\.(jpe?g|png)$/i, ".webp");
  }

  function largeFor(imagePath) {
    return String(imagePath ?? "")
      .replace(/^images\//, "images/large/")
      .replace(/\.(jpe?g|png)$/i, ".webp");
  }

  function categoryName(recipe) {
    return recipe.categoryName || CATEGORY_NAMES[recipe.category] || "Рецепт";
  }

  function icon(name, extraClass = "") {
    return `<svg class="ico ${extraClass}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function imageFallback(recipe) {
    return `onerror="this.onerror=null;this.src='${escapeHtml(recipe.image)}'"`;
  }

  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /* ----------------------------------------------------------
     Тема: світла / нічна
     ---------------------------------------------------------- */
  const themeButton = $("#theme-toggle");

  function setTheme(theme, persist = true) {
    const isDark = theme === "dark";
    root.dataset.theme = isDark ? "dark" : "light";

    if (themeButton) {
      themeButton.setAttribute("aria-pressed", String(isDark));
      themeButton.setAttribute("aria-label", isDark ? "Увімкнути світлу тему" : "Увімкнути нічну тему");
      themeButton.setAttribute("title", isDark ? "Світла тема" : "Нічна тема");
    }

    const metaTheme = $('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", isDark ? "#15110d" : "#f6efdf");

    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
      } catch (error) {
        /* localStorage може бути вимкнений — сайт усе одно працює */
      }
    }
  }

  setTheme(root.dataset.theme === "dark" ? "dark" : "light", false);

  if (themeButton) {
    themeButton.addEventListener("click", () => {
      setTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });
  }

  /* ----------------------------------------------------------
     Скрол: тінь шапки, прогрес, кнопка «вгору»
     ---------------------------------------------------------- */
  const header = $(".site-header");
  const progressBar = $("#scroll-progress");
  const toTopButton = $("#to-top");
  let scrollTicking = false;

  function updateScrollUI() {
    const y = window.scrollY || root.scrollTop;
    const scrollable = root.scrollHeight - window.innerHeight;

    header?.classList.toggle("is-scrolled", y > 16);

    if (progressBar) {
      const percent = scrollable > 0 ? Math.min(100, (y / scrollable) * 100) : 0;
      progressBar.style.width = `${percent}%`;
    }

    toTopButton?.classList.toggle("is-visible", y > 650);
    scrollTicking = false;
  }

  function requestScrollUpdate() {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(updateScrollUI);
  }

  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate);
  updateScrollUI();

  toTopButton?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  /* ----------------------------------------------------------
     Мобільне меню
     ---------------------------------------------------------- */
  const menuButton = $("#menu-toggle");
  const nav = $("#site-nav");

  function closeNav() {
    if (!header?.classList.contains("nav-open")) return;
    header.classList.remove("nav-open");
    doc.body.classList.remove("nav-open");
    menuButton?.setAttribute("aria-expanded", "false");
    menuButton?.setAttribute("aria-label", "Відкрити меню");
  }

  menuButton?.addEventListener("click", () => {
    const isOpen = header?.classList.toggle("nav-open");
    doc.body.classList.toggle("nav-open", Boolean(isOpen));
    menuButton.setAttribute("aria-expanded", String(Boolean(isOpen)));
    menuButton.setAttribute("aria-label", isOpen ? "Закрити меню" : "Відкрити меню");
  });

  nav?.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeNav();
  });

  doc.addEventListener("click", (event) => {
    if (!header?.classList.contains("nav-open")) return;
    if (!event.target.closest(".nav-wrap")) closeNav();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1020) closeNav();
  });

  /* ----------------------------------------------------------
     Поява блоків під час скролу
     ---------------------------------------------------------- */
  const revealItems = $$(".reveal");

  if (revealItems.length) {
    if ("IntersectionObserver" in window && !reduceMotion) {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -32px" }
      );

      revealItems.forEach((item) => revealObserver.observe(item));
    } else {
      revealItems.forEach((item) => item.classList.add("is-visible"));
    }
  }

  /* ----------------------------------------------------------
     Тост-повідомлення
     ---------------------------------------------------------- */
  function toast(message) {
    let stack = $("#toast-stack");
    if (!stack) {
      stack = doc.createElement("div");
      stack.id = "toast-stack";
      stack.className = "toast-stack";
      stack.setAttribute("aria-live", "polite");
      doc.body.appendChild(stack);
    }

    const node = doc.createElement("div");
    node.className = "toast";
    node.textContent = message;
    stack.appendChild(node);

    window.setTimeout(() => {
      node.classList.add("is-leaving");
      window.setTimeout(() => node.remove(), 260);
    }, 3400);
  }

  /* ----------------------------------------------------------
     Картка рецепта (використовується на всіх сторінках)
     ---------------------------------------------------------- */
  function recipeCard(recipe, index = 0, options = {}) {
    const number = String(index + 1).padStart(2, "0");
    const classes = ["recipe-card"];
    if (options.animate) classes.push("catalog-card-enter");

    const description = options.description
      ? `<p class="recipe-card-desc">${escapeHtml(recipe.description || "")}</p>`
      : "";

    return `
      <article class="${classes.join(" ")}" style="--i:${index}">
        <a class="recipe-card-media" href="recipes.html?recipe=${encodeURIComponent(recipe.id)}" data-open-recipe="${escapeHtml(recipe.id)}" aria-label="Відкрити рецепт: ${escapeHtml(recipe.title)}">
          <img src="${escapeHtml(thumbFor(recipe.image))}" alt="${escapeHtml(recipe.title)}" loading="lazy" decoding="async" width="720" height="900" ${imageFallback(recipe)}>
          <span class="recipe-card-index">${number}</span>
          <span class="recipe-card-time">${icon("clock")} ${escapeHtml(recipe.time)}</span>
          <span class="recipe-card-open">${icon("arrow")}</span>
        </a>
        <div class="recipe-card-body">
          <p class="recipe-card-cat">${escapeHtml(categoryName(recipe))}</p>
          <h3 class="recipe-card-title">
            <a href="recipes.html?recipe=${encodeURIComponent(recipe.id)}" data-open-recipe="${escapeHtml(recipe.id)}">${escapeHtml(recipe.title)}</a>
          </h3>
          <div class="recipe-card-meta">
            <span>${escapeHtml(recipe.difficulty || "Легка")}</span>
            <i class="dot" aria-hidden="true"></i>
            <span>${escapeHtml(recipe.calories || "—")}</span>
            <i class="dot" aria-hidden="true"></i>
            <span>${escapeHtml(recipe.servings || "")}</span>
          </div>
          ${description}
        </div>
      </article>
    `;
  }

  /* ----------------------------------------------------------
     Модальне вікно з рецептом
     ---------------------------------------------------------- */
  const modal = $("#recipe-modal");
  const modalBody = $("#modal-body");
  let lastFocusedElement = null;
  let currentRecipeId = null;

  function findRecipe(id) {
    if (!hasDB) return null;
    return recipesDB.find((recipe) => String(recipe.id) === String(id)) || null;
  }

  function recipeModalMarkup(recipe) {
    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const steps = Array.isArray(recipe.steps) ? recipe.steps : [];

    return `
      <div class="modal-recipe">
        <div class="modal-media">
          <img src="${escapeHtml(largeFor(recipe.image))}" alt="${escapeHtml(recipe.title)}" ${imageFallback(recipe)}>
          <span class="modal-media-num">Рецепт №${String(recipe.id).padStart(2, "0")}</span>
          <span class="modal-media-tag">${icon("spark")} ${escapeHtml(categoryName(recipe))}</span>
        </div>

        <div class="modal-content">
          <p class="modal-kicker">М'ята &amp; Еспресо · перевірено на кухні</p>
          <h2 class="modal-title" id="modal-recipe-title">${escapeHtml(recipe.title)}</h2>
          <p class="modal-desc">${escapeHtml(recipe.description || "")}</p>

          <div class="modal-meta">
            <span>${icon("clock")} ${escapeHtml(recipe.time)}</span>
            <span>${icon("chart")} ${escapeHtml(recipe.difficulty || "Легка")}</span>
            <span>${icon("flame")} ${escapeHtml(recipe.calories || "—")}</span>
            <span>${icon("leaf")} ${escapeHtml(recipe.servings || "—")}</span>
          </div>

          <section class="modal-section" aria-labelledby="modal-ingredients-title">
            <div class="modal-section-head">
              <h3 id="modal-ingredients-title">Інгредієнти</h3>
              <span>${ingredients.length} ${plural(ingredients.length, "позиція", "позиції", "позицій")}</span>
            </div>
            <div class="ingredient-list">
              ${ingredients
                .map(
                  (ingredient) => `
                <label class="ingredient">
                  <input type="checkbox">
                  <span>${escapeHtml(ingredient)}</span>
                </label>
              `
                )
                .join("")}
            </div>
          </section>

          <section class="modal-section" aria-labelledby="modal-steps-title">
            <div class="modal-section-head">
              <h3 id="modal-steps-title">Як готувати</h3>
              <span>${steps.length} ${plural(steps.length, "крок", "кроки", "кроків")}</span>
            </div>
            <ol class="step-list">
              ${steps
                .map(
                  (step, index) => `
                <li class="step">
                  <span class="step-num" aria-hidden="true">${index + 1}</span>
                  <p>${escapeHtml(step)}</p>
                </li>
              `
                )
                .join("")}
            </ol>
          </section>

          ${
            recipe.chefTip
              ? `
            <div class="chef-tip">
              <span class="chef-tip-icon">${icon("spark")}</span>
              <div>
                <strong>Порада від шефа</strong>
                <p>${escapeHtml(recipe.chefTip)}</p>
              </div>
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;
  }

  function openRecipe(id) {
    if (!modal || !modalBody) return;
    const recipe = findRecipe(id);
    if (!recipe) return;

    closeNav();
    lastFocusedElement = doc.activeElement;
    currentRecipeId = recipe.id;
    modalBody.innerHTML = recipeModalMarkup(recipe);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    doc.body.classList.add("modal-open");

    const content = $(".modal-content", modal);
    if (content) content.scrollTop = 0;

    window.requestAnimationFrame(() => {
      $("#modal-close")?.focus({ preventScroll: true });
    });
  }

  function closeModal() {
    if (!modal || !modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    doc.body.classList.remove("modal-open");

    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus({ preventScroll: true });
    }
  }

  function randomRecipeId(excludeId) {
    if (!hasDB) return null;
    const pool = recipesDB.filter((recipe) => String(recipe.id) !== String(excludeId));
    const source = pool.length ? pool : recipesDB;
    return source[Math.floor(Math.random() * source.length)].id;
  }

  // Відкриття/закриття через делегування — працює і для карток, доданих пізніше.
  doc.addEventListener("click", (event) => {
    const closeTrigger = event.target.closest("[data-close-modal]");
    if (closeTrigger) {
      event.preventDefault();
      closeModal();
      return;
    }

    const opener = event.target.closest("[data-open-recipe]");
    if (opener) {
      event.preventDefault();
      openRecipe(opener.dataset.openRecipe);
      return;
    }

    const randomTrigger = event.target.closest("[data-random-recipe]");
    if (randomTrigger) {
      event.preventDefault();
      if (hasDB) {
        openRecipe(randomRecipeId(currentRecipeId));
      } else {
        window.location.href = "recipes.html";
      }
    }
  });

  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNav();
      if (modal?.classList.contains("is-open")) closeModal();
    }

    if (event.key !== "Tab" || !modal?.classList.contains("is-open")) return;

    const focusable = $$(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      modal
    ).filter((element) => element.getClientRects().length > 0);

    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // Підсвічуємо зірочку в модалці при відкритті
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.classList.contains("modal-backdrop")) {
        closeModal();
      }
    });

    // Колесо мишки над фото теж гортає рецепт, а не «застрягає».
    modal.addEventListener(
      "wheel",
      (event) => {
        if (!event.target.closest(".modal-media")) return;
        const content = $(".modal-content", modal);
        if (!content) return;

        const before = content.scrollTop;
        content.scrollTop += event.deltaY;
        if (content.scrollTop !== before) event.preventDefault();
      },
      { passive: false }
    );
  }

  /* ----------------------------------------------------------
     Каталог рецептів (recipes.html)
     ---------------------------------------------------------- */
  const catalogGrid = $("#catalog-grid");

  if (catalogGrid && hasDB) {
    const searchInput = $("#catalog-search");
    const clearButton = $("#catalog-clear");
    const sortSelect = $("#catalog-sort");
    const countElement = $("#catalog-count");
    const hintElement = $("#catalog-hint");
    const moreButton = $("#catalog-more");
    const moreLabel = $("#catalog-more-label");
    const moreCount = $("#catalog-more-count");
    const filterRow = $("#filter-row");
    const state = {
      query: "",
      category: "all",
      sort: "popular",
      limit: 12,
    };

    const params = new URLSearchParams(window.location.search);
    state.query = params.get("q") || "";
    state.category = params.get("category") || "all";

    const knownCategories = Object.keys(CATEGORY_NAMES);
    if (state.category !== "all" && !knownCategories.includes(state.category)) {
      state.category = "all";
    }

    if (searchInput) searchInput.value = state.query;

    function syncCategoryButtons() {
      $$(".filter-btn", filterRow || doc).forEach((button) => {
        const active = button.dataset.category === state.category;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }

    function filteredRecipes() {
      const query = normalize(state.query);

      let items = recipesDB.filter((recipe) => {
        if (state.category !== "all" && recipe.category !== state.category) return false;
        if (!query) return true;
        return matchesSearch(recipeHaystack(recipe), query);
      });

      if (state.sort === "time-asc") {
        items = items.slice().sort((a, b) => minutesFromTime(a.time) - minutesFromTime(b.time));
      } else if (state.sort === "time-desc") {
        items = items.slice().sort((a, b) => minutesFromTime(b.time) - minutesFromTime(a.time));
      } else if (state.sort === "title") {
        items = items.slice().sort((a, b) => a.title.localeCompare(b.title, "uk"));
      }

      return items;
    }

    function emptyMarkup() {
      return `
        <div class="empty-state">
          <span class="empty-emoji" aria-hidden="true">🍽️</span>
          <h2>Нічого не знайшлося</h2>
          <p>Спробуйте інший інгредієнт або скиньте фільтри — у нас точно є щось смачне.</p>
          <button class="btn btn--dark btn--small" type="button" data-reset-catalog>Показати всі рецепти</button>
        </div>
      `;
    }

    function renderCatalog() {
      const allItems = filteredRecipes();
      const visibleItems = allItems.slice(0, state.limit);

      catalogGrid.innerHTML = visibleItems.length
        ? visibleItems.map((recipe, index) => recipeCard(recipe, index, { animate: true, description: true })).join("")
        : emptyMarkup();

      if (countElement) countElement.textContent = recipesLabel(allItems.length);
      if (clearButton) clearButton.hidden = !state.query;

      if (hintElement) {
        hintElement.textContent =
          allItems.length > visibleItems.length
            ? `Показано ${visibleItems.length} із ${allItems.length} · натисніть на картку, щоб відкрити рецепт`
            : `Усі ${allItems.length} ${plural(allItems.length, "рецепт", "рецепти", "рецептів")} · натисніть на картку, щоб відкрити`;
      }

      if (moreButton) {
        const remaining = allItems.length - visibleItems.length;
        moreButton.hidden = remaining <= 0;
        if (moreLabel) moreLabel.textContent = "Показати ще";
        if (moreCount) moreCount.textContent = remaining > 0 ? `+${Math.min(12, remaining)}` : "";
      }

      syncCategoryButtons();
    }

    function syncURL() {
      const nextParams = new URLSearchParams();
      if (state.query) nextParams.set("q", state.query);
      if (state.category !== "all") nextParams.set("category", state.category);

      const queryString = nextParams.toString();
      const nextURL = `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;

      try {
        window.history.replaceState(null, "", nextURL);
      } catch (error) {
        /* file:// може забороняти replaceState — не критично */
      }
    }

    const runSearch = debounce(() => {
      state.query = searchInput ? searchInput.value.trim() : "";
      state.limit = 12;
      renderCatalog();
      syncURL();
    }, 130);

    searchInput?.addEventListener("input", runSearch);

    searchInput?.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!searchInput.value) return;
      searchInput.value = "";
      state.query = "";
      state.limit = 12;
      renderCatalog();
      syncURL();
    });

    clearButton?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      state.query = "";
      state.limit = 12;
      renderCatalog();
      syncURL();
      searchInput?.focus();
    });

    filterRow?.addEventListener("click", (event) => {
      const button = event.target.closest(".filter-btn");
      if (!button) return;
      state.category = button.dataset.category || "all";
      state.limit = 12;
      renderCatalog();
      syncURL();
    });

    sortSelect?.addEventListener("change", () => {
      state.sort = sortSelect.value;
      state.limit = 12;
      renderCatalog();
    });

    moreButton?.addEventListener("click", () => {
      state.limit += 12;
      renderCatalog();
    });

    catalogGrid.addEventListener("click", (event) => {
      if (!event.target.closest("[data-reset-catalog]")) return;
      if (searchInput) searchInput.value = "";
      state.query = "";
      state.category = "all";
      state.limit = 12;
      if (sortSelect) {
        state.sort = "popular";
        sortSelect.value = "popular";
      }
      renderCatalog();
      syncURL();
    });

    renderCatalog();

    const requestedRecipe = params.get("recipe");
    if (requestedRecipe) {
      window.setTimeout(() => openRecipe(requestedRecipe), 160);
    }
  }

  /* ----------------------------------------------------------
     FAQ та форма на сторінці порад
     ---------------------------------------------------------- */
  const faqItems = $$(".faq-item");

  faqItems.forEach((item) => {
    const button = $(".faq-question", item);
    const answer = $(".faq-answer", item);

    answer?.setAttribute("aria-hidden", item.classList.contains("is-open") ? "false" : "true");
    button?.setAttribute("aria-expanded", String(item.classList.contains("is-open")));

    button?.addEventListener("click", () => {
      const willOpen = !item.classList.contains("is-open");

      faqItems.forEach((other) => {
        other.classList.remove("is-open");
        const otherButton = $(".faq-question", other);
        const otherAnswer = $(".faq-answer", other);
        otherButton?.setAttribute("aria-expanded", "false");
        otherAnswer?.setAttribute("aria-hidden", "true");
      });

      if (willOpen) {
        item.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
        answer?.setAttribute("aria-hidden", "false");
      }
    });
  });

  const feedbackForm = $("#feedback-form");

  feedbackForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!feedbackForm.checkValidity()) {
      feedbackForm.reportValidity();
      return;
    }

    const nameField = $("#name");
    const note = $("#feedback-note");
    const name = nameField ? nameField.value.trim() : "";

    if (note) {
      note.textContent = `Дякуємо${name ? `, ${name}` : ""}! Запитання збережено — шеф уже заглядає у ваш лист.`;
      note.classList.remove("is-error");
      note.classList.add("is-success");
    }

    toast("Дякуємо! Ваше запитання прийнято.");
    feedbackForm.reset();

    window.setTimeout(() => {
      note?.classList.remove("is-success");
      if (note) note.textContent = "";
    }, 8000);
  });

  /* ----------------------------------------------------------
     Рік у підвалі
     ---------------------------------------------------------- */
  $$("[data-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  /* ----------------------------------------------------------
     Публічне API для home.js
     ---------------------------------------------------------- */
  window.MX = {
    $,
    $$,
    icon,
    escapeHtml,
    normalize,
    plural,
    minutesFromTime,
    thumbFor,
    largeFor,
    categoryName,
    imageFallback,
    recipeCard,
    openRecipe,
    closeModal,
    toast,
    reduceMotion,
    hasDB,
    recipesDB: hasDB ? recipesDB : [],
    matchesSearch,
    recipeHaystack,
  };
})();
