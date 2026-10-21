/* ============================================================
   ГОЛОВНА СТОРІНКА — інтерактив
   Hero-карусель, хіти, рулетка смаку, живий пошук, підписка.
   ============================================================ */

(function () {
  "use strict";

  const doc = document;
  const MX = window.MX;

  if (!MX || !doc.body.classList.contains("home")) return;

  const { $, $$, recipesDB, normalize, escapeHtml, plural, categoryName } = MX;
  const reduceMotion = MX.reduceMotion;

  /* ----------------------------------------------------------
     Курсор-світло (тільки для мишки)
     ---------------------------------------------------------- */
  const cursorGlow = $("#cursor-glow");

  if (cursorGlow && window.matchMedia("(pointer: fine)").matches && !reduceMotion) {
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let glowFrame = null;

    function animateGlow() {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      cursorGlow.style.transform = `translate3d(${currentX - 210}px, ${currentY - 210}px, 0)`;

      if (Math.abs(targetX - currentX) > 0.4 || Math.abs(targetY - currentY) > 0.4) {
        glowFrame = window.requestAnimationFrame(animateGlow);
      } else {
        glowFrame = null;
      }
    }

    doc.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType !== "mouse") return;
        targetX = event.clientX;
        targetY = event.clientY;
        cursorGlow.classList.add("is-on");
        if (!glowFrame) glowFrame = window.requestAnimationFrame(animateGlow);
      },
      { passive: true }
    );

    doc.addEventListener("mouseleave", () => {
      cursorGlow.classList.remove("is-on");
    });
  }

  /* ----------------------------------------------------------
     HERO: рецепти, що змінюються
     ---------------------------------------------------------- */
  const heroVisual = $("#hero-visual");

  if (heroVisual) {
    const frame = $("#hero-frame", heroVisual);
    const image = $("#hero-image", heroVisual);
    const category = $("#hero-category", heroVisual);
    const title = $("#hero-title", heroVisual);
    const meta = $("#hero-meta", heroVisual);
    const openButton = $("#hero-open", heroVisual);
    const nextButton = $("#hero-next", heroVisual);
    const nextImage = $("#hero-next-image", heroVisual);
    const nextTitle = $("#hero-next-title", heroVisual);
    const dots = $("#hero-dots", heroVisual);

    const heroIds = [1, 4, 27, 17, 7];
    const shortTitles = {
      1: "Борщ з пампушками",
      3: "Стейк Рібай",
      4: "Паста Карбонара",
      7: "Панкейки",
      17: "Запечена сьомга",
      27: "Тірамісу",
    };

    const heroRecipes = heroIds
      .map((id) => recipesDB.find((recipe) => recipe.id === id))
      .filter(Boolean);

    let heroIndex = 0;
    let heroTimer = null;
    let heroInView = true;

    if (heroRecipes.length && image && title) {
      heroRecipes.forEach((recipe) => {
        const preload = new Image();
        preload.src = MX.largeFor(recipe.image);
      });

      if (dots) {
        dots.innerHTML = heroRecipes
          .map(
            (recipe, index) => `
              <button class="hero-dot" type="button" data-hero-index="${index}" aria-label="Показати: ${escapeHtml(recipe.title)}"></button>
            `
          )
          .join("");
      }

      function heroMarkup(recipe) {
        image.src = MX.largeFor(recipe.image);
        image.alt = recipe.title;
        if (category) category.textContent = categoryName(recipe);
        title.textContent = shortTitles[recipe.id] || recipe.title;
        if (meta) {
          meta.innerHTML = `${escapeHtml(recipe.time)} <i class="dot"></i> ${escapeHtml(recipe.difficulty)}`;
        }
        if (openButton) {
          openButton.dataset.openRecipe = recipe.id;
          openButton.setAttribute("aria-label", `Відкрити рецепт: ${recipe.title}`);
        }
      }

      function setHero(index, animate = true) {
        const nextIndex = ((index % heroRecipes.length) + heroRecipes.length) % heroRecipes.length;

        const apply = () => {
          heroIndex = nextIndex;
          const recipe = heroRecipes[heroIndex];
          heroMarkup(recipe);

          const nextRecipe = heroRecipes[(heroIndex + 1) % heroRecipes.length];
          if (nextRecipe) {
            if (nextImage) {
              nextImage.src = MX.thumbFor(nextRecipe.image);
              nextImage.alt = nextRecipe.title;
            }
            if (nextTitle) nextTitle.textContent = shortTitles[nextRecipe.id] || nextRecipe.title;
          }

          if (dots) {
            $$(".hero-dot", dots).forEach((dot, dotIndex) => {
              const active = dotIndex === heroIndex;
              dot.classList.toggle("is-active", active);
              dot.setAttribute("aria-current", active ? "true" : "false");
            });
          }
        };

        if (animate && !reduceMotion && frame) {
          frame.classList.add("is-switching");
          window.setTimeout(() => {
            apply();
            window.requestAnimationFrame(() => frame.classList.remove("is-switching"));
          }, 180);
        } else {
          apply();
          frame?.classList.remove("is-switching");
        }
      }

      function stopHeroAuto() {
        if (heroTimer) {
          window.clearInterval(heroTimer);
          heroTimer = null;
        }
      }

      function startHeroAuto() {
        stopHeroAuto();
        if (reduceMotion || heroRecipes.length < 2) return;

        heroTimer = window.setInterval(() => {
          if (!heroInView || doc.hidden || doc.body.classList.contains("modal-open")) return;
          setHero(heroIndex + 1);
        }, 5200);
      }

      dots?.addEventListener("click", (event) => {
        const dot = event.target.closest("[data-hero-index]");
        if (!dot) return;
        setHero(Number(dot.dataset.heroIndex));
        startHeroAuto();
      });

      nextButton?.addEventListener("click", () => {
        setHero(heroIndex + 1);
        startHeroAuto();
      });

      heroVisual.addEventListener("mouseenter", stopHeroAuto);
      heroVisual.addEventListener("mouseleave", startHeroAuto);
      heroVisual.addEventListener("focusin", stopHeroAuto);
      heroVisual.addEventListener("focusout", (event) => {
        if (!heroVisual.contains(event.relatedTarget)) startHeroAuto();
      });

      if ("IntersectionObserver" in window) {
        const heroObserver = new IntersectionObserver(
          (entries) => {
            heroInView = entries[0].isIntersecting;
          },
          { threshold: 0.15 }
        );
        heroObserver.observe(heroVisual);
      }

      doc.addEventListener("visibilitychange", () => {
        if (doc.hidden) stopHeroAuto();
        else startHeroAuto();
      });

      setHero(0, false);
      startHeroAuto();

      /* Легкий паралакс від мишки */
      if (!reduceMotion) {
        heroVisual.addEventListener(
          "pointermove",
          (event) => {
            if (event.pointerType !== "mouse") return;
            const rect = heroVisual.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            heroVisual.style.setProperty("--px", x.toFixed(3));
            heroVisual.style.setProperty("--py", y.toFixed(3));
          },
          { passive: true }
        );

        heroVisual.addEventListener("pointerleave", () => {
          heroVisual.style.setProperty("--px", "0");
          heroVisual.style.setProperty("--py", "0");
        });
      }
    }
  }

  /* ----------------------------------------------------------
     ХІТИ: горизонтальна карусель
     ---------------------------------------------------------- */
  const hitsTrack = $("#hits-track");

  if (hitsTrack) {
    const hitIds = [1, 4, 27, 14, 7, 25, 17, 31, 35, 11];
    const hits = hitIds
      .map((id) => recipesDB.find((recipe) => recipe.id === id))
      .filter(Boolean);

    hitsTrack.innerHTML = hits.map((recipe, index) => MX.recipeCard(recipe, index)).join("");

    const prevButton = $("#hits-prev");
    const nextButton = $("#hits-next");
    const progress = $("#hits-progress");
    let autoTimer = null;
    let paused = false;
    let isInView = true;
    let suppressClick = false;

    function cardStep() {
      const card = $(".recipe-card", hitsTrack);
      if (!card) return 320;
      const styles = window.getComputedStyle(hitsTrack);
      const gap = parseFloat(styles.columnGap || styles.gap) || 20;
      return card.getBoundingClientRect().width + gap;
    }

    function updateCarousel() {
      const max = hitsTrack.scrollWidth - hitsTrack.clientWidth;
      const left = hitsTrack.scrollLeft;

      if (progress) {
        progress.style.width = `${max > 0 ? Math.min(100, (left / max) * 100) : 100}%`;
      }

      if (prevButton) prevButton.disabled = left <= 4;
      if (nextButton) nextButton.disabled = left >= max - 4;
    }

    function scrollHits(direction) {
      hitsTrack.scrollBy({
        left: cardStep() * direction,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    }

    function stopAuto() {
      if (autoTimer) {
        window.clearInterval(autoTimer);
        autoTimer = null;
      }
    }

    function startAuto() {
      stopAuto();
      if (reduceMotion || hits.length <= 3) return;

      autoTimer = window.setInterval(() => {
        if (paused || doc.hidden || !isInView || doc.body.classList.contains("modal-open")) return;

        const max = hitsTrack.scrollWidth - hitsTrack.clientWidth;
        if (max <= 0) return;

        if (hitsTrack.scrollLeft >= max - 8) {
          hitsTrack.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          scrollHits(1);
        }
      }, 6200);
    }

    prevButton?.addEventListener("click", () => {
      scrollHits(-1);
      startAuto();
    });

    nextButton?.addEventListener("click", () => {
      scrollHits(1);
      startAuto();
    });

    hitsTrack.addEventListener("scroll", () => window.requestAnimationFrame(updateCarousel), { passive: true });
    window.addEventListener("resize", updateCarousel);

    hitsTrack.addEventListener("mouseenter", () => {
      paused = true;
    });
    hitsTrack.addEventListener("mouseleave", () => {
      paused = false;
    });
    hitsTrack.addEventListener("focusin", () => {
      paused = true;
    });
    hitsTrack.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (!hitsTrack.contains(doc.activeElement)) paused = false;
      }, 0);
    });

    if ("IntersectionObserver" in window) {
      const hitsObserver = new IntersectionObserver(
        (entries) => {
          isInView = entries[0].isIntersecting;
        },
        { threshold: 0.12 }
      );
      hitsObserver.observe(hitsTrack);
    }

    /* Перетягування мишкою — як у справжньому слайдері */
    let dragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;
    let dragDistance = 0;

    hitsTrack.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse") return;
      dragging = true;
      dragStartX = event.clientX;
      dragStartScroll = hitsTrack.scrollLeft;
      dragDistance = 0;
      hitsTrack.classList.add("is-dragging");
      hitsTrack.setPointerCapture?.(event.pointerId);
    });

    hitsTrack.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const delta = event.clientX - dragStartX;
      dragDistance = Math.max(dragDistance, Math.abs(delta));
      hitsTrack.scrollLeft = dragStartScroll - delta;
    });

    function finishDrag() {
      if (!dragging) return;
      dragging = false;
      hitsTrack.classList.remove("is-dragging");

      if (dragDistance > 8) {
        suppressClick = true;
        window.setTimeout(() => {
          suppressClick = false;
        }, 260);
      }
    }

    hitsTrack.addEventListener("pointerup", finishDrag);
    hitsTrack.addEventListener("pointercancel", finishDrag);
    hitsTrack.addEventListener("pointerleave", finishDrag);

    hitsTrack.addEventListener(
      "click",
      (event) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );

    hitsTrack.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollHits(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollHits(-1);
      }
    });

    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) stopAuto();
      else startAuto();
    });

    window.requestAnimationFrame(updateCarousel);
    startAuto();
  }

  /* ----------------------------------------------------------
     РУЛЕТКА СМАКУ
     ---------------------------------------------------------- */
  const fateCard = $("#fate-card");

  if (fateCard) {
    const fateImage = $("#fate-image", fateCard);
    const fateName = $("#fate-name", fateCard);
    const fateMeta = $("#fate-meta", fateCard);
    const fateOpen = $("#fate-open", fateCard);
    const spinButton = $("#spin-button");
    const label = $("#fate-label", fateCard);

    const fateIds = [1, 4, 27, 14, 7, 25, 17, 31, 35];
    const fatePool = fateIds
      .map((id) => recipesDB.find((recipe) => recipe.id === id))
      .filter(Boolean);

    let currentFate = null;
    let spinning = false;

    if (fatePool.length && fateImage && fateName) {
      fatePool.forEach((recipe) => {
        const preload = new Image();
        preload.src = MX.thumbFor(recipe.image);
      });

      const today = new Date();
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((today - startOfYear) / 86400000);
      const initialRecipe = fatePool[dayOfYear % fatePool.length];

      function setFate(recipe) {
        currentFate = recipe;
        fateImage.src = MX.thumbFor(recipe.image);
        fateImage.alt = recipe.title;
        fateName.textContent = recipe.title;
        if (fateMeta) {
          fateMeta.innerHTML = `
            <span>${MX.icon("clock")} ${escapeHtml(recipe.time)}</span>
            <span>${MX.icon("chart")} ${escapeHtml(recipe.difficulty)}</span>
            <span>${MX.icon("flame")} ${escapeHtml(recipe.calories || "—")}</span>
          `;
        }
        if (fateOpen) fateOpen.dataset.openRecipe = recipe.id;
        if (label) label.textContent = "Сьогодні готуємо";
      }

      setFate(initialRecipe);

      spinButton?.addEventListener("click", () => {
        if (spinning) return;
        spinning = true;
        spinButton.disabled = true;
        fateCard.classList.add("is-spinning");
        if (label) label.textContent = "Доля обирає…";

        let tick = 0;
        const flicker = window.setInterval(() => {
          const random = fatePool[Math.floor(Math.random() * fatePool.length)];
          fateImage.src = MX.thumbFor(random.image);
          fateName.textContent = random.title;
          tick += 1;
        }, 85);

        window.setTimeout(() => {
          window.clearInterval(flicker);

          const poolWithoutCurrent = fatePool.filter((recipe) => recipe.id !== currentFate?.id);
          const chosen = poolWithoutCurrent[Math.floor(Math.random() * poolWithoutCurrent.length)] || fatePool[0];

          setFate(chosen);
          fateCard.classList.remove("is-spinning");
          spinButton.disabled = false;
          spinning = false;
          burstConfetti(fateCard);
          MX.toast(`Сьогодні — ${chosen.title.split(" ").slice(0, 4).join(" ")}. Смачного!`);
        }, 1250);
      });
    }
  }

  /* ----------------------------------------------------------
     ЖИВИЙ ПОШУК НА ГОЛОВНІЙ
     ---------------------------------------------------------- */
  const searchForm = $("#home-search-form");

  if (searchForm) {
    const input = $("#home-search", searchForm);
    const results = $("#home-search-results");

    function highlight(text, query) {
      const raw = String(text ?? "");
      const lower = raw.toLocaleLowerCase("uk");
      const needle = String(query).toLocaleLowerCase("uk");
      const index = lower.indexOf(needle);

      if (index < 0) return escapeHtml(raw);

      return `${escapeHtml(raw.slice(0, index))}<mark>${escapeHtml(raw.slice(index, index + needle.length))}</mark>${escapeHtml(raw.slice(index + needle.length))}`;
    }

    function resetSearch() {
      if (!input || !results) return;
      input.value = "";
      results.hidden = true;
      results.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      input.focus();
    }

    function renderSearch() {
      if (!input || !results) return;

      const query = normalize(input.value);

      if (query.length < 2) {
        results.hidden = true;
        results.innerHTML = "";
        input.setAttribute("aria-expanded", "false");
        return;
      }

      const matches = recipesDB.filter((recipe) => MX.matchesSearch(MX.recipeHaystack(recipe), input.value));

      results.hidden = false;
      input.setAttribute("aria-expanded", "true");

      if (!matches.length) {
        results.innerHTML = `
          <div class="search-empty">
            <span>На жаль, нічого не знайшли. Спробуйте «курка», «сир» або «шоколад».</span>
            <button type="button" data-search-reset>Скинути</button>
          </div>
        `;
        return;
      }

      const visible = matches.slice(0, 5);

      results.innerHTML =
        visible
          .map((recipe) => {
            const matchedIngredient = (recipe.ingredients || []).find((ingredient) =>
              MX.matchesSearch(ingredient, input.value)
            );

            return `
              <a class="search-result" href="recipes.html?recipe=${encodeURIComponent(recipe.id)}" data-open-recipe="${escapeHtml(recipe.id)}">
                <img src="${escapeHtml(MX.thumbFor(recipe.image))}" alt="" loading="lazy" width="54" height="54" ${MX.imageFallback(recipe)}>
                <span class="search-result-copy">
                  <span class="search-result-title">${highlight(recipe.title, input.value.trim())}</span>
                  <span class="search-result-meta">${escapeHtml(matchedIngredient || `${categoryName(recipe)} · ${recipe.time}`)}</span>
                </span>
                <span class="search-result-go" aria-hidden="true">${MX.icon("arrow")}</span>
              </a>
            `;
          })
          .join("") +
        (matches.length > visible.length
          ? `<a class="search-more" href="recipes.html?q=${encodeURIComponent(input.value.trim())}">Показати всі ${matches.length} ${plural(matches.length, "результат", "результати", "результатів")} →</a>`
          : "");
    }

    const debouncedSearch = (() => {
      let timer = null;
      return () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(renderSearch, 120);
      };
    })();

    input?.addEventListener("input", debouncedSearch);

    input?.addEventListener("search", () => {
      if (!input.value) {
        results.hidden = true;
        results.innerHTML = "";
        input.setAttribute("aria-expanded", "false");
      }
    });

    formResetHandler();

    function formResetHandler() {
      results?.addEventListener("click", (event) => {
        if (!event.target.closest("[data-search-reset]")) return;
        resetSearch();
      });
    }

    $$("[data-search-chip]").forEach((chip) => {
      chip.addEventListener("click", () => {
        if (!input) return;
        input.value = chip.dataset.searchChip || "";
        renderSearch();
        input.focus();
      });
    });

    searchForm.addEventListener("submit", () => {
      if (input) input.value = input.value.trim();
    });
  }

  /* ----------------------------------------------------------
     ПІДПИСКА + КОНФЕТІ
     ---------------------------------------------------------- */
  const subscribeForm = $("#subscribe-form");

  if (subscribeForm) {
    const emailInput = $("#subscribe-email", subscribeForm);
    const note = $("#subscribe-note");
    const success = $("#subscribe-success");
    const successEmail = $("#subscribe-success-email");

    subscribeForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!emailInput) return;

      const email = emailInput.value.trim();
      const looksValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

      if (!looksValid) {
        if (note) {
          note.textContent = "Схоже, в email є помилка. Перевірте адресу — і ще раз.";
          note.classList.add("is-error");
        }
        emailInput.focus();
        return;
      }

      if (note) note.classList.remove("is-error");
      subscribeForm.hidden = true;

      if (success) success.hidden = false;
      if (successEmail) successEmail.textContent = email;

      burstConfetti(success || subscribeForm);
      MX.toast("Готово! Перший лист прилетить у п’ятницю.");
    });
  }

  /* ----------------------------------------------------------
     Конфеті без бібліотек
     ---------------------------------------------------------- */
  function burstConfetti(origin) {
    if (reduceMotion || !origin || typeof origin.getBoundingClientRect !== "function") return;

    const rect = origin.getBoundingClientRect();
    const colors = ["#dfff57", "#a9f5c9", "#ff5c39", "#fff7e8", "#17120d"];

    for (let index = 0; index < 26; index += 1) {
      const piece = doc.createElement("span");
      const size = 6 + Math.random() * 7;
      const startX = rect.left + rect.width / 2 + (Math.random() - 0.5) * 40;
      const startY = rect.top + rect.height / 2 + (Math.random() - 0.5) * 20;

      piece.className = "confetti";
      piece.setAttribute("aria-hidden", "true");
      piece.style.left = `${startX}px`;
      piece.style.top = `${startY}px`;
      piece.style.width = `${size}px`;
      piece.style.height = `${size * (0.5 + Math.random())}px`;
      piece.style.background = colors[index % colors.length];
      piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
      doc.body.appendChild(piece);

      const angle = Math.random() * Math.PI * 2;
      const distance = 70 + Math.random() * 210;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance - 40;

      const animation = piece.animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(${x}px, ${y + 150}px) rotate(${Math.random() * 720 - 360}deg)`,
            opacity: 0,
          },
        ],
        {
          duration: 900 + Math.random() * 700,
          easing: "cubic-bezier(.16,.75,.3,1)",
          delay: Math.random() * 120,
        }
      );

      animation.onfinish = () => piece.remove();
      animation.oncancel = () => piece.remove();
    }
  }

  window.MX.burstConfetti = burstConfetti;
})();
