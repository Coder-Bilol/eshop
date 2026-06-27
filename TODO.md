# TODO: SWC native binding on Windows 10

## Суть проблемы

Локальный `next dev` по стандартному пути Turbopack падает, потому что Next.js не может загрузить native SWC binding:

- Next пытается загрузить `@next/swc-win32-x64-msvc`.
- Пакет и `.node` binary локально присутствуют.
- Версии совпадают: `next@16.2.9` и `@next/swc-win32-x64-msvc@16.2.9`.
- Локальная платформа Windows x64, значит выбран ожидаемый пакет.
- Native loader все равно возвращает `not a valid Win32 application`.
- `next dev --webpack` работает как временный local fallback, но он обходит Turbopack path.

Вероятные причины, в порядке проверки:

1. Отсутствует или сломан Microsoft Visual C++ Redistributable x64 runtime.
2. SWC native binary поврежден или некорректно распакован.
3. npm optional dependencies были отключены или пропущены при установке.
4. Есть проблема с workspace lockfile / install layout для optional platform packages.
5. Возможен compatibility edge между Node 24 и текущим Next/SWC binary.

## План действий

1. Установить или repair Microsoft Visual C++ Redistributable x64 для Windows.
2. Проверить настройки npm для optional dependencies:

   ```powershell
   npm config get optional
   npm config get omit
   npm config get include
   ```

3. Переустановить зависимости с включенными optional packages:

   ```powershell
   npm install --include=optional
   ```

4. Если SWC все еще падает, закрыть dev servers и сделать clean reinstall:

   ```powershell
   Remove-Item -Recurse -Force node_modules
   Remove-Item -Recurse -Force apps\storefront\node_modules
   Remove-Item -Recurse -Force apps\storefront\.next
   npm install --include=optional
   ```

5. Только если clean reinstall оставляет тот же bad binary, рассмотреть регенерацию `package-lock.json`.
   Это нужно делать осознанно, потому что lockfile влияет на dependency resolution всего workspace.

6. Проверить native SWC перед тем, как считать Turbopack исправленным:

   ```powershell
   node -e "require('./node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node'); console.log('swc native ok')"
   npm --workspace apps/storefront run dev -- --hostname 127.0.0.1 --port 3000
   ```

7. Если native SWC все еще падает после repair path, оставить локальный запуск на:

   ```powershell
   npm --workspace apps/storefront run dev -- --webpack --hostname 127.0.0.1 --port 3000
   ```

   После этого зафиксировать SWC/Turbopack как Windows-local blocker, а не блокировать весь local runtime.

## Заметки

- Не добавлять `@next/swc-win32-x64-msvc` вручную как обычную app dependency, пока не доказано, что Next install path действительно сломан. Next обычно сам управляет SWC platform binaries через optional dependencies.
- Docker не входит в local Windows 10 fix path. Docker остается только для будущего remote server deployment.
