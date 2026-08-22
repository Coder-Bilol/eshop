---
description: Правила и расположение декоративной canvas-анимации storefront hero.
status: active
owner: GENERAL
last_updated: 2026-08-20
source_of_truth:
  - ../../apps/storefront/components/product-universe.tsx
  - ../../apps/storefront/app/page.tsx
  - ../../apps/storefront/app/globals.css
---
# Storefront Canvas Hero Motion

## Назначение

Главная страница storefront использует декоративную canvas-сцену в hero, чтобы
создать ощущение живого product universe без отдельного WebGL runtime.

## Где находится

- [apps/storefront/components/product-universe.tsx](../../apps/storefront/components/product-universe.tsx): client-only canvas renderer с детерминированной сферой точек, pointer-поворотом и reduced-motion режимом.
- [apps/storefront/app/page.tsx](../../apps/storefront/app/page.tsx): hero-блок и anchor-переход к каталогу.
- [apps/storefront/app/globals.css](../../apps/storefront/app/globals.css): hero layout, surface, responsive sizing и focus states.

## Runtime-правила

- Не добавлять Three.js только ради этой декоративной сцены.
- Canvas не является источником продуктовых данных и не должен содержать buyer state.
- Pixel ratio ограничен двумя; animation loop работает только при обычном motion preference.
- `prefers-reduced-motion: reduce` оставляет статичный кадр и сохраняет контекст hero.
- Интерактивная реакция pointer должна оставаться декоративной и не блокировать каталог.

## Проверка

- `npm run typecheck` из `apps/storefront/`
- `npm test` из `apps/storefront/`
- `npm run build` из `apps/storefront/`
- Browser smoke: canvas присутствует, anchor ведёт на `#catalog-browser`, reduced-motion не ломает DOM.
