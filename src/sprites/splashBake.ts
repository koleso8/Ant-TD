/**
 * Конвертация заставки (только dev): берёт картинку из src/assets/splash/, вписывает её
 * в 1280×720 с обрезкой по краям и сохраняет через dev-плагин как src/assets/sprites/splash.webp,
 * который игра вшивает в сборку. Запуск: http://localhost:5173/splash.html?src=/src/assets/splash/splash_b.jpg&q=0.88
 */
const W = 1280;
const H = 720;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  return e;
}

async function main(): Promise<void> {
  const root = document.getElementById('app')!;
  root.appendChild(el('h1', 'Заставка меню'));
  const status = el('p', 'Загружаю картинку…');
  status.className = 'status';
  root.appendChild(status);
  const params = new URLSearchParams(location.search);
  const src = params.get('src') ?? '/src/assets/splash/splash_b.jpg';
  const quality = Number(params.get('q') ?? '0.88');
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch (e) {
    status.textContent = `Не загрузилась картинка ${src}: ${String(e)}`;
    return;
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  c.style.width = '960px';
  root.appendChild(c);
  const webp = c.toDataURL('image/webp', quality);
  if (!webp.startsWith('data:image/webp')) {
    status.textContent = 'Браузер не умеет кодировать WebP';
    return;
  }
  const kb = Math.round(((webp.length - webp.indexOf(',') - 1) * 0.75) / 1024);
  try {
    const res = await fetch('/__sprites/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'splash', webp, meta: { w: W, h: H, source: src, quality } }),
    });
    status.textContent = res.ok
      ? `Сохранено: src/assets/sprites/splash.webp (${kb} КБ) из ${src} (${img.naturalWidth}×${img.naturalHeight}), качество ${quality}`
      : `Не сохранилось: ${res.status} ${await res.text()}`;
  } catch (e) {
    status.textContent = `Не сохранилось: ${String(e)}`;
  }
}

void main();
