import { DIFFICULTIES, ENEMIES, HERO, SPELLS, TARGET_MODES, TOWERS, type DifficultyId, type EnemyKind, type SpellId, type TargetMode, type TowerKind } from './config';
import { GAME_TITLE, TUTORIAL } from './levels';
import { ACTS, LEVELS } from './campaign';
import { MAP_TEXTS } from './maptexts';
import { ENDLESS } from './endless';
import { PERKS } from './perks';
import { bestiaryEntry } from './bestiary';
import { boonDef, type BoonId } from './boons';
import type { World } from './world';

/**
 * Языки. Русский — исходный: тексты лежат прямо в config.ts, levels.ts и perks.ts.
 * Английский хранится здесь таблицами по id; функции ниже отдают нужный язык.
 * Модуль без DOM: его импортирует и симуляция в Node.
 */
export type Lang = 'ru' | 'en';
export const LANGS: ReadonlyArray<{ id: Lang; name: string }> = [
  { id: 'ru', name: 'Русский' },
  { id: 'en', name: 'English' },
];

let current: Lang = 'ru';
export function getLang(): Lang {
  return current;
}
export function setLang(l: Lang): void {
  current = l;
}
/** Язык по умолчанию из браузера: русский для ru/uk/be/kk, иначе английский. */
export function detectLang(): Lang {
  const n = (typeof navigator !== 'undefined' ? navigator.language : 'ru').toLowerCase();
  return /^(ru|uk|be|kk)/.test(n) ? 'ru' : 'en';
}

const UI_RU = {
  'title.subtitle': 'Tower defense про оборону муравейника',
  'title.play': 'Играть',
  'title.controls': 'Управление мышью и пальцем',
  'title.settings': 'Настройки',
  'hud.wave': 'Волна {0}/{1}',
  'hotbar.pick': 'Выбери точку на поле',
  'wave.fight': 'В бой!',
  'wave.next': 'Следующая волна',
  'wave.in': 'через {0} с',
  'wave.running': 'Волна {0} идёт',
  'wave.last': 'Последняя волна!',
  'info.again': ' Нажми ещё раз, чтобы выбрать.',
  'info.level': 'уровень',
  'info.building': 'строится',
  'info.target': 'Цель башен: {0}',
  'info.targetHint': ' Тап листает режимы для всех башен.',
  'info.cooldown': 'перезарядка {0} с',
  'info.pickSpot': 'выбери точку на поле',
  'info.freeCell': 'Свободная клетка',
  'info.freeCellDesc': 'Выбери, что построить. Солдаты держат врага, стрелки и споры достают летающих.',
  'menu.building': 'СТРОИМ',
  'menu.max': 'Макс. уровень',
  'menu.upgrade': 'Улучшить до {0}',
  'menu.sell': 'Продать',
  'levels.level': 'Уровень {0}',
  'levels.play': 'Играть',
  'levels.replay': 'Играть снова',
  'levels.locked': 'Пройди предыдущий уровень',
  'levels.difficulty': 'Сложность: {0} (меняется перед уровнем)',
  'levels.reset': 'Сбросить прогресс',
  'levels.resetConfirm': 'Точно сбросить? Ещё раз',
  'levels.settings': 'Настройки',
  'intro.level': 'Уровень {0}',
  'intro.stats': '{0} волн · {1} · {2} клеток под застройку · {3} личинок',
  'intro.onePath': 'одна тропа',
  'intro.paths': '{0} тропы',
  'intro.difficulty': 'Сложность',
  'intro.fight': 'В бой!',
  'intro.back': 'К уровням',
  'intro.hint1': 'Тап по свободной клетке строит башню. Заклинания внизу слева: тап по кнопке, потом по точке на поле.',
  'intro.hint2': 'Q, W, E: заклинания. Пробел: пауза. N: следующая волна. Esc или правая кнопка: отмена.',
  'end.won': 'Муравейник выстоял!',
  'end.lost': 'Муравейник пал...',
  'end.difficulty': 'Сложность: {0}.',
  'end.wonText': 'Все {0} волн отбиты, личинок уцелело {1} из {2}. {3}{4}',
  'end.lostText': 'Продержались волн: {0} из {1}. {2} Попробуй казарму на развилке и не копи заклинания{3}.',
  'end.easier': ', или выбери сложность полегче',
  'end.back': 'К уровням',
  'end.again': 'Ещё раз',
  'pause.title': 'Пауза',
  'pause.resume': 'Продолжить',
  'pause.levels': 'К уровням',
  'pause.settings': 'Настройки',
  'pause.hint': 'Тап мимо кнопок или Пробел тоже продолжают игру',
  'settings.title': 'Настройки',
  'settings.language': 'Язык',
  'settings.music': 'Музыка',
  'settings.sfx': 'Звуки',
  'settings.off': 'выкл',
  'settings.back': 'Назад',
  'settings.fullscreen': 'Полный экран',
  'settings.on': 'Вкл',
  'settings.offBtn': 'Выкл',
  'settings.fsHint': 'добавьте игру на главный экран',
  'settings.fsApp': 'приложение и так на весь экран',
  'title.install': 'Установить',
  'settings.howInstall': 'Как поставить на главный экран',
  'install.title': 'Игра на главном экране',
  'install.step1': 'Нажмите «Поделиться» в панели браузера\nили в меню «•••»',
  'install.step2': 'Выберите «На экран „Домой“»',
  'install.step3': 'Запускайте игру со значка:\nна весь экран и без интернета',
  'install.note': 'Прогресс у значка свой: Safari и значок хранят звёзды отдельно',
  'install.ok': 'Понятно',
  'portrait.title': 'Поверни телефон',
  'portrait.sub': 'горизонтально: так удобнее играть',
  'fx.noNectar': 'Мало нектара',
  'fx.stomp': 'Напор!',
  'fx.ballBroken': 'Шар разбит!',
  'fx.sting': 'Жало!',
  'fx.curl': 'В шар!',
  'fx.leap': 'Прыжок!',
  'fx.split': 'Надвое!',
  'fx.cocoon': 'Кокон!',
  'fx.hatch': 'Вылупилась!',
  'fx.latch': 'Вцепился!',
  'fx.slash': 'Режет!',
  'boon.title': 'Дар королевы',
  'boon.sub': 'Отбито волн: {0}. Выбери одно усиление: оно останется до конца осады.',
  'boon.pick': 'Выбрать',
  'boon.taken': 'уже взято: {0}',
  'boon.spent': 'Разовый дар: нектар уже в кладовой.',
  'boon.group.towers': 'Башни',
  'boon.group.soldiers': 'Солдаты',
  'boon.group.spells': 'Заклинания',
  'boon.group.colony': 'Колония',
  'foe.new': 'Новый враг',
  'foe.more': 'подробнее',
  'foe.ok': 'Понятно',
  'foe.tip': 'Как бороться',
  'foe.hp': 'Здоровье',
  'foe.armor': 'Панцирь',
  'foe.speed': 'Скорость',
  'foe.hit': 'Удар',
  'foe.ground': 'Пеший',
  'foe.flying': 'Летает',
  'foe.boss': 'Босс',
  'foe.lives': 'Личинок уносит: {0}',
  'bestiary.title': 'Враги',
  'bestiary.count': 'Встречено {0} из {1}',
  'bestiary.unknown': 'Ещё не встречен',
  'bestiary.unknownText': 'Карточка откроется, когда этот враг впервые выйдет на тропу.',
  'bestiary.where': 'Водится: {0}',
  'bestiary.back': 'Назад',
  'colony.title': 'Муравейник',
  'colony.sub': 'Отстрой колонию после налёта: тапни по камере',
  'colony.nursery': 'Ясли',
  'colony.rubble': 'Завал',
  'colony.solar': 'Солярий',
  'colony.lab': 'Лаборатория',
  'colony.granary': 'Кладовая',
  'colony.fungus': 'Грибной сад',
  'colony.hangar': 'Ангар',
  'levels.colony': 'Муравейник',
  'levels.colonyCan': 'Муравейник · можно отстроить: {0}',
  'colony.workshop': 'Мастерская метателей',
  'colony.forage': 'Тропа фуражиров',
  'room.level': 'Уровень {0} из {1}',
  'room.empty': 'Камера пустует. Отстрой её, и колония станет сильнее в бою.',
  'room.buried': 'Под завалом — «{0}». Расчисти его, и откроется новое улучшение.',
  'room.next': 'Следующий уровень: {0}',
  'room.maxed': 'Камера отстроена полностью.',
  'room.build': 'Отстроить',
  'room.clear': 'Расчистить',
  'room.need': 'Нужно ещё {0}',
  'room.fx': '{0}: уровень {1}!',
  'grain.plus': '+{0} зерна',
  'daily.title': 'Дар дня',
  'daily.sub': 'Фуражиры несут зерно в кладовую. Заходи каждый день: к седьмому дню дар растёт, а пропущенный день возвращает к первому.',
  'daily.reset': 'День пропущен, и серия началась заново. Заходи каждый день: к седьмому дню дар растёт.',
  'daily.day': 'День {0}',
  'daily.claim': 'Забрать +{0}',
  'daily.next': 'Следующий дар через {0} ч {1} мин',
  'daily.close': 'Закрыть',
  'levels.bestiary': 'Враги',
  'pause.bestiary': 'Враги',
  'fx.fell': '{0} пал!',
  'fx.cooldown': 'Перезарядка {0} с',
  'fx.target': 'Цель башен: {0}',
  'stats.acid': 'Урон {0}–{1} · радиус {2} · выстрел каждые {3} с · бьёт по воздуху',
  'stats.barracks': '{0} солдата · здоровье {1} · урон {2}–{3} · возрождение {4} с',
  'stats.catapult': 'Урон {0}–{1} по площади {2} · радиус {3} · только по земле',
  'stats.spore': 'Замедление {0}% · яд {1}/с · радиус {2} · яд игнорирует панцирь',
  'hud.waveEndless': 'Волна {0}',
  'hud.best': 'рекорд {0}',
  'wave.wait': 'Волна подождёт',
  'levels.prologue': 'Пролог',
  'levels.tutorial': 'Обучение',
  'levels.tutorialDone': 'пройдено',
  'levels.challenge': 'Испытание',
  'levels.record': 'Рекорд: волна {0}',
  'levels.noRecord': 'Рекорда пока нет',
  'levels.lockedTutorial': 'Пройди обучение',
  'levels.map': 'Карта {0}',
  'levels.actLocked': 'Возьми звезду на каждой карте прошлого акта',
  'end.next': 'Дальше',
  'end.actUnlocked': ' Открыт {0}.',
  'intro.tutorial': 'Обучение',
  'intro.tutorialStats': '5 коротких волн · одна тропа · подсказки прямо на поле',
  'intro.skip': 'Пропустить обучение',
  'intro.endless': 'Испытание',
  'intro.endlessStats': 'Волнам нет конца · одна тропа спиралью к муравейнику · {0} клеток под застройку · {1} личинок',
  'intro.record': 'Рекорд ({0}): отбито волн {1}, врагов {2}',
  'intro.noRecord': 'На этой сложности рекорда пока нет',
  'end.tutorialWon': 'Обучение пройдено!',
  'end.tutorialText': 'Теперь ты знаешь всё нужное. Впереди настоящая осада, «Опушка у старого дуба». За победы дают звёзды и зерно: звёзды открывают новые акты, а за зерно отстраивается муравейник, и колония крепнет в бою. Открыта и бесконечная осада: там ставят рекорды.',
  'end.march': 'В поход!',
  'end.endless': 'Осада окончена',
  'end.endlessText': 'Отбито волн: {0}, повержено врагов: {1}. {2}',
  'end.newRecord': 'Новый рекорд!',
  'end.record': 'Рекорд: {0} волн.',
  'endless.hint': 'Тяни карту, чтобы осмотреться; щипок или колесо меняют масштаб',
  'fx.gift': '+{0} нектара на учёбу',
  'tut.acidCell': 'Враги идут по тропе к муравейнику. Тапни по подсвеченной клетке у поворота: здесь встанет башня.',
  'tut.acidPick': 'Выбери «Стрелки»: муравьи плюются кислотой и достают даже летающих.',
  'tut.wave1': 'Рабочие уже строят башню. Зови первую волну кнопкой «В бой!»: чем раньше, тем больше бонус нектара.',
  'tut.loot': 'За каждого врага капает нектар (вверху слева). Враг, дошедший до муравейника, съедает личинку.',
  'tut.barracksCell': 'Пауки крепче термитов. Тапни по клетке под тропой: там встанет казарма.',
  'tut.barracksPick': 'Выбери «Казарму»: солдаты выйдут на тропу и задержат врага, пока башни его добивают.',
  'tut.wave2': 'Зови вторую волну.',
  'tut.hold': 'Солдаты держат врага на тропе. Павшие солдаты сами возвращаются из казармы.',
  'tut.upgradeTower': 'Нектар копится. Тапни по стрелкам, чтобы улучшить башню.',
  'tut.upgradePick': 'Жми стрелку вверх: урон и радиус растут. После 3-го уровня башня выбирает специализацию.',
  'tut.sporeCell': 'Дальше летят осы, а казарма летающих не держит. Тапни по клетке у второго поворота.',
  'tut.sporePick': 'Выбери «Грибницу»: споры замедляют и травят всех вокруг, и летающих тоже.',
  'tut.wave3': 'Зови волну с осами.',
  'tut.air': 'Летающих бьют только стрелки и грибница: катапульта и казарма до них не достают.',
  'tut.wave4': 'Следом идёт толпа термитов. Зови!',
  'tut.rainArm': 'Время замерло! Жми «Кислотный дождь» внизу слева.',
  'tut.rainTap': 'Теперь тапни по толпе врагов: кислота бьёт всех в круге, панцирь не спасает.',
  'tut.spells': 'Пока заклинание перезаряжается, кнопка темнеет и считает секунды. Есть ещё «Дружина» и «Споровая туча».',
  'tut.wave5': 'Последняя волна: жук-щитоносец в крепком панцире. Зови!',
  'tut.speed': 'Бой можно ускорить: кнопка x2 вверху справа.',
  'tut.heroArm': 'Время замерло! Жми «Дружину»: выйдет воевода Жвал с двумя солдатами.',
  'tut.heroTap': 'Тапни по тропе перед жуком: дружина встанет там и задержит его.',
  'tut.finish': 'Отлично! Добей волну, и учёба окончена.',
};
export type UiKey = keyof typeof UI_RU;

const UI_EN: Record<UiKey, string> = {
  'title.subtitle': 'A tower defense about defending an anthill',
  'title.play': 'Play',
  'title.controls': 'Mouse and touch controls',
  'title.settings': 'Settings',
  'hud.wave': 'Wave {0}/{1}',
  'hotbar.pick': 'Pick a spot on the field',
  'wave.fight': 'To battle!',
  'wave.next': 'Next wave',
  'wave.in': 'in {0} s',
  'wave.running': 'Wave {0} underway',
  'wave.last': 'Last wave!',
  'info.again': ' Tap again to confirm.',
  'info.level': 'level',
  'info.building': 'under construction',
  'info.target': 'Tower target: {0}',
  'info.targetHint': ' Tap to cycle; applies to all towers.',
  'info.cooldown': 'recharging {0} s',
  'info.pickSpot': 'pick a spot on the field',
  'info.freeCell': 'Free cell',
  'info.freeCellDesc': 'Choose what to build. Soldiers hold enemies; spitters and spores reach flyers.',
  'menu.building': 'BUILDING',
  'menu.max': 'Max level',
  'menu.upgrade': 'Upgrade to {0}',
  'menu.sell': 'Sell',
  'levels.level': 'Level {0}',
  'levels.play': 'Play',
  'levels.replay': 'Play again',
  'levels.locked': 'Beat the previous level',
  'levels.difficulty': 'Difficulty: {0} (set before a level)',
  'levels.reset': 'Reset progress',
  'levels.resetConfirm': 'Really reset? Tap again',
  'levels.settings': 'Settings',
  'intro.level': 'Level {0}',
  'intro.stats': '{0} waves · {1} · {2} buildable cells · {3} larvae',
  'intro.onePath': 'one path',
  'intro.paths': '{0} paths',
  'intro.difficulty': 'Difficulty',
  'intro.fight': 'To battle!',
  'intro.back': 'To levels',
  'intro.hint1': 'Tap a free cell to build a tower. Spells are bottom left: tap a button, then a spot on the field.',
  'intro.hint2': 'Q, W, E: spells. Space: pause. N: next wave. Esc or right click: cancel.',
  'end.won': 'The anthill stands!',
  'end.lost': 'The anthill has fallen...',
  'end.difficulty': 'Difficulty: {0}.',
  'end.wonText': 'All {0} waves repelled, {1} of {2} larvae survived. {3}{4}',
  'end.lostText': 'Waves survived: {0} of {1}. {2} Try barracks at the fork and do not hoard spells{3}.',
  'end.easier': ', or pick an easier difficulty',
  'end.back': 'To levels',
  'end.again': 'Again',
  'pause.title': 'Paused',
  'pause.resume': 'Resume',
  'pause.levels': 'To levels',
  'pause.settings': 'Settings',
  'pause.hint': 'Tap outside the buttons or press Space to resume',
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.music': 'Music',
  'settings.sfx': 'Sounds',
  'settings.off': 'off',
  'settings.back': 'Back',
  'settings.fullscreen': 'Fullscreen',
  'settings.on': 'On',
  'settings.offBtn': 'Off',
  'settings.fsHint': 'add the game to your home screen',
  'settings.fsApp': 'the app is already fullscreen',
  'title.install': 'Install',
  'settings.howInstall': 'How to add to Home Screen',
  'install.title': 'Play from your Home Screen',
  'install.step1': 'Tap Share in the browser toolbar\nor in the ••• menu',
  'install.step2': 'Choose “Add to Home Screen”',
  'install.step3': 'Launch the game from the icon:\nfullscreen and offline',
  'install.note': 'The icon keeps its own progress: Safari and the icon store stars separately',
  'install.ok': 'Got it',
  'portrait.title': 'Rotate your phone',
  'portrait.sub': 'landscape is easier to play',
  'fx.noNectar': 'Not enough nectar',
  'fx.stomp': 'Charge!',
  'fx.ballBroken': 'Ball smashed!',
  'fx.sting': 'Sting!',
  'fx.curl': 'Curled up!',
  'fx.leap': 'Leap!',
  'fx.split': 'Split!',
  'fx.cocoon': 'Cocoon!',
  'fx.hatch': 'Hatched!',
  'fx.latch': 'Latched on!',
  'fx.slash': 'Slash!',
  'boon.title': "Queen's Gift",
  'boon.sub': 'Waves held: {0}. Choose one boost: it lasts until the siege ends.',
  'boon.pick': 'Choose',
  'boon.taken': 'already taken: {0}',
  'boon.spent': 'One-time gift: the nectar is already in your stores.',
  'boon.group.towers': 'Towers',
  'boon.group.soldiers': 'Soldiers',
  'boon.group.spells': 'Spells',
  'boon.group.colony': 'Colony',
  'foe.new': 'New enemy',
  'foe.more': 'details',
  'foe.ok': 'Got it',
  'foe.tip': 'How to fight it',
  'foe.hp': 'Health',
  'foe.armor': 'Armor',
  'foe.speed': 'Speed',
  'foe.hit': 'Attack',
  'foe.ground': 'On foot',
  'foe.flying': 'Flies',
  'foe.boss': 'Boss',
  'foe.lives': 'Larvae taken: {0}',
  'bestiary.title': 'Enemies',
  'bestiary.count': 'Met {0} of {1}',
  'bestiary.unknown': 'Not met yet',
  'bestiary.unknownText': 'The card opens when this enemy first steps onto the path.',
  'bestiary.where': 'Lives in: {0}',
  'bestiary.back': 'Back',
  'colony.title': 'The Anthill',
  'colony.sub': 'Rebuild the colony after the raid: tap a chamber',
  'colony.nursery': 'Nursery',
  'colony.rubble': 'Rubble',
  'colony.solar': 'Solarium',
  'colony.lab': 'Laboratory',
  'colony.granary': 'Granary',
  'colony.fungus': 'Fungus garden',
  'colony.hangar': 'Hangar',
  'levels.colony': 'Anthill',
  'levels.colonyCan': 'Anthill · ready to build: {0}',
  'colony.workshop': "Throwers' workshop",
  'colony.forage': "Foragers' trail",
  'room.level': 'Level {0} of {1}',
  'room.empty': 'The chamber stands empty. Rebuild it and the colony grows stronger in battle.',
  'room.buried': '{0} lies under the rubble. Clear it to unlock a new upgrade.',
  'room.next': 'Next level: {0}',
  'room.maxed': 'Fully rebuilt.',
  'room.build': 'Build',
  'room.clear': 'Clear',
  'room.need': 'Need {0} more',
  'room.fx': '{0}: level {1}!',
  'grain.plus': '+{0} grain',
  'daily.title': 'Daily gift',
  'daily.sub': 'Foragers bring grain to the granary. Come back every day: the gift grows toward day seven, and a missed day sends you back to day one.',
  'daily.reset': 'A day was missed, so the streak starts over. Come back every day: the gift grows toward day seven.',
  'daily.day': 'Day {0}',
  'daily.claim': 'Collect +{0}',
  'daily.next': 'Next gift in {0} h {1} min',
  'daily.close': 'Close',
  'levels.bestiary': 'Enemies',
  'pause.bestiary': 'Enemies',
  'fx.fell': '{0} has fallen!',
  'fx.cooldown': 'Recharging {0} s',
  'fx.target': 'Tower target: {0}',
  'stats.acid': 'Damage {0}–{1} · range {2} · shot every {3} s · hits air',
  'stats.barracks': '{0} soldiers · health {1} · damage {2}–{3} · respawn {4} s',
  'stats.catapult': 'Damage {0}–{1} in area {2} · range {3} · ground only',
  'stats.spore': 'Slow {0}% · poison {1}/s · range {2} · poison ignores armor',
  'hud.waveEndless': 'Wave {0}',
  'hud.best': 'best {0}',
  'wave.wait': 'The wave will wait',
  'levels.prologue': 'Prologue',
  'levels.tutorial': 'Tutorial',
  'levels.tutorialDone': 'done',
  'levels.challenge': 'Challenge',
  'levels.record': 'Best: wave {0}',
  'levels.noRecord': 'No record yet',
  'levels.lockedTutorial': 'Finish the tutorial',
  'levels.map': 'Map {0}',
  'levels.actLocked': 'Earn a star on every map of the previous act',
  'end.next': 'Next',
  'end.actUnlocked': ' Unlocked: {0}.',
  'intro.tutorial': 'Tutorial',
  'intro.tutorialStats': '5 short waves · one path · hints right on the field',
  'intro.skip': 'Skip the tutorial',
  'intro.endless': 'Challenge',
  'intro.endlessStats': 'Endless waves · one path spiralling to the anthill · {0} build cells · {1} larvae',
  'intro.record': 'Best ({0}): {1} waves held, {2} enemies',
  'intro.noRecord': 'No record on this difficulty yet',
  'end.tutorialWon': 'Tutorial complete!',
  'end.tutorialText': 'Now you know everything you need. A real siege lies ahead: Edge of the Old Oak. Victories earn stars and grain: stars open new acts, and grain rebuilds the anthill, making the colony stronger in battle. The endless siege is open too: that is where records are set.',
  'end.march': 'March on!',
  'end.endless': 'The siege is over',
  'end.endlessText': 'Waves held: {0}, enemies defeated: {1}. {2}',
  'end.newRecord': 'New record!',
  'end.record': 'Best: {0} waves.',
  'endless.hint': 'Drag the map to look around; pinch or scroll to zoom',
  'fx.gift': '+{0} nectar for training',
  'tut.acidCell': 'Enemies walk the path to the anthill. Tap the highlighted cell by the bend: a tower will stand here.',
  'tut.acidPick': 'Choose Spitters: the ants spit acid and even hit flyers.',
  'tut.wave1': 'The workers are already building. Call the first wave with “To battle!”: the earlier, the bigger the nectar bonus.',
  'tut.loot': 'Every enemy drops nectar (top left). An enemy that reaches the anthill eats a larva.',
  'tut.barracksCell': 'Spiders are tougher than termites. Tap the cell below the path: barracks will stand there.',
  'tut.barracksPick': 'Choose Barracks: soldiers step onto the path and hold the enemy while towers finish it.',
  'tut.wave2': 'Call the second wave.',
  'tut.hold': 'Soldiers hold enemies on the path. Fallen soldiers return from the barracks by themselves.',
  'tut.upgradeTower': 'Nectar is piling up. Tap the spitters to upgrade the tower.',
  'tut.upgradePick': 'Press the up arrow: damage and range grow. After level 3 a tower picks a specialization.',
  'tut.sporeCell': 'Wasps fly in next, and barracks cannot hold flyers. Tap the cell by the second bend.',
  'tut.sporePick': 'Choose Mycelium: spores slow and poison everyone around, flyers too.',
  'tut.wave3': 'Call the wave with wasps.',
  'tut.air': 'Only spitters and mycelium hit flyers: catapults and barracks cannot reach them.',
  'tut.wave4': 'A crowd of termites is next. Call it!',
  'tut.rainArm': 'Time has stopped! Press Acid Rain at the bottom left.',
  'tut.rainTap': 'Now tap the crowd: acid hits everyone in the circle, armor does not help.',
  'tut.spells': 'While a spell recharges, its button darkens and counts down. There are also Retinue and Spore Cloud.',
  'tut.wave5': 'The last wave: a shield beetle in thick armor. Call it!',
  'tut.speed': 'You can speed up the battle: the x2 button at the top right.',
  'tut.heroArm': 'Time has stopped! Press Retinue: warlord Mandible comes out with two soldiers.',
  'tut.heroTap': 'Tap the path in front of the beetle: the retinue will stand there and hold it.',
  'tut.finish': 'Well done! Finish the wave, and training is over.',
};

/** Строка интерфейса на текущем языке; {0}, {1}… заменяются аргументами. */
export function t(key: UiKey, ...args: ReadonlyArray<string | number>): string {
  const s = (current === 'ru' ? UI_RU : UI_EN)[key];
  return args.length ? s.replace(/\{(\d+)\}/g, (_, i: string) => String(args[Number(i)] ?? '')) : s;
}

// ───────────────────────── контент ─────────────────────────

interface Named { name: string; desc: string }
interface Spec extends Named { short: string }
interface TowerText extends Spec { specs: readonly Spec[] }

const TOWERS_EN: Record<TowerKind, TowerText> = {
  acid: {
    name: 'Acid Spitters', short: 'Spitters', desc: 'Ants spit formic acid. Fast, accurate, and they reach flyers.',
    specs: [
      { name: 'Snipers', short: 'Snipers', desc: 'One precise long-range spit. Pierces 60% of armor.' },
      { name: 'Volley', short: 'Volley', desc: 'Two spits per shot at different targets, very often.' },
    ],
  },
  barracks: {
    name: 'Soldier Barracks', short: 'Barracks', desc: 'Three soldier ants block the path and hold enemies in melee.',
    specs: [
      { name: 'Shellbacks', short: 'Shellbacks', desc: 'Soldiers in pebble armor: twice the health and 40% armor.' },
      { name: 'Reapers', short: 'Reapers', desc: 'Four fast fighters with huge damage but no armor.' },
    ],
  },
  catapult: {
    name: 'Seed Catapult', short: 'Catapult', desc: 'Leafcutters hurl seeds: slow, but hits an area. Cannot reach flyers.',
    specs: [
      { name: 'Stonethrower', short: 'Stone', desc: 'One boulder: huge damage and stuns everyone in the impact zone.' },
      { name: 'Seed Rain', short: 'Rain', desc: 'Three seeds in a fan: covers a whole crowd.' },
    ],
  },
  spore: {
    name: 'Mycelium', short: 'Mycelium', desc: 'Spore clouds slow and poison everyone around. Poison ignores armor.',
    specs: [
      { name: 'Rot', short: 'Rot', desc: 'Poison three times stronger, clouds bigger and longer-lasting.' },
      { name: 'Daze', short: 'Daze', desc: 'The cloud nearly stops enemies and stuns everyone who enters it.' },
    ],
  },
};

export function towerText(kind: TowerKind): TowerText {
  if (current === 'en') return TOWERS_EN[kind];
  const d = TOWERS[kind];
  return { name: d.name, short: d.short, desc: d.desc, specs: d.specs.map((s) => ({ name: s.name, short: s.short, desc: s.desc })) };
}

interface HeroText { name: string; title: string; desc: string; ability: string }
const HERO_EN: HeroText = {
  name: 'Mandible', title: 'warlord of the anthill',
  desc: 'Summoned by the Retinue spell: holds an enemy, hits everyone nearby and casts Mandibles on his own. Cannot hit flyers.',
  ability: 'Mandibles',
};
export function heroText(): HeroText {
  return current === 'en' ? HERO_EN : { name: HERO.name, title: HERO.title, desc: HERO.desc, ability: HERO.abilityName };
}

const SPELLS_EN: Record<SpellId, Named> = {
  acid: { name: 'Acid Rain', desc: 'Workers spit acid all at once: damage to everyone in the circle, armor is no help, reaches flyers.' },
  retinue: { name: 'Retinue', desc: 'Warlord Mandible and two soldiers step out to the spot and hold enemies until they tire.' },
  spores: { name: 'Spore Cloud', desc: 'A spore cloud on the path: enemies inside are slowed by half, poisoned and stunned on entry.' },
};
export function spellText(id: SpellId): Named {
  if (current === 'en') return SPELLS_EN[id];
  const d = SPELLS.find((s) => s.id === id)!;
  return { name: d.name, desc: d.desc };
}

const DIFF_EN: Record<DifficultyId, Named> = {
  easy: { name: 'Easy', desc: 'Weaker enemies, more nectar: relax and admire the towers.' },
  normal: { name: 'Normal', desc: 'As designed: you will have to think about where to build and what to upgrade.' },
  hard: { name: 'Hard', desc: 'Tough enemies and half the larvae: almost no room for error. For veterans.' },
};
export function difficultyText(id: DifficultyId): Named {
  if (current === 'en') return DIFF_EN[id];
  const d = DIFFICULTIES.find((x) => x.id === id)!;
  return { name: d.name, desc: d.desc };
}

const TARGET_EN: Record<TargetMode, Spec> = {
  first: { name: 'First', short: 'First', desc: 'Hits the enemy closest to the anthill.' },
  last: { name: 'Last', short: 'Last', desc: 'Hits the enemy farthest from the anthill: the one that just entered range.' },
  near: { name: 'Nearest', short: 'Near', desc: 'Hits the enemy nearest to the tower itself.' },
  strong: { name: 'Strongest', short: 'Strong', desc: 'Hits the enemy with the most health.' },
  weak: { name: 'Weakest', short: 'Weak', desc: 'Finishes off the enemy with the least health.' },
};
export function targetText(id: TargetMode): Spec {
  if (current === 'en') return TARGET_EN[id];
  const d = TARGET_MODES.find((x) => x.id === id)!;
  return { name: d.name, short: d.short, desc: d.desc };
}

const BOONS_EN: Record<BoonId, Named> = {
  acid: { name: 'Burning Acid', desc: 'Spitter damage +15%.' },
  catapult: { name: 'Stone Seeds', desc: 'Catapult damage +15%.' },
  spore: { name: 'Vicious Spores', desc: 'Mycelium and spore cloud poison +20%, clouds last longer.' },
  rate: { name: 'Quick Shots', desc: 'Spitters, catapults and mycelium reload 8% faster.' },
  range: { name: 'Sharp Lookouts', desc: 'Range of spitters, catapults and mycelium +6%.' },
  chitin: { name: 'Thick Chitin', desc: 'Barracks and retinue soldier health +20%. Soldiers on the field heal at once.' },
  jaws: { name: 'Sharp Mandibles', desc: 'Barracks and retinue soldier damage +20%.' },
  veteran: { name: 'Veteran', desc: 'Warlord Mandible arrives one level higher.' },
  spells: { name: 'Swift Runners', desc: 'Spells recharge 12% faster.' },
  bounty: { name: 'Honeydew', desc: 'Nectar per enemy +15%.' },
  nectar: { name: 'Full Pantry', desc: '+{0} nectar right now.' },
  brood: { name: 'New Brood', desc: '+3 larvae right now.' },
};
/** Дар бесконечной осады на текущем языке; число в описании считается по ходу осады. */
export function boonText(id: BoonId, w: World): Named {
  const d = boonDef(id);
  const tx = current === 'en' ? BOONS_EN[id] : { name: d.name, desc: d.desc };
  return { name: tx.name, desc: d.value ? tx.desc.replace('{0}', String(d.value(w))) : tx.desc };
}

interface PerkText { name: string; desc: (rank: number) => string }
const PERKS_EN: Record<string, PerkText> = {
  acidDmg: { name: 'Caustic Acid', desc: (r) => `Spitter damage +${r * 10}%` },
  soldierHp: { name: 'Hard Chitin', desc: (r) => `Barracks and retinue soldier health +${r * 15}%` },
  spore: { name: 'Dense Spores', desc: (r) => `Mycelium and spore cloud poison +${r * 12}%, clouds last longer` },
  catapultDmg: { name: 'Heavy Seeds', desc: (r) => `Catapult damage +${r * 12}%` },
  bounty: { name: 'Thrifty Foragers', desc: (r) => `Nectar per enemy +${r * 10}%` },
  startGold: { name: 'Full Pantries', desc: (r) => `Starting nectar +${r * 60}` },
  hero: { name: 'Warlord Tempering', desc: (r) => `Mandible arrives ${r} level${r > 1 ? 's' : ''} higher, spell cooldowns −${r * 8}%` },
  lives: { name: 'Deep Nurseries', desc: (r) => `+${r * 2} larvae at level start` },
};
export function perkText(id: string): PerkText {
  const p = PERKS.find((x) => x.id === id)!;
  if (current === 'en' && PERKS_EN[id]) return PERKS_EN[id];
  return { name: p.name, desc: p.desc };
}

const ENEMY_NAMES_EN: Record<EnemyKind, string> = {
  termite: 'Termite', spider: 'Spider', beetle: 'Shield Beetle', wasp: 'Wasp', soldierTermite: 'Soldier Termite',
  blackAnt: 'Black Ant', hornet: 'Hornet', slug: 'Slug', rhino: 'Rhinoceros Beetle', queen: 'Termite Queen',
  dragonfly: 'Dragonfly', leech: 'Leech', bomber: 'Bomber Termite', empress: 'Termite Empress', scarab: 'Scarab',
  scorpion: 'Scorpion', woodlouse: 'Woodlouse', grasshopper: 'Mountain Grasshopper', centipede: 'Centipede',
  centipedeHalf: 'Centipede Half', armyAnt: 'Army Ant', iceBug: 'Ice Bug', iceSnail: 'Ice Snail',
  silkworm: 'Silkworm Caterpillar', cocoon: 'Silkworm Cocoon', silkMoth: 'Silk Moth', tick: 'Tick', mantis: 'Mantis',
  firefly: 'Firefly',
};
/** Имя врага на текущем языке. */
export function enemyName(kind: EnemyKind): string {
  return current === 'en' ? ENEMY_NAMES_EN[kind] : ENEMIES[kind].name;
}

interface FoeNotes { short: string; desc: string; tip: string }
const BESTIARY_EN: Partial<Record<EnemyKind, FoeNotes>> = {
  termite: {
    short: 'Weak, but comes in crowds.',
    desc: 'A common termite: weak and slow, but there are always many of them.',
    tip: 'Any tower will do. A catapult is good against a crowd.',
  },
  spider: {
    short: 'Fast and tougher than a termite.',
    desc: 'Runs fast and takes more hits than a termite: a single tower cannot finish it in time.',
    tip: 'Hold it with barracks and finish it with spitters.',
  },
  wasp: {
    short: 'Flies: barracks and catapults miss it.',
    desc: 'Flies above the path. Soldiers cannot hold it and catapults cannot hit it.',
    tip: 'Only spitters and mycelium hit flyers.',
  },
  beetle: {
    short: 'Thick armor. Poison ignores it.',
    desc: 'A slow beetle in thick armor: ordinary hits lose almost half their force.',
    tip: 'Mycelium poison and acid rain go through armor, snipers pierce 60% of it.',
  },
  blackAnt: {
    short: 'The fastest enemy on foot.',
    desc: 'A raider ant from a rival colony: the fastest on foot, it slips past slow towers.',
    tip: 'Slow it with spores and hold it with barracks right next to your towers.',
  },
  soldierTermite: {
    short: 'A tough fighter in armor.',
    desc: 'A soldier termite in armor: sturdy, and it hits our soldiers hard.',
    tip: 'Hold it with upgraded barracks, hit it with poison and snipers.',
  },
  hornet: {
    short: 'Flies fast and takes a beating.',
    desc: 'A big wasp: flies fast and has twice the health.',
    tip: 'You need upgraded spitters. Mycelium slows it inside the firing zone.',
  },
  slug: {
    short: 'A mountain of health, wounds close up.',
    desc: 'Barely crawls, but has a mountain of health, and its wounds close by themselves. Takes two larvae.',
    tip: 'Hit it without pause and with several towers at once: any break gives its health back.',
  },
  rhino: {
    short: 'Boss. Hold it too long and it Charges.',
    desc: 'A boss in thick armor. Held for more than six seconds, it Charges: hurts and stuns the whole line, then pushes through for a few seconds.',
    tip: 'Poison and snipers against the armor. After a Charge it can be held again: set up one line after another.',
  },
  queen: {
    short: 'Boss. Spawns termites and heals.',
    desc: 'A boss. Very slow, heals her own wounds and releases a pair of termites every eight seconds. Takes ten larvae.',
    tip: 'A catapult mows down her brood. Hit the queen herself with everything you have, without pauses.',
  },
  dragonfly: {
    short: 'The fastest flyer.',
    desc: 'Fast and sturdy: it sweeps over the path before towers can zero in.',
    tip: 'Place spitters in a chain along the path, with mycelium in the middle.',
  },
  leech: {
    short: 'Sturdy, wounds close up.',
    desc: 'Thick and slow, its wounds close before your eyes. Takes two larvae.',
    tip: 'It heals through weak damage. Focus the fire of several towers in one place.',
  },
  bomber: {
    short: 'Explodes next to soldiers when it dies.',
    desc: 'A suicide termite: when it dies, it explodes and hurts soldiers and the warlord nearby.',
    tip: 'Shoot it from afar, before it reaches the line.',
  },
  empress: {
    short: 'The last boss of the termite mound.',
    desc: 'A boss. Armor, a mountain of health, wounds that close, and every nine seconds two soldier termites come out from under her. If she reaches the anthill, she takes twenty larvae.',
    tip: 'Poison goes past the armor. Hit the escort with area damage, replace the line after every Charge.',
  },
  scarab: {
    short: 'The ball takes hits. Poison goes past it.',
    desc: 'Rolls a ball in front of itself, and the ball takes every hit except poison. Without the ball the beetle runs almost twice as fast.',
    tip: 'Poison it with mycelium. If you hit the ball, break it where you can finish the beetle.',
  },
  scorpion: {
    short: 'Stings and breaks out of the line.',
    desc: 'While held, it stings every four seconds: the defender is stunned and lets it go.',
    tip: 'It gets past a single line. Place barracks in pairs or finish it with shooters while soldiers hold it.',
  },
  woodlouse: {
    short: 'A strong hit makes it curl into a ball.',
    desc: 'A strong hit makes it curl into a ball for three seconds: it rolls faster, its armor is nearly unbreakable, and a line cannot hold it.',
    tip: 'Poison does not make it curl: mycelium works better here than heavy hits.',
  },
  grasshopper: {
    short: 'Leaps over the line.',
    desc: 'When soldiers step into its way, it leaps over them and runs on. The next leap comes in six seconds.',
    tip: 'Put a second barracks farther along the path: after a leap it cannot jump for six seconds.',
  },
  centipede: {
    short: 'Splits into two halves when it dies.',
    desc: 'When it dies, it splits into two fast halves, and each runs on by itself. A whole one takes two larvae.',
    tip: 'Kill it far from the anthill, where a catapult can cover the halves.',
  },
  armyAnt: {
    short: 'Faster in a swarm. Use area damage.',
    desc: 'Small and weak, but they march as a swarm: the more kin nearby, the faster each one runs.',
    tip: 'Catapults and acid rain thin the swarm, and the survivors slow down.',
  },
  iceBug: {
    short: 'Chills nearby towers: they fire slower.',
    desc: 'A frost aura surrounds it: towers inside reload noticeably slower.',
    tip: 'Hit it from afar: snipers and catapults reach it from outside the aura. Hold it with a line away from your towers.',
  },
  iceSnail: {
    short: 'Lays ice: others run on it.',
    desc: 'Leaves ice behind it for ten seconds. Other enemies on foot slide along it almost one and a half times faster.',
    tip: 'Kill the snail early: without it the ice melts and the speed-up ends.',
  },
  silkworm: {
    short: 'Leaves a cocoon when it dies. Break it!',
    desc: 'When it dies, it wraps into a cocoon. In four seconds a fast moth flies out of it, and not every tower can reach a moth.',
    tip: 'Finish the caterpillar inside tower range and hit the cocoon at once: it stands still, and free soldiers chop it too.',
  },
  tick: {
    short: 'Drinks soldiers and heals. Use towers.',
    desc: 'Latches onto a defender and heals by as much as it took. A weak line only feeds it.',
    tip: 'Hit it with towers, not soldiers. If you must hold it, use Shellbacks: it drinks less through armor.',
  },
  mantis: {
    short: 'Mows the whole line. Hit it from afar.',
    desc: 'A sweep of its scythes hits every defender nearby at once: plain barracks melt in a second.',
    tip: 'It has no armor: shoot it on approach or stun it right at the line.',
  },
  firefly: {
    short: 'Heals enemies in its light. Kill it first.',
    desc: 'Flies above the path and heals every enemy inside its circle of light. The light of two fireflies does not stack.',
    tip: 'Shoot it down first. Only spitters and mycelium reach it.',
  },
};

export interface FoeText extends FoeNotes { name: string }
/** Карточка врага на текущем языке; null у видов без своей карточки (кокон, бабочка, половинка сколопендры). */
export function foeText(kind: EnemyKind): FoeText | null {
  const e = bestiaryEntry(kind);
  if (!e) return null;
  const en = current === 'en' ? BESTIARY_EN[kind] : undefined;
  return { name: enemyName(kind), short: en?.short ?? e.short, desc: en?.desc ?? e.desc, tip: en?.tip ?? e.tip };
}

interface LevelText { name: string; subtitle: string; story: string }
const LEVELS_EN: Record<string, LevelText> = {
  tutorial: {
    name: 'Training Ground', subtitle: 'Tutorial: five short waves',
    story: 'A short drill for a new warlord: five quick waves, and you know everything you need. Warlord Mandible himself will show towers, waves, nectar and spells, with hints right on the field. Until you are ready, the next wave will wait.',
  },
  endless: {
    name: 'Endless Siege', subtitle: 'A spiral path to the anthill, waves without end',
    story: 'A new anthill stands right in the middle of a big glade, and a single path leads to it, coiling around it twice. The waves never end, each tougher than the last, and every tenth is led by a boss. For every tenth wave you repel, the queen offers a gift: one boost out of three. Towers between the coils hit two of them at once. The map is bigger than the screen: drag it with a finger or the mouse, pinch or scroll to zoom. How many waves can you hold?',
  },
  'oak-edge': {
    name: 'Edge of the Old Oak', subtitle: 'First siege: one path, 12 waves',
    story: 'The old oak fell in a storm and the forest floor shuddered. Termites crawled out of the rotten stump, wasps rose from the fallen nest, and beetles came out from under the roots. The queen is laying a new brood, and the colony must hold out until the end of the season. You are the warlord of the anthill: place spitters, raise barracks and let no enemy reach the larvae.',
  },
  'oak-roots': {
    name: 'Roots of the Fallen Oak', subtitle: 'Two paths, one nest, 14 waves',
    story: 'Scouts found where the termites come from: the rotten stump under the roots of the fallen oak. Now the enemy comes along two paths at once, from the left and from below, and both meet at the eastern entrance. The queen ordered the roots held until the foreign queen has raised a new army. They say two rhinoceros beetles woke under the roots, and both are hungry.',
  },
  'rotten-stump-night': {
    name: 'Night at the Rotten Stump', subtitle: 'Act finale: the termite queen, 16 waves',
    story: 'The scouts crept up to the stump itself, and at night it came alive: a termite queen emerged, huge and slow, and every step of hers births new soldiers. The army comes from two sides, from the hole in the stump on the left and from the darkness on the right, with the anthill in between. This is the last night of the first act: hold until dawn, and in the morning the colony itself marches out.',
  },
  'stream-crossing': {
    name: 'Stream Crossing', subtitle: 'The campaign begins: two bridges, dragonflies and leeches',
    story: 'In the morning the colony set out. The road to the termite mound crosses a stream: two fallen branches serve as bridges, and the termites use them too. Camp is on our bank; hold the crossing until the caravan with larvae and supplies gets across. Dragonflies circle above the water, fast and tough, and leeches crawl out of the silt, barely touched by poison: they heal before your eyes.',
  },
  'mound-foot': {
    name: 'Foot of the Mound', subtitle: 'Three gates in the wall, bomber termites',
    story: 'The termite mound rises like a wall to the sky. Its defenders pour out of three gates at its foot, and among them are bomber termites: they burst next to our soldiers and hero, so barracks cost dearly here. Camp is right under the wall, there is nowhere to retreat. Hold out, and the way inside is open.',
  },
  'mound-heart': {
    name: 'Heart of the Mound', subtitle: 'Campaign finale: the termite empress',
    story: 'Inside it is dark and stuffy, the walls glow with mycelium. The termite empress sits in the deepest chamber and will not come out while she still has soldiers. Two tunnels lead to the fork where our camp stands. When the empress finally crawls toward you, her whole guard will follow. This is the last battle of the campaign.',
  },
};
export function levelText(id: string): LevelText {
  const lv = [TUTORIAL, ...LEVELS, ENDLESS].find((l) => l.id === id)!;
  if (current === 'en') {
    if (LEVELS_EN[id]) return LEVELS_EN[id];
    const gen = MAP_TEXTS[id]?.en;
    if (gen) return { name: gen.name, subtitle: gen.name, story: gen.story };
  }
  return { name: lv.name, subtitle: lv.subtitle, story: lv.story };
}

const ACTS_EN = [
  'Act 1 · Defense of the Anthill', 'Act 2 · March on the Termite Mound', 'Act 3 · Desert', 'Act 4 · Mountains',
  'Act 5 · Jungle', 'Act 6 · Snow', 'Act 7 · Forest', 'Act 8 · Asia',
];
const FINALES_EN = [
  ' Act 1 is over: in the morning the colony itself marches on the termite mound.',
  ' The mound has fallen, the empress is dead. The colony sends scouts beyond the edge of the forest.',
  ' The sands are behind: the caravan reached the oasis, and blue mountains rise ahead.',
  ' The pass is taken. From the peaks a sea of green is visible: the jungle.',
  ' The jungle parted, and a cold wind blew: snow lies ahead.',
  ' Winter retreated. Home forest lies ahead, but strangers have come there too.',
  ' The forest is ours again. The last road of the colony leads east, to the bamboo groves.',
  ' The great march is over: from the desert to the bamboo groves, the anthills stand unbroken.',
];
export function actTitle(i: number): string {
  return current === 'en' ? ACTS_EN[i] ?? ACTS[i].title : ACTS[i].title;
}
/** Строка победы на последней карте акта. */
export function actFinale(i: number): string {
  return current === 'en' ? FINALES_EN[i] ?? ACTS[i].finale : ACTS[i].finale;
}

export function gameTitle(): string {
  return current === 'en' ? 'Anthill: Siege' : GAME_TITLE;
}
